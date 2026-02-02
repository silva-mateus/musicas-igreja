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
    public async Task<ActionResult<object>> GetSuggestions()
    {
        var categories = await _context.Categories
            .OrderBy(c => c.Name)
            .Select(c => c.Name)
            .ToListAsync();

        var liturgicalTimes = await _context.LiturgicalTimes
            .OrderBy(l => l.Name)
            .Select(l => l.Name)
            .ToListAsync();

        // Get unique artists from pdf_files
        var artists = await _context.PdfFiles
            .Where(f => f.Artist != null && f.Artist != "")
            .Select(f => f.Artist!)
            .Distinct()
            .OrderBy(a => a)
            .ToListAsync();

        return Ok(new
        {
            categories,
            liturgical_times = liturgicalTimes,
            artists,
            musical_keys = MusicalKeys
        });
    }
}

