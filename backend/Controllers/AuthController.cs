using Microsoft.AspNetCore.Mvc;
using MusicasIgreja.Api.Models;
using MusicasIgreja.Api.Services;
using System.Text.Json.Serialization;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    [HttpGet("debug-hash")]
    public ActionResult DebugHash([FromQuery] string password = "admin123")
    {
        var hash = _authService.HashPassword(password);
        return Ok(new { 
            password = password, 
            hash = hash,
            expected_admin_hash = "jZae727K08KaOmKSgOaGzww/XVqGr/PKEgIMkjrcbJI=",
            matches = hash == "jZae727K08KaOmKSgOaGzww/XVqGr/PKEgIMkjrcbJI="
        });
    }

    [HttpGet("debug-users")]
    public async Task<ActionResult> DebugUsers()
    {
        var users = await _authService.GetAllUsersAsync();
        return Ok(new
        {
            count = users.Count,
            users = users.Select(u => new
            {
                id = u.Id,
                username = u.Username,
                full_name = u.FullName,
                password_hash_preview = u.PasswordHash.Length > 20 ? u.PasswordHash.Substring(0, 20) + "..." : u.PasswordHash,
                password_hash_length = u.PasswordHash.Length,
                role_id = u.RoleId,
                role_name = u.Role?.Name ?? "unknown",
                is_active = u.IsActive,
                must_change_password = u.MustChangePassword
            })
        });
    }

    [HttpPost("reset-admin")]
    public async Task<ActionResult> ResetAdmin()
    {
        var users = await _authService.GetAllUsersAsync();
        var admin = users.FirstOrDefault(u => u.Username.ToLower() == "admin");
        
        if (admin != null)
        {
            await _authService.ResetPasswordAsync(admin.Id, "admin123");
            return Ok(new { success = true, message = "Admin password reset to 'admin123'" });
        }
        
        return NotFound(new { success = false, error = "Admin user not found" });
    }

    [HttpPost("login")]
    public async Task<ActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { success = false, error = "Username e password são obrigatórios" });

        _logger.LogInformation("Login attempt for user: {Username}", request.Username);

        var user = await _authService.ValidateUserAsync(request.Username, request.Password);

        if (user == null)
        {
            _logger.LogWarning("Login failed for user: {Username}", request.Username);
            return Unauthorized(new { success = false, error = "Credenciais inválidas" });
        }

        HttpContext.Session.SetInt32("UserId", user.Id);
        HttpContext.Session.SetInt32("RoleId", user.RoleId);
        HttpContext.Session.SetString("RoleName", user.Role?.Name ?? "viewer");

        return Ok(new
        {
            success = true,
            message = "Login realizado com sucesso",
            must_change_password = user.MustChangePassword,
            user = new
            {
                id = user.Id,
                username = user.Username,
                full_name = user.FullName,
                role = user.Role?.Name ?? "viewer",
                role_id = user.RoleId,
                is_active = user.IsActive,
                permissions = user.Role != null ? new
                {
                    can_view_music = user.Role.CanViewMusic,
                    can_download_music = user.Role.CanDownloadMusic,
                    can_edit_music_metadata = user.Role.CanEditMusicMetadata,
                    can_upload_music = user.Role.CanUploadMusic,
                    can_delete_music = user.Role.CanDeleteMusic,
                    can_manage_lists = user.Role.CanManageLists,
                    can_manage_categories = user.Role.CanManageCategories,
                    can_manage_users = user.Role.CanManageUsers,
                    can_manage_roles = user.Role.CanManageRoles,
                    can_access_admin = user.Role.CanAccessAdmin
                } : null
            }
        });
    }

    [HttpPost("logout")]
    public ActionResult Logout()
    {
        HttpContext.Session.Clear();
        return Ok(new { success = true, message = "Logout realizado com sucesso" });
    }

    [HttpGet("me")]
    public async Task<ActionResult> GetCurrentUser()
    {
        var userId = HttpContext.Session.GetInt32("UserId");

        if (userId == null)
            return Unauthorized(new { success = false, error = "Não autenticado" });

        var user = await _authService.GetUserWithRoleAsync(userId.Value);

        if (user == null || !user.IsActive)
        {
            HttpContext.Session.Clear();
            return Unauthorized(new { success = false, error = "Usuário não encontrado" });
        }

        return Ok(new
        {
            success = true,
            user = new
            {
                id = user.Id,
                username = user.Username,
                full_name = user.FullName,
                role = user.Role?.Name ?? "viewer",
                role_id = user.RoleId,
                is_active = user.IsActive,
                must_change_password = user.MustChangePassword,
                created_at = user.CreatedDate,
                last_login = user.LastLoginDate,
                permissions = user.Role != null ? new
                {
                    can_view_music = user.Role.CanViewMusic,
                    can_download_music = user.Role.CanDownloadMusic,
                    can_edit_music_metadata = user.Role.CanEditMusicMetadata,
                    can_upload_music = user.Role.CanUploadMusic,
                    can_delete_music = user.Role.CanDeleteMusic,
                    can_manage_lists = user.Role.CanManageLists,
                    can_manage_categories = user.Role.CanManageCategories,
                    can_manage_users = user.Role.CanManageUsers,
                    can_manage_roles = user.Role.CanManageRoles,
                    can_access_admin = user.Role.CanAccessAdmin
                } : null
            }
        });
    }

    [HttpPost("change-password")]
    public async Task<ActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = HttpContext.Session.GetInt32("UserId");

        if (userId == null)
            return Unauthorized(new { success = false, error = "Não autenticado" });

        if (string.IsNullOrWhiteSpace(request.CurrentPassword) || string.IsNullOrWhiteSpace(request.NewPassword))
            return BadRequest(new { success = false, error = "Senha atual e nova são obrigatórias" });

        if (request.NewPassword.Length < 4)
            return BadRequest(new { success = false, error = "Nova senha deve ter pelo menos 4 caracteres" });

        var result = await _authService.ForceChangePasswordAsync(userId.Value, request.CurrentPassword, request.NewPassword);

        if (!result)
            return BadRequest(new { success = false, error = "Senha atual incorreta" });

        return Ok(new { success = true, message = "Senha alterada com sucesso" });
    }
}

[ApiController]
[Route("api/users")]
public class UsersController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<UsersController> _logger;

    public UsersController(IAuthService authService, ILogger<UsersController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    private async Task<bool> CanManageUsersAsync()
    {
        var roleId = HttpContext.Session.GetInt32("RoleId");
        if (roleId == null) return false;
        
        var role = await _authService.GetRoleByIdAsync(roleId.Value);
        return role?.CanManageUsers ?? false;
    }

    [HttpGet]
    public async Task<ActionResult> GetUsers()
    {
        if (!await CanManageUsersAsync())
            return Forbid();

        var users = await _authService.GetAllUsersAsync();

        return Ok(new
        {
            success = true,
            users = users.Select(u => new
            {
                id = u.Id,
                username = u.Username,
                full_name = u.FullName,
                role = u.Role?.Name ?? "viewer",
                role_id = u.RoleId,
                role_display_name = u.Role?.DisplayName ?? "Visualizador",
                is_active = u.IsActive,
                must_change_password = u.MustChangePassword,
                created_at = u.CreatedDate,
                last_login = u.LastLoginDate
            })
        });
    }

    [HttpPost]
    public async Task<ActionResult> CreateUser([FromBody] CreateUserRequest request)
    {
        if (!await CanManageUsersAsync())
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { success = false, error = "Username e password são obrigatórios" });

        if (request.Password.Length < 4)
            return BadRequest(new { success = false, error = "Senha deve ter pelo menos 4 caracteres" });

        try
        {
            // Get role ID from name or use provided role_id
            int roleId = request.RoleId ?? 1; // Default to Viewer
            
            if (!string.IsNullOrEmpty(request.Role))
            {
                var role = await _authService.GetRoleByNameAsync(request.Role);
                if (role != null)
                    roleId = role.Id;
            }

            var user = await _authService.CreateUserAsync(
                request.Username,
                request.FullName ?? request.Username,
                request.Password,
                roleId
            );

            // Reload user with role
            var userWithRole = await _authService.GetUserWithRoleAsync(user.Id);

            return StatusCode(201, new
            {
                success = true,
                user = new
                {
                    id = userWithRole!.Id,
                    username = userWithRole.Username,
                    full_name = userWithRole.FullName,
                    role = userWithRole.Role?.Name ?? "viewer",
                    role_id = userWithRole.RoleId
                }
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { success = false, error = ex.Message });
        }
    }

    [HttpPut("{id}/role")]
    public async Task<ActionResult> UpdateUserRole(int id, [FromBody] UpdateRoleRequest request)
    {
        if (!await CanManageUsersAsync())
            return Forbid();

        int roleId = request.RoleId ?? 1;
        
        if (!string.IsNullOrEmpty(request.Role))
        {
            var role = await _authService.GetRoleByNameAsync(request.Role);
            if (role != null)
                roleId = role.Id;
            else
                return BadRequest(new { success = false, error = "Role não encontrada" });
        }

        var result = await _authService.UpdateUserRoleAsync(id, roleId);

        if (!result)
            return NotFound(new { success = false, error = "Usuário não encontrado" });

        return Ok(new { success = true, message = "Role atualizada com sucesso" });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeactivateUser(int id)
    {
        if (!await CanManageUsersAsync())
            return Forbid();

        var currentUserId = HttpContext.Session.GetInt32("UserId");
        if (currentUserId == id)
            return BadRequest(new { success = false, error = "Não é possível desativar a própria conta" });

        var result = await _authService.DeactivateUserAsync(id);

        if (!result)
            return NotFound(new { success = false, error = "Usuário não encontrado" });

        return Ok(new { success = true, message = "Usuário desativado com sucesso" });
    }

    [HttpDelete("{id}/permanent")]
    public async Task<ActionResult> DeleteUserPermanently(int id)
    {
        if (!await CanManageUsersAsync())
            return Forbid();

        var currentUserId = HttpContext.Session.GetInt32("UserId");
        if (currentUserId == id)
            return BadRequest(new { success = false, error = "Não é possível excluir a própria conta" });

        var result = await _authService.DeleteUserAsync(id);

        if (!result)
            return NotFound(new { success = false, error = "Usuário não encontrado" });

        return Ok(new { success = true, message = "Usuário excluído permanentemente" });
    }

    [HttpPost("{id}/reset-password")]
    public async Task<ActionResult> ResetPassword(int id, [FromBody] ResetPasswordRequest request)
    {
        if (!await CanManageUsersAsync())
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.NewPassword))
            return BadRequest(new { success = false, error = "Nova senha é obrigatória" });

        if (request.NewPassword.Length < 4)
            return BadRequest(new { success = false, error = "Senha deve ter pelo menos 4 caracteres" });

        var result = await _authService.ResetPasswordAsync(id, request.NewPassword);

        if (!result)
            return NotFound(new { success = false, error = "Usuário não encontrado" });

        return Ok(new { success = true, message = "Senha resetada com sucesso" });
    }

    [HttpPut("{id}/activate")]
    public async Task<ActionResult> ActivateUser(int id)
    {
        if (!await CanManageUsersAsync())
            return Forbid();

        var result = await _authService.ActivateUserAsync(id);

        if (!result)
            return NotFound(new { success = false, error = "Usuário não encontrado" });

        return Ok(new { success = true, message = "Usuário ativado com sucesso" });
    }
}

[ApiController]
[Route("api/roles")]
public class RolesController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<RolesController> _logger;

    public RolesController(IAuthService authService, ILogger<RolesController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    private async Task<bool> CanManageRolesAsync()
    {
        var roleId = HttpContext.Session.GetInt32("RoleId");
        if (roleId == null) return false;
        
        var role = await _authService.GetRoleByIdAsync(roleId.Value);
        return role?.CanManageRoles ?? false;
    }

    [HttpGet]
    public async Task<ActionResult> GetRoles()
    {
        var roles = await _authService.GetAllRolesAsync();

        return Ok(new
        {
            success = true,
            roles = roles.Select(r => new
            {
                id = r.Id,
                name = r.Name,
                display_name = r.DisplayName,
                description = r.Description,
                is_system_role = r.IsSystemRole,
                is_default = r.IsDefault,
                priority = r.Priority,
                user_count = r.Users?.Count ?? 0,
                permissions = new
                {
                    can_view_music = r.CanViewMusic,
                    can_download_music = r.CanDownloadMusic,
                    can_edit_music_metadata = r.CanEditMusicMetadata,
                    can_upload_music = r.CanUploadMusic,
                    can_delete_music = r.CanDeleteMusic,
                    can_manage_lists = r.CanManageLists,
                    can_manage_categories = r.CanManageCategories,
                    can_manage_users = r.CanManageUsers,
                    can_manage_roles = r.CanManageRoles,
                    can_access_admin = r.CanAccessAdmin
                }
            })
        });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult> GetRole(int id)
    {
        var role = await _authService.GetRoleByIdAsync(id);
        
        if (role == null)
            return NotFound(new { success = false, error = "Role não encontrada" });

        return Ok(new
        {
            success = true,
            role = new
            {
                id = role.Id,
                name = role.Name,
                display_name = role.DisplayName,
                description = role.Description,
                is_system_role = role.IsSystemRole,
                is_default = role.IsDefault,
                priority = role.Priority,
                permissions = new
                {
                    can_view_music = role.CanViewMusic,
                    can_download_music = role.CanDownloadMusic,
                    can_edit_music_metadata = role.CanEditMusicMetadata,
                    can_upload_music = role.CanUploadMusic,
                    can_delete_music = role.CanDeleteMusic,
                    can_manage_lists = role.CanManageLists,
                    can_manage_categories = role.CanManageCategories,
                    can_manage_users = role.CanManageUsers,
                    can_manage_roles = role.CanManageRoles,
                    can_access_admin = role.CanAccessAdmin
                }
            }
        });
    }

    [HttpPost("{id}/set-default")]
    public async Task<ActionResult> SetDefaultRole(int id)
    {
        if (!await CanManageRolesAsync())
            return Forbid();

        var result = await _authService.SetDefaultRoleAsync(id);
        
        if (!result)
            return NotFound(new { success = false, error = "Role não encontrada" });

        return Ok(new { success = true, message = "Role definida como padrão" });
    }

    [HttpPost]
    public async Task<ActionResult> CreateRole([FromBody] RoleRequest request)
    {
        if (!await CanManageRolesAsync())
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.DisplayName))
            return BadRequest(new { success = false, error = "Nome e nome de exibição são obrigatórios" });

        try
        {
            var role = new Role
            {
                Name = request.Name.ToLower().Replace(" ", "_"),
                DisplayName = request.DisplayName,
                Description = request.Description,
                IsSystemRole = false,
                Priority = request.Priority ?? 0,
                CanViewMusic = request.Permissions?.CanViewMusic ?? true,
                CanDownloadMusic = request.Permissions?.CanDownloadMusic ?? true,
                CanEditMusicMetadata = request.Permissions?.CanEditMusicMetadata ?? false,
                CanUploadMusic = request.Permissions?.CanUploadMusic ?? false,
                CanDeleteMusic = request.Permissions?.CanDeleteMusic ?? false,
                CanManageLists = request.Permissions?.CanManageLists ?? false,
                CanManageCategories = request.Permissions?.CanManageCategories ?? false,
                CanManageUsers = request.Permissions?.CanManageUsers ?? false,
                CanManageRoles = request.Permissions?.CanManageRoles ?? false,
                CanAccessAdmin = request.Permissions?.CanAccessAdmin ?? false
            };

            var created = await _authService.CreateRoleAsync(role);

            return StatusCode(201, new { success = true, role = new { id = created.Id, name = created.Name } });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { success = false, error = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateRole(int id, [FromBody] RoleRequest request)
    {
        if (!await CanManageRolesAsync())
            return Forbid();

        var existingRole = await _authService.GetRoleByIdAsync(id);
        if (existingRole == null)
            return NotFound(new { success = false, error = "Role não encontrada" });

        existingRole.DisplayName = request.DisplayName ?? existingRole.DisplayName;
        existingRole.Description = request.Description ?? existingRole.Description;
        existingRole.Priority = request.Priority ?? existingRole.Priority;
        
        if (request.Permissions != null)
        {
            existingRole.CanViewMusic = request.Permissions.CanViewMusic ?? existingRole.CanViewMusic;
            existingRole.CanDownloadMusic = request.Permissions.CanDownloadMusic ?? existingRole.CanDownloadMusic;
            existingRole.CanEditMusicMetadata = request.Permissions.CanEditMusicMetadata ?? existingRole.CanEditMusicMetadata;
            existingRole.CanUploadMusic = request.Permissions.CanUploadMusic ?? existingRole.CanUploadMusic;
            existingRole.CanDeleteMusic = request.Permissions.CanDeleteMusic ?? existingRole.CanDeleteMusic;
            existingRole.CanManageLists = request.Permissions.CanManageLists ?? existingRole.CanManageLists;
            existingRole.CanManageCategories = request.Permissions.CanManageCategories ?? existingRole.CanManageCategories;
            existingRole.CanManageUsers = request.Permissions.CanManageUsers ?? existingRole.CanManageUsers;
            existingRole.CanManageRoles = request.Permissions.CanManageRoles ?? existingRole.CanManageRoles;
            existingRole.CanAccessAdmin = request.Permissions.CanAccessAdmin ?? existingRole.CanAccessAdmin;
        }

        await _authService.UpdateRoleAsync(existingRole);

        return Ok(new { success = true, message = "Role atualizada com sucesso" });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteRole(int id)
    {
        if (!await CanManageRolesAsync())
            return Forbid();

        try
        {
            var result = await _authService.DeleteRoleAsync(id);
            
            if (!result)
                return NotFound(new { success = false, error = "Role não encontrada" });

            return Ok(new { success = true, message = "Role excluída com sucesso" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { success = false, error = ex.Message });
        }
    }
}

// Request DTOs
public class LoginRequest
{
    [JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;

    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;
}

public class ChangePasswordRequest
{
    [JsonPropertyName("current_password")]
    public string CurrentPassword { get; set; } = string.Empty;

    [JsonPropertyName("new_password")]
    public string NewPassword { get; set; } = string.Empty;
}

public class CreateUserRequest
{
    [JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;

    [JsonPropertyName("full_name")]
    public string? FullName { get; set; }

    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;

    [JsonPropertyName("role")]
    public string? Role { get; set; }

    [JsonPropertyName("role_id")]
    public int? RoleId { get; set; }
}

public class UpdateRoleRequest
{
    [JsonPropertyName("role")]
    public string? Role { get; set; }

    [JsonPropertyName("role_id")]
    public int? RoleId { get; set; }
}

public class ResetPasswordRequest
{
    [JsonPropertyName("new_password")]
    public string NewPassword { get; set; } = string.Empty;
}

public class RoleRequest
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("display_name")]
    public string? DisplayName { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("priority")]
    public int? Priority { get; set; }

    [JsonPropertyName("permissions")]
    public PermissionsRequest? Permissions { get; set; }
}

public class PermissionsRequest
{
    [JsonPropertyName("can_view_music")]
    public bool? CanViewMusic { get; set; }

    [JsonPropertyName("can_download_music")]
    public bool? CanDownloadMusic { get; set; }

    [JsonPropertyName("can_edit_music_metadata")]
    public bool? CanEditMusicMetadata { get; set; }

    [JsonPropertyName("can_upload_music")]
    public bool? CanUploadMusic { get; set; }

    [JsonPropertyName("can_delete_music")]
    public bool? CanDeleteMusic { get; set; }

    [JsonPropertyName("can_manage_lists")]
    public bool? CanManageLists { get; set; }

    [JsonPropertyName("can_manage_categories")]
    public bool? CanManageCategories { get; set; }

    [JsonPropertyName("can_manage_users")]
    public bool? CanManageUsers { get; set; }

    [JsonPropertyName("can_manage_roles")]
    public bool? CanManageRoles { get; set; }

    [JsonPropertyName("can_access_admin")]
    public bool? CanAccessAdmin { get; set; }
}
