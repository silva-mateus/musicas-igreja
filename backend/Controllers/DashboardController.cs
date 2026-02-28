using Microsoft.AspNetCore.Mvc;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Services.Interfaces;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;

    public DashboardController(IDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    [HttpGet("stats")]
    public async Task<ActionResult<DashboardStatsDto>> GetStats([FromQuery] int workspace_id = 1)
    {
        var stats = await _dashboardService.GetStatsAsync(workspace_id);
        return Ok(stats);
    }

    [HttpGet("get_categories")]
    public async Task<ActionResult<List<FilterOptionDto>>> GetCategories([FromQuery] int workspace_id = 1)
    {
        var categories = await _dashboardService.GetCategoriesAsync(workspace_id);
        return Ok(categories);
    }

    [HttpGet("get_custom_filter_groups")]
    public async Task<ActionResult<List<CustomFilterGroupDto>>> GetCustomFilterGroups([FromQuery] int workspace_id = 1)
    {
        var groups = await _dashboardService.GetCustomFilterGroupsAsync(workspace_id);
        return Ok(groups);
    }

    [HttpGet("get_artists")]
    public async Task<ActionResult<List<FilterOptionDto>>> GetArtists([FromQuery] int workspace_id = 1)
    {
        var artists = await _dashboardService.GetArtistsAsync(workspace_id);
        return Ok(artists);
    }

    [HttpGet("top-artists")]
    public async Task<ActionResult<object>> GetTopArtists([FromQuery] int workspace_id = 1, [FromQuery] int limit = 10)
    {
        var result = await _dashboardService.GetTopArtistsAsync(workspace_id, limit);
        return Ok(result);
    }

    [HttpGet("top-songs-by-category")]
    public async Task<ActionResult<object>> GetTopSongsByCategory([FromQuery] int workspace_id = 1, [FromQuery] string category = "")
    {
        if (string.IsNullOrWhiteSpace(category))
            return BadRequest(new { error = "Categoria é obrigatória" });

        var result = await _dashboardService.GetTopSongsByCategoryAsync(workspace_id, category);
        return Ok(result);
    }

    [HttpGet("uploads-timeline")]
    public async Task<ActionResult<object>> GetUploadsTimeline([FromQuery] int workspace_id = 1, [FromQuery] int months = 12)
    {
        var result = await _dashboardService.GetUploadsTimelineAsync(workspace_id, months);
        return Ok(result);
    }
}
