using Microsoft.AspNetCore.Mvc;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Models;
using MusicasIgreja.Api.Services;

namespace MusicasIgreja.Api.Controllers;

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
