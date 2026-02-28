using Microsoft.AspNetCore.Mvc;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Services.Interfaces;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/filters")]
public class FiltersController : ControllerBase
{
    private readonly IDashboardService _dashboardService;
    private readonly ICustomFilterService _customFilterService;

    private static readonly string[] MusicalKeys =
    {
        "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B",
        "Cm", "C#m", "Dm", "D#m", "Ebm", "Em", "Fm", "F#m", "Gm", "G#m", "Abm", "Am", "A#m", "Bbm", "Bm"
    };

    public FiltersController(IDashboardService dashboardService, ICustomFilterService customFilterService)
    {
        _dashboardService = dashboardService;
        _customFilterService = customFilterService;
    }

    [HttpGet("suggestions")]
    public async Task<ActionResult<object>> GetSuggestions([FromQuery] int workspace_id = 1)
    {
        var categories = await _dashboardService.GetCategoriesAsync(workspace_id);
        var artists = await _dashboardService.GetArtistsAsync(workspace_id);
        var customFilterGroups = await _customFilterService.GetGroupsAsync(workspace_id);

        return Ok(new
        {
            categories,
            custom_filter_groups = customFilterGroups,
            artists,
            musical_keys = MusicalKeys.ToList()
        });
    }
}
