using Microsoft.AspNetCore.Mvc;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Services;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;
    private readonly IWebHostEnvironment _environment;

    public AuthController(IAuthService authService, ILogger<AuthController> logger, IWebHostEnvironment environment)
    {
        _authService = authService;
        _logger = logger;
        _environment = environment;
    }

    /// <summary>
    /// Debug endpoint - Only available in Development environment.
    /// Generates a hash for a password for testing purposes.
    /// </summary>
    [HttpGet("debug-hash")]
    public ActionResult DebugHash([FromQuery] string password = "admin123")
    {
        // Only allow in development
        if (!_environment.IsDevelopment())
        {
            return NotFound();
        }

        var hash = _authService.HashPassword(password);
        return Ok(new { 
            password = password, 
            hash = hash,
            message = "This endpoint is only available in Development mode"
        });
    }

    /// <summary>
    /// Debug endpoint - Only available in Development environment.
    /// Lists all users with partial password hash info.
    /// </summary>
    [HttpGet("debug-users")]
    public async Task<ActionResult> DebugUsers()
    {
        // Only allow in development
        if (!_environment.IsDevelopment())
        {
            return NotFound();
        }

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

    /// <summary>
    /// Debug endpoint - Only available in Development environment.
    /// Resets admin password to default.
    /// </summary>
    [HttpPost("reset-admin")]
    public async Task<ActionResult> ResetAdmin()
    {
        // Only allow in development
        if (!_environment.IsDevelopment())
        {
            return NotFound();
        }

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
