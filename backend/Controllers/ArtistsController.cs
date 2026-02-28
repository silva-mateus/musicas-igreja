using Core.Auth.Helpers;
using Core.Auth.Services;
using Microsoft.AspNetCore.Mvc;
using MusicasIgreja.Api;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Services.Interfaces;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/artists")]
public class ArtistsController : ControllerBase
{
    private readonly IArtistService _artistService;
    private readonly ICoreAuthService _authService;

    public ArtistsController(IArtistService artistService, ICoreAuthService authService)
    {
        _artistService = artistService;
        _authService = authService;
    }

    [HttpGet]
    public async Task<ActionResult<object>> GetArtists()
    {
        var artists = await _artistService.GetArtistsAsync();
        return Ok(new { artists });
    }

    [HttpGet("with-details")]
    public async Task<ActionResult<object>> GetArtistsWithDetails()
    {
        var artists = await _artistService.GetArtistsWithDetailsAsync();
        return Ok(new { artists });
    }

    [HttpPost]
    public async Task<ActionResult<object>> CreateArtist([FromBody] EntityDto dto)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.ManageCategories))
            return StatusCode(403, new { error = "Sem permissão" });

        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { success = false, error = "Nome é obrigatório" });

        try
        {
            var id = await _artistService.CreateAsync(dto);
            return StatusCode(201, new { success = true, id });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { success = false, error = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<object>> UpdateArtist(int id, [FromBody] EntityDto dto)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.ManageCategories))
            return StatusCode(403, new { error = "Sem permissão" });

        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { success = false, error = "Nome é obrigatório" });

        try
        {
            var success = await _artistService.UpdateAsync(id, dto);
            if (!success) return NotFound(new { success = false, error = "Artista não encontrado" });
            return Ok(new { success = true });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { success = false, error = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<object>> DeleteArtist(int id)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.ManageCategories))
            return StatusCode(403, new { error = "Sem permissão" });

        var success = await _artistService.DeleteAsync(id);
        if (!success) return NotFound(new { success = false, error = "Artista não encontrado" });
        return Ok(new { success = true });
    }

    [HttpPost("{sourceId}/merge/{targetId}")]
    public async Task<ActionResult<object>> MergeArtist(int sourceId, int targetId)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.ManageCategories))
            return StatusCode(403, new { error = "Sem permissão" });

        var (success, message, mergedCount) = await _artistService.MergeAsync(sourceId, targetId);
        if (!success) return BadRequest(new { success = false, error = message });
        return Ok(new { success = true, message, merged_files = mergedCount });
    }
}
