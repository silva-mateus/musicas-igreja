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
        
        _authService = new AuthService(_context, _authLoggerMock.Object);
        
        _environmentMock.Setup(e => e.EnvironmentName).Returns("Production");

        _controller = new AuthController(_authService, _loggerMock.Object, _environmentMock.Object);
        
        // Setup HttpContext with session
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

    #region Debug Endpoints Tests

    [Fact]
    public void DebugHash_InProduction_ShouldReturnNotFound()
    {
        _environmentMock.Setup(e => e.EnvironmentName).Returns("Production");

        var result = _controller.DebugHash("test");

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public void DebugHash_InDevelopment_ShouldReturnHash()
    {
        _environmentMock.Setup(e => e.EnvironmentName).Returns("Development");
        var devController = new AuthController(_authService, _loggerMock.Object, _environmentMock.Object);

        var result = devController.DebugHash("test");

        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(okResult.Value);
    }

    [Fact]
    public async Task DebugUsers_InProduction_ShouldReturnNotFound()
    {
        _environmentMock.Setup(e => e.EnvironmentName).Returns("Production");

        var result = await _controller.DebugUsers();

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task ResetAdmin_InProduction_ShouldReturnNotFound()
    {
        _environmentMock.Setup(e => e.EnvironmentName).Returns("Production");

        var result = await _controller.ResetAdmin();

        Assert.IsType<NotFoundResult>(result);
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
