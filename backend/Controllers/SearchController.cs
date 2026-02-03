using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Helpers;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api")]
public class SearchController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<SearchController> _logger;

    public SearchController(AppDbContext context, ILogger<SearchController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Search suggestions with fuzzy matching (accent-insensitive).
    /// Returns up to 10 suggestions matching the query.
    /// </summary>
    [HttpGet("search_suggestions")]
    public async Task<ActionResult<SearchSuggestionsResponse>> GetSearchSuggestions([FromQuery] string q = "")
    {
        if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
        {
            return Ok(new SearchSuggestionsResponse { Suggestions = new List<SearchSuggestion>() });
        }

        var allFiles = await _context.PdfFiles
            .Select(f => new
            {
                f.Id,
                f.Filename,
                f.SongName,
                f.Artist,
                f.MusicalKey
            })
            .ToListAsync();

        var matches = new List<(int Priority, SearchSuggestion Suggestion)>();

        foreach (var file in allFiles)
        {
            var priority = 0;

            // Check song name (highest priority)
            var songPriority = TextHelper.GetMatchPriority(file.SongName, q);
            if (songPriority > 0)
            {
                priority = songPriority;
            }
            // Check artist (second priority)
            else
            {
                var artistPriority = TextHelper.GetMatchPriority(file.Artist, q);
                if (artistPriority > 0)
                {
                    priority = artistPriority + 2; // Lower priority than song name
                }
                // Check filename (lowest priority)
                else
                {
                    var filenamePriority = TextHelper.GetMatchPriority(file.Filename, q);
                    if (filenamePriority > 0)
                    {
                        priority = filenamePriority + 4;
                    }
                }
            }

            if (priority > 0)
            {
                matches.Add((priority, new SearchSuggestion
                {
                    Id = file.Id,
                    Filename = file.Filename,
                    SongName = file.SongName,
                    Artist = file.Artist,
                    MusicalKey = file.MusicalKey
                }));
            }
        }

        var suggestions = matches
            .OrderBy(m => m.Priority)
            .Take(10)
            .Select(m => m.Suggestion)
            .ToList();

        return Ok(new SearchSuggestionsResponse { Suggestions = suggestions });
    }

    /// <summary>
    /// Search artists with autocomplete (accent-insensitive).
    /// </summary>
    [HttpGet("search_artists")]
    public async Task<ActionResult<ArtistSearchResponse>> SearchArtists([FromQuery] string q = "")
    {
        if (string.IsNullOrWhiteSpace(q))
        {
            return Ok(new ArtistSearchResponse { Artists = new List<string>() });
        }

        var allArtists = await _context.Artists
            .Select(a => a.Name)
            .ToListAsync();

        var matches = allArtists
            .Select(artist => new
            {
                Name = artist,
                Priority = TextHelper.GetMatchPriority(artist, q)
            })
            .Where(m => m.Priority > 0)
            .OrderBy(m => m.Priority)
            .ThenBy(m => m.Name)
            .Take(20)
            .Select(m => m.Name)
            .ToList();

        return Ok(new ArtistSearchResponse { Artists = matches });
    }

    /// <summary>
    /// Check if a file is a duplicate based on its hash (pre-upload check).
    /// </summary>
    [HttpPost("check_duplicate")]
    [RequestSizeLimit(52_428_800)] // 50MB
    public async Task<ActionResult<CheckDuplicateResponse>> CheckDuplicate(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { success = false, error = "Nenhum arquivo enviado" });
        }

        if (!file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { success = false, error = "Arquivo deve ser PDF" });
        }

        try
        {
            // Compute hash from stream
            string fileHash;
            using (var stream = file.OpenReadStream())
            using (var md5 = System.Security.Cryptography.MD5.Create())
            {
                var hashBytes = md5.ComputeHash(stream);
                fileHash = Convert.ToHexString(hashBytes).ToLowerInvariant();
            }

            // Check if file exists with this hash
            var existingFile = await _context.PdfFiles
                .FirstOrDefaultAsync(f => f.FileHash == fileHash);

            if (existingFile != null)
            {
                return Ok(new CheckDuplicateResponse
                {
                    IsDuplicate = true,
                    ExistingFile = new ExistingFileInfo
                    {
                        Id = existingFile.Id,
                        Filename = existingFile.Filename,
                        SongName = existingFile.SongName,
                        Artist = existingFile.Artist,
                        Category = existingFile.Category,
                        UploadDate = existingFile.UploadDate
                    }
                });
            }

            return Ok(new CheckDuplicateResponse { IsDuplicate = false });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking duplicate file");
            return StatusCode(500, new { success = false, error = "Erro ao verificar duplicado" });
        }
    }
}
