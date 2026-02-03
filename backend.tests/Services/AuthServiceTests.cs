using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.Models;
using MusicasIgreja.Api.Services;

namespace MusicasIgreja.Api.Tests.Services;

public class AuthServiceTests : IDisposable
{
    private readonly AppDbContext _context;
    private readonly AuthService _authService;
    private readonly Mock<ILogger<AuthService>> _loggerMock;

    public AuthServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _context = new AppDbContext(options);
        _loggerMock = new Mock<ILogger<AuthService>>();
        _authService = new AuthService(_context, _loggerMock.Object);

        SeedDatabase();
    }

    private void SeedDatabase()
    {
        // Add default roles
        _context.Roles.AddRange(
            new Role { Id = 1, Name = "viewer", DisplayName = "Visualizador", IsDefault = true },
            new Role { Id = 2, Name = "editor", DisplayName = "Editor" },
            new Role { Id = 3, Name = "uploader", DisplayName = "Uploader" },
            new Role { Id = 4, Name = "admin", DisplayName = "Administrador", CanManageUsers = true, CanManageRoles = true }
        );
        _context.SaveChanges();
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
    }

    #region HashPassword Tests

    [Fact]
    public void HashPassword_ShouldReturnBCryptHash()
    {
        var password = "test123";
        var hash = _authService.HashPassword(password);

        // BCrypt hashes start with $2a$, $2b$, or $2y$
        Assert.StartsWith("$2", hash);
        Assert.True(hash.Length > 50); // BCrypt hashes are typically 60 chars
    }

    [Fact]
    public void HashPassword_SamPasswordShouldProduceDifferentHashes()
    {
        var password = "test123";
        var hash1 = _authService.HashPassword(password);
        var hash2 = _authService.HashPassword(password);

        // BCrypt includes salt, so same password = different hashes
        Assert.NotEqual(hash1, hash2);
    }

    [Fact]
    public void VerifyPassword_WithCorrectPassword_ShouldReturnTrue()
    {
        var password = "test123";
        var hash = _authService.HashPassword(password);

        var result = _authService.VerifyPassword(password, hash);

        Assert.True(result);
    }

    [Fact]
    public void VerifyPassword_WithIncorrectPassword_ShouldReturnFalse()
    {
        var password = "test123";
        var hash = _authService.HashPassword(password);

        var result = _authService.VerifyPassword("wrong", hash);

        Assert.False(result);
    }

    [Fact]
    public void VerifyPassword_WithLegacySha256Hash_ShouldStillWork()
    {
        // Generate the correct legacy SHA256 hash for "admin123"
        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var bytes = System.Text.Encoding.UTF8.GetBytes("admin123");
        var hashBytes = sha256.ComputeHash(bytes);
        var legacyHash = Convert.ToBase64String(hashBytes);
        
        var result = _authService.VerifyPassword("admin123", legacyHash);

        Assert.True(result);
    }

    #endregion

    #region CreateUserAsync Tests

    [Fact]
    public async Task CreateUserAsync_WithValidData_ShouldCreateUser()
    {
        var user = await _authService.CreateUserAsync("newuser", "New User", "password123", 1);

        Assert.NotNull(user);
        Assert.Equal("newuser", user.Username);
        Assert.Equal("New User", user.FullName);
        Assert.Equal(1, user.RoleId);
        Assert.True(user.IsActive);
        Assert.True(user.MustChangePassword);
    }

    [Fact]
    public async Task CreateUserAsync_WithDuplicateUsername_ShouldThrowException()
    {
        await _authService.CreateUserAsync("duplicate", "User 1", "password", 1);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _authService.CreateUserAsync("duplicate", "User 2", "password", 1));
    }

    [Fact]
    public async Task CreateUserAsync_WithDuplicateUsernameDifferentCase_ShouldThrowException()
    {
        await _authService.CreateUserAsync("testuser", "User 1", "password", 1);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _authService.CreateUserAsync("TESTUSER", "User 2", "password", 1));
    }

    [Fact]
    public async Task CreateUserAsync_WithInvalidRoleId_ShouldThrowException()
    {
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _authService.CreateUserAsync("newuser", "New User", "password", 999));
    }

    #endregion

    #region ValidateUserAsync Tests

    [Fact]
    public async Task ValidateUserAsync_WithCorrectCredentials_ShouldReturnUser()
    {
        await _authService.CreateUserAsync("logintest", "Login Test", "password123", 1);

        var user = await _authService.ValidateUserAsync("logintest", "password123");

        Assert.NotNull(user);
        Assert.Equal("logintest", user.Username);
    }

    [Fact]
    public async Task ValidateUserAsync_WithWrongPassword_ShouldReturnNull()
    {
        await _authService.CreateUserAsync("logintest2", "Login Test", "password123", 1);

        var user = await _authService.ValidateUserAsync("logintest2", "wrongpassword");

        Assert.Null(user);
    }

    [Fact]
    public async Task ValidateUserAsync_WithNonexistentUser_ShouldReturnNull()
    {
        var user = await _authService.ValidateUserAsync("nonexistent", "password");

        Assert.Null(user);
    }

    [Fact]
    public async Task ValidateUserAsync_WithInactiveUser_ShouldReturnNull()
    {
        var createdUser = await _authService.CreateUserAsync("inactiveuser", "Inactive", "password123", 1);
        await _authService.DeactivateUserAsync(createdUser.Id);

        var user = await _authService.ValidateUserAsync("inactiveuser", "password123");

        Assert.Null(user);
    }

    [Fact]
    public async Task ValidateUserAsync_ShouldBeCaseInsensitive()
    {
        await _authService.CreateUserAsync("casetest", "Case Test", "password123", 1);

        var user = await _authService.ValidateUserAsync("CASETEST", "password123");

        Assert.NotNull(user);
    }

    #endregion

    #region ChangePasswordAsync Tests

    [Fact]
    public async Task ForceChangePasswordAsync_WithCorrectCurrentPassword_ShouldSucceed()
    {
        var user = await _authService.CreateUserAsync("changepass", "Change Pass", "oldpass", 1);

        var result = await _authService.ForceChangePasswordAsync(user.Id, "oldpass", "newpass");

        Assert.True(result);

        // Verify new password works
        var validatedUser = await _authService.ValidateUserAsync("changepass", "newpass");
        Assert.NotNull(validatedUser);
        Assert.False(validatedUser.MustChangePassword);
    }

    [Fact]
    public async Task ForceChangePasswordAsync_WithWrongCurrentPassword_ShouldFail()
    {
        var user = await _authService.CreateUserAsync("changepass2", "Change Pass", "oldpass", 1);

        var result = await _authService.ForceChangePasswordAsync(user.Id, "wrongpass", "newpass");

        Assert.False(result);
    }

    [Fact]
    public async Task ResetPasswordAsync_ShouldSetMustChangePasswordFlag()
    {
        var user = await _authService.CreateUserAsync("resetpass", "Reset Pass", "password", 1);
        // Clear the must change flag first
        user.MustChangePassword = false;
        await _context.SaveChangesAsync();

        await _authService.ResetPasswordAsync(user.Id, "newpassword");

        var updatedUser = await _authService.GetUserByIdAsync(user.Id);
        Assert.True(updatedUser!.MustChangePassword);
    }

    #endregion

    #region Role Management Tests

    [Fact]
    public async Task GetRoleByNameAsync_ShouldBeCaseInsensitive()
    {
        var role = await _authService.GetRoleByNameAsync("VIEWER");

        Assert.NotNull(role);
        Assert.Equal("viewer", role.Name);
    }

    [Fact]
    public async Task GetDefaultRoleAsync_ShouldReturnDefaultRole()
    {
        var role = await _authService.GetDefaultRoleAsync();

        Assert.NotNull(role);
        Assert.True(role.IsDefault);
    }

    [Fact]
    public async Task SetDefaultRoleAsync_ShouldUpdateDefaultRole()
    {
        await _authService.SetDefaultRoleAsync(2); // Set editor as default

        var oldDefault = await _authService.GetRoleByIdAsync(1);
        var newDefault = await _authService.GetRoleByIdAsync(2);

        Assert.False(oldDefault!.IsDefault);
        Assert.True(newDefault!.IsDefault);
    }

    [Fact]
    public async Task CreateRoleAsync_WithDuplicateName_ShouldThrowException()
    {
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _authService.CreateRoleAsync(new Role { Name = "viewer", DisplayName = "Duplicate" }));
    }

    [Fact]
    public async Task DeleteRoleAsync_WithSystemRole_ShouldThrowException()
    {
        var role = await _authService.GetRoleByNameAsync("viewer");
        role!.IsSystemRole = true;
        await _context.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _authService.DeleteRoleAsync(role.Id));
    }

    #endregion

    #region Deactivate/Activate User Tests

    [Fact]
    public async Task DeactivateUserAsync_ShouldSetIsActiveToFalse()
    {
        var user = await _authService.CreateUserAsync("deactivate", "Deactivate", "password", 1);

        var result = await _authService.DeactivateUserAsync(user.Id);

        Assert.True(result);
        var updatedUser = await _authService.GetUserByIdAsync(user.Id);
        Assert.False(updatedUser!.IsActive);
    }

    [Fact]
    public async Task ActivateUserAsync_ShouldSetIsActiveToTrue()
    {
        var user = await _authService.CreateUserAsync("activate", "Activate", "password", 1);
        await _authService.DeactivateUserAsync(user.Id);

        var result = await _authService.ActivateUserAsync(user.Id);

        Assert.True(result);
        var updatedUser = await _authService.GetUserByIdAsync(user.Id);
        Assert.True(updatedUser!.IsActive);
    }

    #endregion
}
