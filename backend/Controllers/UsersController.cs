using Microsoft.AspNetCore.Mvc;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Services;

namespace MusicasIgreja.Api.Controllers;

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
