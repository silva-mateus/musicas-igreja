using Microsoft.AspNetCore.Mvc;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Services;
using MusicasIgreja.Api.Helpers;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IRateLimitService _rateLimitService;
    private readonly IMonitoringService _monitoringService;
    private readonly IAppInstanceService _appInstanceService;
    private readonly ILogger<AuthController> _logger;
    private readonly IWebHostEnvironment _environment;

    public AuthController(
        IAuthService authService, 
        IRateLimitService rateLimitService, 
        IMonitoringService monitoringService, 
        IAppInstanceService appInstanceService,
        ILogger<AuthController> logger, 
        IWebHostEnvironment environment)
    {
        _authService = authService;
        _rateLimitService = rateLimitService;
        _monitoringService = monitoringService;
        _appInstanceService = appInstanceService;
        _logger = logger;
        _environment = environment;
    }

    [HttpPost("login")]
    public async Task<ActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { success = false, error = "Username e password são obrigatórios" });

        // Rate limiting - Use IP + Username as key
        var clientIp = AuthHelper.GetClientIp(HttpContext);
        var rateLimitKey = $"login:{clientIp}:{request.Username.ToLower()}";
        
        if (_rateLimitService.IsRateLimited(rateLimitKey))
        {
            _logger.LogWarning(
                "[Auth] Rate limit exceeded for login attempt - User: {Username}, IP: {IP}",
                request.Username, clientIp);
            
            // Log security event
            await _monitoringService.LogSecurityEventAsync(
                "rate_limit_exceeded",
                "high",
                $"Rate limit exceeded for user {request.Username}",
                null,
                clientIp,
                HttpContext.Request.Headers["User-Agent"].ToString()
            );
            
            return StatusCode(429, new 
            { 
                success = false, 
                error = "Muitas tentativas de login. Tente novamente em 15 minutos." 
            });
        }

        _logger.LogInformation("[Auth] Login attempt for user: {Username} from IP: {IP}", request.Username, clientIp);

        var user = await _authService.ValidateUserAsync(request.Username, request.Password);

        if (user == null)
        {
            // Record failed attempt for rate limiting
            _rateLimitService.RecordAttempt(rateLimitKey);
            
            _logger.LogWarning(
                "[Auth] Login failed for user: {Username} from IP: {IP}",
                request.Username, clientIp);
            
            // Log security event
            await _monitoringService.LogSecurityEventAsync(
                "login_failed",
                "medium",
                $"Failed login attempt for user {request.Username}",
                null,
                clientIp,
                HttpContext.Request.Headers["User-Agent"].ToString()
            );
            
            return Unauthorized(new { success = false, error = "Credenciais inválidas" });
        }

        // Login successful - reset rate limit
        _rateLimitService.ResetAttempts(rateLimitKey);
        
        // Criar sessão
        HttpContext.Session.SetInt32("UserId", user.Id);
        HttpContext.Session.SetInt32("RoleId", user.RoleId);
        HttpContext.Session.SetString("RoleName", user.Role?.Name ?? "viewer");
        HttpContext.Session.SetString("Username", user.Username); // Store username for audit
        HttpContext.Session.SetString("LastActivity", DateTime.UtcNow.ToString("O"));
        
        _logger.LogInformation(
            "[Auth] Login successful for user: {Username} (ID: {UserId}) from IP: {IP}",
            request.Username, user.Id, clientIp);
        
        // Log audit action for successful login
        await _monitoringService.LogAuditActionAsync(
            "login",
            "auth",
            user.Id,
            user.Id,
            user.Username,
            clientIp
        );

        return Ok(new
        {
            success = true,
            message = "Login realizado com sucesso",
            instance_id = _appInstanceService.InstanceId,
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
            instance_id = _appInstanceService.InstanceId,
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

    [HttpPut("profile")]
    public async Task<ActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var userId = HttpContext.Session.GetInt32("UserId");

        if (userId == null)
            return Unauthorized(new { success = false, error = "Não autenticado" });

        if (string.IsNullOrWhiteSpace(request.FullName))
            return BadRequest(new { success = false, error = "Nome é obrigatório" });

        if (request.FullName.Length < 2)
            return BadRequest(new { success = false, error = "Nome deve ter pelo menos 2 caracteres" });

        var result = await _authService.UpdateUserAsync(userId.Value, request.FullName, null);

        if (!result)
            return BadRequest(new { success = false, error = "Erro ao atualizar perfil" });

        // Return updated user data
        var user = await _authService.GetUserWithRoleAsync(userId.Value);
        
        return Ok(new
        {
            success = true,
            message = "Perfil atualizado com sucesso",
            user = new
            {
                id = user!.Id,
                username = user.Username,
                full_name = user.FullName,
                role = user.Role?.Name ?? "viewer",
                role_id = user.RoleId,
                is_active = user.IsActive
            }
        });
    }
}
