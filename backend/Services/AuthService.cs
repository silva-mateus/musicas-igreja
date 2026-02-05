using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.Models;

namespace MusicasIgreja.Api.Services;

public interface IAuthService
{
    Task<User?> ValidateUserAsync(string username, string password);
    Task<User?> GetUserByIdAsync(int id);
    Task<User?> GetUserWithRoleAsync(int id);
    Task<User> CreateUserAsync(string username, string fullName, string password, int roleId);
    Task<bool> ChangePasswordAsync(int userId, string newPassword, bool clearMustChange = true);
    Task<bool> ForceChangePasswordAsync(int userId, string currentPassword, string newPassword);
    Task<bool> ResetPasswordAsync(int userId, string newPassword);
    Task<List<User>> GetAllUsersAsync();
    Task<bool> UpdateUserRoleAsync(int userId, int roleId);
    Task<bool> UpdateUserAsync(int userId, string? fullName, int? roleId);
    Task<bool> DeactivateUserAsync(int userId);
    Task<bool> ActivateUserAsync(int userId);
    Task<bool> DeleteUserAsync(int userId);
    Task<Role?> GetRoleByIdAsync(int id);
    Task<Role?> GetRoleByNameAsync(string name);
    Task<Role?> GetDefaultRoleAsync();
    Task<List<Role>> GetAllRolesAsync();
    Task<Role> CreateRoleAsync(Role role);
    Task<bool> UpdateRoleAsync(Role role);
    Task<bool> DeleteRoleAsync(int roleId);
    Task<bool> SetDefaultRoleAsync(int roleId);
    string HashPassword(string password);
    bool VerifyPassword(string password, string hash);
    Task MigratePasswordHashesAsync();
}

public class AuthService : IAuthService
{
    private readonly AppDbContext _context;
    private readonly ILogger<AuthService> _logger;

    // BCrypt work factor (10-12 is recommended for production)
    private const int BcryptWorkFactor = 12;

    public AuthService(AppDbContext context, ILogger<AuthService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<User?> ValidateUserAsync(string username, string password)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower() && u.IsActive);

        if (user == null)
            return null;

        if (!VerifyPassword(password, user.PasswordHash))
            return null;

        // Migrate legacy SHA256 hash to BCrypt on successful login
        if (!user.PasswordHash.StartsWith("$2"))
        {
            user.PasswordHash = HashPassword(password);
            _logger.LogInformation("Migrated password hash from SHA256 to BCrypt for user {Username}", user.Username);
        }

        // Update last login
        user.LastLoginDate = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return user;
    }

    public async Task<User?> GetUserByIdAsync(int id)
    {
        return await _context.Users.FindAsync(id);
    }

    public async Task<User?> GetUserWithRoleAsync(int id)
    {
        return await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == id);
    }

    public async Task<User> CreateUserAsync(string username, string fullName, string password, int roleId)
    {
        // Check if username exists
        var existingUser = await _context.Users
            .FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower());

        if (existingUser != null)
            throw new InvalidOperationException("Username já existe");

        // Verify role exists
        var role = await _context.Roles.FindAsync(roleId);
        if (role == null)
            throw new InvalidOperationException("Role não encontrada");

        var user = new User
        {
            Username = username,
            FullName = fullName,
            PasswordHash = HashPassword(password),
            RoleId = roleId,
            IsActive = true,
            MustChangePassword = true,
            CreatedDate = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        _logger.LogInformation("User created: {Username} ({FullName}) with role {RoleId}", username, fullName, roleId);

        return user;
    }

    public async Task<bool> ChangePasswordAsync(int userId, string newPassword, bool clearMustChange = true)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return false;

        user.PasswordHash = HashPassword(newPassword);
        if (clearMustChange)
            user.MustChangePassword = false;
        
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ForceChangePasswordAsync(int userId, string currentPassword, string newPassword)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return false;

        if (!VerifyPassword(currentPassword, user.PasswordHash))
            return false;

        user.PasswordHash = HashPassword(newPassword);
        user.MustChangePassword = false;
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> UpdateUserAsync(int userId, string? fullName, int? roleId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return false;

        if (fullName != null)
            user.FullName = fullName;
        if (roleId.HasValue)
        {
            var role = await _context.Roles.FindAsync(roleId.Value);
            if (role == null)
                return false;
            user.RoleId = roleId.Value;
        }

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<List<User>> GetAllUsersAsync()
    {
        return await _context.Users
            .Include(u => u.Role)
            .OrderBy(u => u.Username)
            .ToListAsync();
    }

    public async Task<bool> UpdateUserRoleAsync(int userId, int roleId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return false;

        var role = await _context.Roles.FindAsync(roleId);
        if (role == null)
            return false;

        user.RoleId = roleId;
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> DeactivateUserAsync(int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return false;

        user.IsActive = false;
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> ActivateUserAsync(int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return false;

        user.IsActive = true;
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> DeleteUserAsync(int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return false;

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();

        _logger.LogInformation("User permanently deleted: {UserId}", userId);
        return true;
    }

    public async Task<bool> ResetPasswordAsync(int userId, string newPassword)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return false;

        user.PasswordHash = HashPassword(newPassword);
        user.MustChangePassword = true;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Password reset for user {UserId}, must change on next login", userId);
        return true;
    }

    // Role management
    public async Task<Role?> GetRoleByIdAsync(int id)
    {
        return await _context.Roles.FindAsync(id);
    }

    public async Task<Role?> GetRoleByNameAsync(string name)
    {
        return await _context.Roles.FirstOrDefaultAsync(r => r.Name.ToLower() == name.ToLower());
    }

    public async Task<List<Role>> GetAllRolesAsync()
    {
        return await _context.Roles
            .Include(r => r.Users)
            .OrderByDescending(r => r.Priority)
            .ToListAsync();
    }

    public async Task<Role?> GetDefaultRoleAsync()
    {
        return await _context.Roles.FirstOrDefaultAsync(r => r.IsDefault);
    }

    public async Task<Role> CreateRoleAsync(Role role)
    {
        var existing = await _context.Roles.FirstOrDefaultAsync(r => r.Name.ToLower() == role.Name.ToLower());
        if (existing != null)
            throw new InvalidOperationException("Role já existe");

        _context.Roles.Add(role);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Role created: {Name}", role.Name);
        return role;
    }

    public async Task<bool> UpdateRoleAsync(Role updatedRole)
    {
        var role = await _context.Roles.FindAsync(updatedRole.Id);
        if (role == null)
            return false;

        // Update all fields except Id and IsSystemRole
        role.Name = updatedRole.Name;
        role.DisplayName = updatedRole.DisplayName;
        role.Description = updatedRole.Description;
        role.Priority = updatedRole.Priority;
        role.CanViewMusic = updatedRole.CanViewMusic;
        role.CanDownloadMusic = updatedRole.CanDownloadMusic;
        role.CanEditMusicMetadata = updatedRole.CanEditMusicMetadata;
        role.CanUploadMusic = updatedRole.CanUploadMusic;
        role.CanDeleteMusic = updatedRole.CanDeleteMusic;
        role.CanManageLists = updatedRole.CanManageLists;
        role.CanManageCategories = updatedRole.CanManageCategories;
        role.CanManageUsers = updatedRole.CanManageUsers;
        role.CanManageRoles = updatedRole.CanManageRoles;
        role.CanAccessAdmin = updatedRole.CanAccessAdmin;

        await _context.SaveChangesAsync();
        _logger.LogInformation("Role updated: {Name}", role.Name);
        return true;
    }

    public async Task<bool> DeleteRoleAsync(int roleId)
    {
        var role = await _context.Roles
            .Include(r => r.Users)
            .FirstOrDefaultAsync(r => r.Id == roleId);

        if (role == null)
            return false;

        if (role.IsSystemRole)
            throw new InvalidOperationException("Roles do sistema não podem ser deletadas");

        if (role.IsDefault)
            throw new InvalidOperationException("A role padrão não pode ser deletada. Defina outra role como padrão primeiro.");

        // Reassign users to default role
        if (role.Users.Any())
        {
            var defaultRole = await GetDefaultRoleAsync();
            if (defaultRole == null)
                throw new InvalidOperationException("Não há role padrão definida. Defina uma role padrão antes de excluir.");

            foreach (var user in role.Users)
            {
                user.RoleId = defaultRole.Id;
            }
            await _context.SaveChangesAsync();
            _logger.LogInformation("Reassigned {Count} users from role {OldRole} to default role {NewRole}", 
                role.Users.Count, role.Name, defaultRole.Name);
        }

        _context.Roles.Remove(role);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Role deleted: {Name}", role.Name);
        return true;
    }

    public async Task<bool> SetDefaultRoleAsync(int roleId)
    {
        var role = await _context.Roles.FindAsync(roleId);
        if (role == null)
            return false;

        // Remove default from all other roles
        var allRoles = await _context.Roles.ToListAsync();
        foreach (var r in allRoles)
        {
            r.IsDefault = r.Id == roleId;
        }

        await _context.SaveChangesAsync();
        _logger.LogInformation("Role {Name} set as default", role.Name);
        return true;
    }

    /// <summary>
    /// Hash password using BCrypt with salt
    /// </summary>
    public string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password, BcryptWorkFactor);
    }

    /// <summary>
    /// Verify password against BCrypt hash. Also supports legacy SHA256 hashes for migration.
    /// </summary>
    public bool VerifyPassword(string password, string hash)
    {
        // Check if it's a BCrypt hash (starts with $2a$, $2b$, or $2y$)
        if (hash.StartsWith("$2"))
        {
            try
            {
                return BCrypt.Net.BCrypt.Verify(password, hash);
            }
            catch
            {
                return false;
            }
        }
        
        // Legacy SHA256 hash support (for migration)
        var legacyHash = HashPasswordLegacy(password);
        return legacyHash == hash;
    }

    /// <summary>
    /// Legacy SHA256 hash for backwards compatibility during migration
    /// </summary>
    private static string HashPasswordLegacy(string password)
    {
        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var bytes = System.Text.Encoding.UTF8.GetBytes(password);
        var hashBytes = sha256.ComputeHash(bytes);
        return Convert.ToBase64String(hashBytes);
    }

    /// <summary>
    /// Migrate all users with legacy SHA256 hashes to BCrypt
    /// Should be called on application startup
    /// </summary>
    public async Task MigratePasswordHashesAsync()
    {
        var users = await _context.Users.ToListAsync();
        var migratedCount = 0;

        foreach (var user in users)
        {
            // If the hash doesn't start with $2, it's a legacy SHA256 hash
            if (!user.PasswordHash.StartsWith("$2"))
            {
                // We can't migrate without knowing the password, so we'll mark for password reset
                // Or we keep the legacy hash and it will be migrated on next login
                _logger.LogWarning("User {Username} has legacy password hash. Will be migrated on next login.", user.Username);
            }
        }

        if (migratedCount > 0)
        {
            _logger.LogInformation("Migrated {Count} password hashes to BCrypt", migratedCount);
        }
    }
}
