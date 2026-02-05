using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using MusicasIgreja.Api.Controllers;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Models;
using MusicasIgreja.Api.Services;

namespace MusicasIgreja.Api.Tests.Controllers;

public class AuthControllerTests : IDisposable
{
    private readonly AppDbContext _context;
    private readonly AuthController _controller;
    private readonly AuthService _authService;
    private readonly Mock<IRateLimitService> _rateLimitServiceMock;
    private readonly Mock<IMonitoringService> _monitoringServiceMock;
    private readonly Mock<IAppInstanceService> _appInstanceServiceMock;
    private readonly Mock<ILogger<AuthController>> _loggerMock;
    private readonly Mock<ILogger<AuthService>> _authLoggerMock;
    private readonly Mock<IWebHostEnvironment> _environmentMock;

    public AuthControllerTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _context = new AppDbContext(options);
        _loggerMock = new Mock<ILogger<AuthController>>();
        _authLoggerMock = new Mock<ILogger<AuthService>>();
        _environmentMock = new Mock<IWebHostEnvironment>();
        _rateLimitServiceMock = new Mock<IRateLimitService>();
        _monitoringServiceMock = new Mock<IMonitoringService>();
        _appInstanceServiceMock = new Mock<IAppInstanceService>();
        
        // Setup AppInstanceService to return a test instance ID
        _appInstanceServiceMock.Setup(a => a.InstanceId).Returns("TEST123");
        
        _authService = new AuthService(_context, _authLoggerMock.Object);
        
        _environmentMock.Setup(e => e.EnvironmentName).Returns("Production");
        
        // Setup rate limit mock to not block by default
        _rateLimitServiceMock.Setup(r => r.IsRateLimited(It.IsAny<string>())).Returns(false);

        _controller = new AuthController(_authService, _rateLimitServiceMock.Object, _monitoringServiceMock.Object, _appInstanceServiceMock.Object, _loggerMock.Object, _environmentMock.Object);
        
        // Setup HttpContext with session and connection info
        var httpContext = new DefaultHttpContext();
        var sessionMock = new Mock<ISession>();
        var sessionData = new Dictionary<string, byte[]>();
        
        sessionMock.Setup(s => s.Set(It.IsAny<string>(), It.IsAny<byte[]>()))
            .Callback<string, byte[]>((key, value) => sessionData[key] = value);
        sessionMock.Setup(s => s.TryGetValue(It.IsAny<string>(), out It.Ref<byte[]>.IsAny))
            .Returns((string key, out byte[] value) =>
            {
                var exists = sessionData.TryGetValue(key, out var data);
                value = data!;
                return exists;
            });
        
        httpContext.Session = sessionMock.Object;
        httpContext.Connection.RemoteIpAddress = System.Net.IPAddress.Parse("127.0.0.1");
        _controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

        SeedDatabase();
    }

    private void SeedDatabase()
    {
        _context.Roles.AddRange(
            new Role { Id = 1, Name = "viewer", DisplayName = "Visualizador", IsDefault = true },
            new Role { Id = 4, Name = "admin", DisplayName = "Administrador", CanManageUsers = true }
        );
        _context.SaveChanges();

        // Create test user
        var user = new User
        {
            Id = 1,
            Username = "testuser",
            FullName = "Test User",
            PasswordHash = _authService.HashPassword("password123"),
            RoleId = 1,
            IsActive = true,
            MustChangePassword = false
        };
        _context.Users.Add(user);

        // Create admin user
        var admin = new User
        {
            Id = 2,
            Username = "admin",
            FullName = "Administrator",
            PasswordHash = _authService.HashPassword("admin123"),
            RoleId = 4,
            IsActive = true,
            MustChangePassword = false
        };
        _context.Users.Add(admin);

        _context.SaveChanges();
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
    }

    #region Login Tests

    [Fact]
    public async Task Login_WithValidCredentials_ShouldReturnSuccess()
    {
        var request = new LoginRequest { Username = "testuser", Password = "password123" };

        var result = await _controller.Login(request);

        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(okResult.Value);
    }

    [Fact]
    public async Task Login_WithInvalidPassword_ShouldReturnUnauthorized()
    {
        var request = new LoginRequest { Username = "testuser", Password = "wrongpassword" };

        var result = await _controller.Login(request);

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task Login_WithNonexistentUser_ShouldReturnUnauthorized()
    {
        var request = new LoginRequest { Username = "nonexistent", Password = "password" };

        var result = await _controller.Login(request);

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task Login_WithEmptyUsername_ShouldReturnBadRequest()
    {
        var request = new LoginRequest { Username = "", Password = "password" };

        var result = await _controller.Login(request);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Login_WithEmptyPassword_ShouldReturnBadRequest()
    {
        var request = new LoginRequest { Username = "testuser", Password = "" };

        var result = await _controller.Login(request);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Login_ShouldBeCaseInsensitiveForUsername()
    {
        var request = new LoginRequest { Username = "TESTUSER", Password = "password123" };

        var result = await _controller.Login(request);

        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(okResult.Value);
    }

    #endregion

    #region Rate Limiting Tests

    [Fact]
    public async Task Login_WhenRateLimited_ShouldReturn429()
    {
        // Setup rate limit to return true (blocked)
        _rateLimitServiceMock.Setup(r => r.IsRateLimited(It.IsAny<string>())).Returns(true);

        var request = new LoginRequest { Username = "testuser", Password = "password123" };

        var result = await _controller.Login(request);

        var statusCodeResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(429, statusCodeResult.StatusCode);
    }

    [Fact]
    public async Task Login_WithValidCredentials_ShouldResetRateLimit()
    {
        var request = new LoginRequest { Username = "testuser", Password = "password123" };

        await _controller.Login(request);

        // Verify that ResetAttempts was called
        _rateLimitServiceMock.Verify(r => r.ResetAttempts(It.IsAny<string>()), Times.Once);
    }

    [Fact]
    public async Task Login_WithInvalidCredentials_ShouldRecordAttempt()
    {
        var request = new LoginRequest { Username = "testuser", Password = "wrongpassword" };

        await _controller.Login(request);

        // Verify that RecordAttempt was called
        _rateLimitServiceMock.Verify(r => r.RecordAttempt(It.IsAny<string>()), Times.Once);
    }

    #endregion

    #region Logout Tests

    [Fact]
    public void Logout_ShouldReturnSuccess()
    {
        var result = _controller.Logout();

        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(okResult.Value);
    }

    #endregion

    #region ChangePassword Tests

    [Fact]
    public async Task ChangePassword_WithShortPassword_ShouldReturnBadRequest()
    {
        // Setup session with user
        var sessionMock = new Mock<ISession>();
        var sessionData = new Dictionary<string, byte[]>
        {
            ["UserId"] = BitConverter.GetBytes(1)
        };
        sessionMock.Setup(s => s.TryGetValue("UserId", out It.Ref<byte[]>.IsAny))
            .Returns((string key, out byte[] value) =>
            {
                var exists = sessionData.TryGetValue(key, out var data);
                value = data!;
                return exists;
            });
        
        var httpContext = new DefaultHttpContext { Session = sessionMock.Object };
        _controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

        var request = new ChangePasswordRequest { CurrentPassword = "password123", NewPassword = "ab" };

        var result = await _controller.ChangePassword(request);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task ChangePassword_WithEmptyCurrentPassword_ShouldReturnBadRequest()
    {
        // Setup session with user
        var sessionMock = new Mock<ISession>();
        var sessionData = new Dictionary<string, byte[]>
        {
            ["UserId"] = BitConverter.GetBytes(1)
        };
        sessionMock.Setup(s => s.TryGetValue("UserId", out It.Ref<byte[]>.IsAny))
            .Returns((string key, out byte[] value) =>
            {
                var exists = sessionData.TryGetValue(key, out var data);
                value = data!;
                return exists;
            });
        
        var httpContext = new DefaultHttpContext { Session = sessionMock.Object };
        _controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

        var request = new ChangePasswordRequest { CurrentPassword = "", NewPassword = "newpassword" };

        var result = await _controller.ChangePassword(request);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    #endregion
}
