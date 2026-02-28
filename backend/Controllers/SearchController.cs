using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Helpers;
using MusicasIgreja.Api.Services;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api")]
public class SearchController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IFileService _fileService;
    private readonly ILogger<SearchController> _logger;

    public SearchController(AppDbContext context, IFileService fileService, ILogger<SearchController> logger)
    {
        _context = context;
        _fileService = fileService;
        _logger = logger;
    }

    [HttpGet("search_suggestions")]
    public async Task<ActionResult<SearchSuggestionsResponse>> GetSearchSuggestions([FromQuery] string q = "")
    {
        if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
            return Ok(new SearchSuggestionsResponse { Suggestions = new List<SearchSuggestion>() });

        var allFiles = await _context.PdfFiles
            .Include(f => f.FileArtists).ThenInclude(fa => fa.Artist)
            .Select(f => new
            {
                f.Id,
                f.Filename,
                f.SongName,
                Artist = f.FileArtists.Select(fa => fa.Artist.Name).FirstOrDefault(),
                f.MusicalKey
            })
            .ToListAsync();

        var matches = new List<(int Priority, SearchSuggestion Suggestion)>();

        foreach (var file in allFiles)
        {
            var priority = TextHelper.GetMatchPriority(file.SongName, q);
            if (priority == 0)
            {
                priority = TextHelper.GetMatchPriority(file.Artist, q);
                if (priority > 0) priority += 2;
            }
            if (priority == 0)
            {
                priority = TextHelper.GetMatchPriority(file.Filename, q);
                if (priority > 0) priority += 4;
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

        var suggestions = matches.OrderBy(m => m.Priority).Take(10).Select(m => m.Suggestion).ToList();
        return Ok(new SearchSuggestionsResponse { Suggestions = suggestions });
    }

    [HttpGet("search_artists")]
    public async Task<ActionResult<ArtistSearchResponse>> SearchArtists([FromQuery] string q = "")
    {
        if (string.IsNullOrWhiteSpace(q))
            return Ok(new ArtistSearchResponse { Artists = new List<string>() });

        var allArtists = await _context.Artists.Select(a => a.Name).ToListAsync();
        var matches = allArtists
            .Select(artist => new { Name = artist, Priority = TextHelper.GetMatchPriority(artist, q) })
            .Where(m => m.Priority > 0)
            .OrderBy(m => m.Priority).ThenBy(m => m.Name)
            .Take(20)
            .Select(m => m.Name)
            .ToList();

        return Ok(new ArtistSearchResponse { Artists = matches });
    }

    [HttpPost("check_duplicate")]
    [RequestSizeLimit(52_428_800)]
    public async Task<ActionResult<CheckDuplicateResponse>> CheckDuplicate(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { success = false, error = "Nenhum arquivo enviado" });

        if (!file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { success = false, error = "Arquivo deve ser PDF" });

        try
        {
            string fileHash;
            using (var stream = file.OpenReadStream())
            {
                fileHash = _fileService.ComputeFileHash(stream);
            }

            var existingFile = await _context.PdfFiles
                .Include(f => f.FileCategories).ThenInclude(fc => fc.Category)
                .Include(f => f.FileArtists).ThenInclude(fa => fa.Artist)
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
                        Artist = existingFile.FileArtists.Select(fa => fa.Artist.Name).FirstOrDefault(),
                        Category = existingFile.FileCategories.Select(fc => fc.Category.Name).FirstOrDefault(),
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
