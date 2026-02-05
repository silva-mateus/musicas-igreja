using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/filters")]
public class FiltersController : ControllerBase
{
    private readonly AppDbContext _context;

    private static readonly string[] MusicalKeys = 
    {
        "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B",
        "Cm", "C#m", "Dm", "D#m", "Ebm", "Em", "Fm", "F#m", "Gm", "G#m", "Abm", "Am", "A#m", "Bbm", "Bm"
    };

    public FiltersController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("suggestions")]
    public async Task<ActionResult<object>> GetSuggestions(
        [FromQuery] List<string>? category = null,
        [FromQuery] List<string>? liturgical_time = null,
        [FromQuery] List<string>? artist = null,
        [FromQuery] string? musical_key = null)
    {
        // Start with all files
        var query = _context.PdfFiles.AsQueryable();

        // Apply filters progressively to get dynamic suggestions
        var categories = category?.Where(c => !string.IsNullOrWhiteSpace(c)).ToList();
        if (categories != null && categories.Count > 0)
        {
            query = query.Where(f => 
                categories.Contains(f.Category!) ||
                f.FileCategories.Any(fc => categories.Contains(fc.Category.Name)));
        }

        var liturgicalTimes = liturgical_time?.Where(t => !string.IsNullOrWhiteSpace(t)).ToList();
        if (liturgicalTimes != null && liturgicalTimes.Count > 0)
        {
            query = query.Where(f => 
                liturgicalTimes.Contains(f.LiturgicalTime!) ||
                f.FileLiturgicalTimes.Any(flt => liturgicalTimes.Contains(flt.LiturgicalTime.Name)));
        }

        var artists = artist?.Where(a => !string.IsNullOrWhiteSpace(a)).ToList();
        if (artists != null && artists.Count > 0)
        {
            query = query.Where(f => artists.Contains(f.Artist!));
        }

        if (!string.IsNullOrWhiteSpace(musical_key))
        {
            query = query.Where(f => f.MusicalKey == musical_key);
        }

        // Get files matching current filters
        var filteredFiles = await query
            .Include(f => f.FileCategories).ThenInclude(fc => fc.Category)
            .Include(f => f.FileLiturgicalTimes).ThenInclude(flt => flt.LiturgicalTime)
            .ToListAsync();

        // Extract available options from filtered files
        var availableCategories = filteredFiles
            .SelectMany(f => f.FileCategories.Select(fc => fc.Category.Name))
            .Concat(filteredFiles.Where(f => f.Category != null).Select(f => f.Category!))
            .Distinct()
            .OrderBy(c => c)
            .ToList();

        var availableLiturgicalTimes = filteredFiles
            .SelectMany(f => f.FileLiturgicalTimes.Select(flt => flt.LiturgicalTime.Name))
            .Concat(filteredFiles.Where(f => f.LiturgicalTime != null).Select(f => f.LiturgicalTime!))
            .Distinct()
            .OrderBy(l => l)
            .ToList();

        var availableArtists = filteredFiles
            .Where(f => !string.IsNullOrEmpty(f.Artist))
            .Select(f => f.Artist!)
            .Distinct()
            .OrderBy(a => a)
            .ToList();

        var availableMusicalKeys = filteredFiles
            .Where(f => !string.IsNullOrEmpty(f.MusicalKey))
            .Select(f => f.MusicalKey!)
            .Distinct()
            .OrderBy(k => Array.IndexOf(MusicalKeys, k))
            .ToList();

        return Ok(new
        {
            categories = availableCategories,
            liturgical_times = availableLiturgicalTimes,
            artists = availableArtists,
            musical_keys = availableMusicalKeys.Any() ? availableMusicalKeys : MusicalKeys.ToList()
        });
    }
}

