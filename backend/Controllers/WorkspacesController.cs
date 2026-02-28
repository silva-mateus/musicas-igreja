using Core.Auth.Helpers;
using Core.Auth.Services;
using Microsoft.AspNetCore.Mvc;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Services.Interfaces;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/workspaces")]
public class WorkspacesController : ControllerBase
{
    private readonly IWorkspaceService _workspaceService;
    private readonly ICoreAuthService _authService;

    public WorkspacesController(IWorkspaceService workspaceService, ICoreAuthService authService)
    {
        _workspaceService = workspaceService;
        _authService = authService;
    }

    [HttpGet]
    public async Task<ActionResult<List<WorkspaceDto>>> GetWorkspaces()
    {
        var workspaces = await _workspaceService.GetAllAsync();
        return Ok(workspaces);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<WorkspaceDto>> GetWorkspace(int id)
    {
        var workspace = await _workspaceService.GetByIdAsync(id);
        if (workspace == null) return NotFound(new { success = false, error = "Workspace não encontrado" });
        return Ok(workspace);
    }

    [HttpPost]
    public async Task<ActionResult<WorkspaceDto>> CreateWorkspace([FromBody] CreateWorkspaceDto dto)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.AccessAdmin))
            return StatusCode(403, new { error = "Sem permissão" });

        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { success = false, error = "Nome é obrigatório" });

        try
        {
            var workspace = await _workspaceService.CreateAsync(dto);
            return StatusCode(201, workspace);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { success = false, error = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<object>> UpdateWorkspace(int id, [FromBody] UpdateWorkspaceDto dto)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.AccessAdmin))
            return StatusCode(403, new { error = "Sem permissão" });

        try
        {
            var success = await _workspaceService.UpdateAsync(id, dto);
            if (!success) return NotFound(new { success = false, error = "Workspace não encontrado" });
            return Ok(new { success = true });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { success = false, error = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<object>> DeleteWorkspace(int id)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.AccessAdmin))
            return StatusCode(403, new { error = "Sem permissão" });

        var success = await _workspaceService.DeleteAsync(id);
        if (!success) return BadRequest(new { success = false, error = "Workspace não pode ser deletado (possui músicas ou não foi encontrado)" });
        return Ok(new { success = true });
    }
}
