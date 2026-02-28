using Core.Auth.Helpers;
using Core.Auth.Services;
using Microsoft.AspNetCore.Mvc;
using MusicasIgreja.Api;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Services.Interfaces;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/categories")]
public class CategoriesController : ControllerBase
{
    private readonly ICategoryService _categoryService;
    private readonly ICoreAuthService _authService;

    public CategoriesController(ICategoryService categoryService, ICoreAuthService authService)
    {
        _categoryService = categoryService;
        _authService = authService;
    }

    [HttpGet]
    public async Task<ActionResult<object>> GetCategories([FromQuery] int workspace_id = 1)
    {
        var categories = await _categoryService.GetCategoriesAsync(workspace_id);
        return Ok(new { categories });
    }

    [HttpGet("with-details")]
    public async Task<ActionResult<object>> GetCategoriesWithDetails([FromQuery] int workspace_id = 1)
    {
        var categories = await _categoryService.GetCategoriesWithDetailsAsync(workspace_id);
        return Ok(new { categories });
    }

    [HttpPost]
    public async Task<ActionResult<object>> CreateCategory([FromBody] EntityDto dto, [FromQuery] int workspace_id = 1)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.ManageCategories))
            return StatusCode(403, new { error = "Sem permissão" });

        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { success = false, error = "Nome é obrigatório" });

        try
        {
            var id = await _categoryService.CreateAsync(workspace_id, dto);
            return StatusCode(201, new { success = true, id });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { success = false, error = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<object>> UpdateCategory(int id, [FromBody] EntityDto dto)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.ManageCategories))
            return StatusCode(403, new { error = "Sem permissão" });

        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { success = false, error = "Nome é obrigatório" });

        try
        {
            var success = await _categoryService.UpdateAsync(id, dto);
            if (!success) return NotFound(new { success = false, error = "Categoria não encontrada" });
            return Ok(new { success = true });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { success = false, error = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<object>> DeleteCategory(int id)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.ManageCategories))
            return StatusCode(403, new { error = "Sem permissão" });

        var success = await _categoryService.DeleteAsync(id);
        if (!success) return NotFound(new { success = false, error = "Categoria não encontrada" });
        return Ok(new { success = true });
    }

    [HttpPost("{sourceId}/merge/{targetId}")]
    public async Task<ActionResult<object>> MergeCategory(int sourceId, int targetId)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.ManageCategories))
            return StatusCode(403, new { error = "Sem permissão" });

        var (success, message, mergedCount) = await _categoryService.MergeAsync(sourceId, targetId);
        if (!success) return BadRequest(new { success = false, error = message });
        return Ok(new { success = true, message, merged_files = mergedCount });
    }
}
