using Core.Auth.Helpers;
using Core.Auth.Services;
using Microsoft.AspNetCore.Mvc;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Services.Interfaces;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/custom_filters")]
public class CustomFiltersController : ControllerBase
{
    private readonly ICustomFilterService _filterService;
    private readonly ICoreAuthService _authService;

    public CustomFiltersController(ICustomFilterService filterService, ICoreAuthService authService)
    {
        _filterService = filterService;
        _authService = authService;
    }

    [HttpGet("groups")]
    public async Task<ActionResult<object>> GetGroups([FromQuery] int workspace_id = 1)
    {
        var groups = await _filterService.GetGroupsAsync(workspace_id);
        return Ok(new { groups });
    }

    [HttpGet("groups/{id}")]
    public async Task<ActionResult<object>> GetGroup(int id)
    {
        var group = await _filterService.GetGroupByIdAsync(id);
        if (group == null) return NotFound(new { success = false, error = "Grupo não encontrado" });
        return Ok(group);
    }

    [HttpPost("groups")]
    public async Task<ActionResult<object>> CreateGroup([FromBody] EntityDto dto, [FromQuery] int workspace_id = 1)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.ManageCategories))
            return StatusCode(403, new { error = "Sem permissão" });

        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { success = false, error = "Nome é obrigatório" });

        try
        {
            var id = await _filterService.CreateGroupAsync(workspace_id, dto);
            return StatusCode(201, new { success = true, id });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { success = false, error = ex.Message });
        }
    }

    [HttpPut("groups/{id}")]
    public async Task<ActionResult<object>> UpdateGroup(int id, [FromBody] EntityDto dto)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.ManageCategories))
            return StatusCode(403, new { error = "Sem permissão" });

        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { success = false, error = "Nome é obrigatório" });

        try
        {
            var success = await _filterService.UpdateGroupAsync(id, dto);
            if (!success) return NotFound(new { success = false, error = "Grupo não encontrado" });
            return Ok(new { success = true });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { success = false, error = ex.Message });
        }
    }

    [HttpDelete("groups/{id}")]
    public async Task<ActionResult<object>> DeleteGroup(int id)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.ManageCategories))
            return StatusCode(403, new { error = "Sem permissão" });

        var success = await _filterService.DeleteGroupAsync(id);
        if (!success) return NotFound(new { success = false, error = "Grupo não encontrado" });
        return Ok(new { success = true });
    }

    [HttpGet("groups/{groupId}/values")]
    public async Task<ActionResult<object>> GetValues(int groupId)
    {
        var values = await _filterService.GetValuesWithDetailsAsync(groupId);
        return Ok(new { values });
    }

    [HttpPost("groups/{groupId}/values")]
    public async Task<ActionResult<object>> CreateValue(int groupId, [FromBody] EntityDto dto)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.ManageCategories))
            return StatusCode(403, new { error = "Sem permissão" });

        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { success = false, error = "Nome é obrigatório" });

        try
        {
            var id = await _filterService.CreateValueAsync(groupId, dto);
            return StatusCode(201, new { success = true, id });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { success = false, error = ex.Message });
        }
    }

    [HttpPut("values/{id}")]
    public async Task<ActionResult<object>> UpdateValue(int id, [FromBody] EntityDto dto)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.ManageCategories))
            return StatusCode(403, new { error = "Sem permissão" });

        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { success = false, error = "Nome é obrigatório" });

        try
        {
            var success = await _filterService.UpdateValueAsync(id, dto);
            if (!success) return NotFound(new { success = false, error = "Valor não encontrado" });
            return Ok(new { success = true });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { success = false, error = ex.Message });
        }
    }

    [HttpDelete("values/{id}")]
    public async Task<ActionResult<object>> DeleteValue(int id)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.ManageCategories))
            return StatusCode(403, new { error = "Sem permissão" });

        var success = await _filterService.DeleteValueAsync(id);
        if (!success) return NotFound(new { success = false, error = "Valor não encontrado" });
        return Ok(new { success = true });
    }

    [HttpPost("values/{sourceId}/merge/{targetId}")]
    public async Task<ActionResult<object>> MergeValues(int sourceId, int targetId)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.ManageCategories))
            return StatusCode(403, new { error = "Sem permissão" });

        var (success, message, mergedCount) = await _filterService.MergeValuesAsync(sourceId, targetId);
        if (!success) return BadRequest(new { success = false, error = message });
        return Ok(new { success = true, message, merged_files = mergedCount });
    }
}
