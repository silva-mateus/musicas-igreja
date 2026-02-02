using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.DTOs;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _context;

    public DashboardController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("stats")]
    public async Task<ActionResult<DashboardStatsDto>> GetStats()
    {
        var stats = new DashboardStatsDto(
            await _context.PdfFiles.CountAsync(),
            await _context.Categories.CountAsync(),
            await _context.LiturgicalTimes.CountAsync(),
            await _context.Artists.CountAsync(),
            await _context.MergeLists.CountAsync()
        );

        return Ok(stats);
    }

    [HttpGet("get_categories")]
    public async Task<ActionResult<List<string>>> GetCategories()
    {
        var categories = await _context.Categories
            .OrderBy(c => c.Name)
            .Select(c => c.Name)
            .ToListAsync();

        return Ok(categories);
    }

    [HttpGet("get_liturgical_times")]
    public async Task<ActionResult<List<string>>> GetLiturgicalTimes()
    {
        var times = await _context.LiturgicalTimes
            .OrderBy(l => l.Name)
            .Select(l => l.Name)
            .ToListAsync();

        return Ok(times);
    }

    [HttpGet("get_artists")]
    public async Task<ActionResult<List<string>>> GetArtists()
    {
        var artists = await _context.Artists
            .OrderBy(a => a.Name)
            .Select(a => a.Name)
            .ToListAsync();

        // Also include unique artists from pdf_files
        var fileArtists = await _context.PdfFiles
            .Where(f => f.Artist != null && f.Artist != "")
            .Select(f => f.Artist!)
            .Distinct()
            .ToListAsync();

        var allArtists = artists.Union(fileArtists).OrderBy(a => a).ToList();
        return Ok(allArtists);
    }

    [HttpGet("top-artists")]
    public async Task<ActionResult<object>> GetTopArtists([FromQuery] int limit = 10)
    {
        var topArtists = await _context.PdfFiles
            .Where(f => f.Artist != null && f.Artist != "")
            .GroupBy(f => f.Artist)
            .Select(g => new { artist = g.Key, count = g.Count() })
            .OrderByDescending(x => x.count)
            .Take(limit)
            .ToListAsync();

        return Ok(topArtists);
    }

    [HttpGet("top-songs-by-category")]
    public async Task<ActionResult<object>> GetTopSongsByCategory([FromQuery] string category)
    {
        if (string.IsNullOrWhiteSpace(category))
            return BadRequest(new { error = "Categoria é obrigatória" });

        var songs = await _context.PdfFiles
            .Where(f => f.Category == category)
            .OrderByDescending(f => f.UploadDate)
            .Take(10)
            .Select(f => new
            {
                id = f.Id,
                song_name = f.SongName,
                artist = f.Artist,
                musical_key = f.MusicalKey
            })
            .ToListAsync();

        return Ok(songs);
    }

    [HttpGet("uploads-timeline")]
    public async Task<ActionResult<object>> GetUploadsTimeline([FromQuery] int days = 30)
    {
        var startDate = DateTime.UtcNow.AddDays(-days);
        
        var timeline = await _context.PdfFiles
            .Where(f => f.UploadDate >= startDate)
            .GroupBy(f => f.UploadDate.Date)
            .Select(g => new { date = g.Key, count = g.Count() })
            .OrderBy(x => x.date)
            .ToListAsync();

        return Ok(timeline);
    }
}

