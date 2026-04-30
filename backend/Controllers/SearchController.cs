using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Helpers;
using MusicasIgreja.Api.Services;
using MusicasIgreja.Api.Services.Caching;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api")]
public class SearchController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IFileService _fileService;
    private readonly ICacheService _cache;
    private static readonly TimeSpan SuggestTtl = TimeSpan.FromMinutes(5);

    public SearchController(AppDbContext context, IFileService fileService, ICacheService cache)
    {
        _context = context;
        _fileService = fileService;
        _cache = cache;
    }

    [HttpGet("search_suggestions")]
    public async Task<ActionResult<SearchSuggestionsResponse>> GetSearchSuggestions([FromQuery] string q = "")
    {
        if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
            return Ok(new SearchSuggestionsResponse { Suggestions = new List<SearchSuggestion>() });

        var cacheKey = $"suggest:{q.ToLowerInvariant()}";
        var resp = await _cache.GetOrSetAsync<SearchSuggestionsResponse>(cacheKey, SuggestTtl,
            async () => (SearchSuggestionsResponse?)await GetSuggestionsCore(q),
            "music:any");
        return Ok(resp ?? new SearchSuggestionsResponse { Suggestions = new List<SearchSuggestion>() });
    }

    private async Task<SearchSuggestionsResponse> GetSuggestionsCore(string q)
    {
        // Narrow on DB via unaccented ILIKE (uses GIN trgm index).
        // Take up to 100 candidates, then re-rank in memory for nuanced priority.
        var pattern = $"%{q}%";
        var candidates = await _context.PdfFiles
            .AsNoTracking()
            .Where(f =>
                (f.SongName != null && EF.Functions.ILike(AppDbContext.Unaccent(f.SongName), AppDbContext.Unaccent(pattern))) ||
                (f.Filename != null && EF.Functions.ILike(AppDbContext.Unaccent(f.Filename), AppDbContext.Unaccent(pattern))) ||
                f.FileArtists.Any(fa => fa.Artist.Name != null && EF.Functions.ILike(AppDbContext.Unaccent(fa.Artist.Name), AppDbContext.Unaccent(pattern))))
            .Select(f => new
            {
                f.Id,
                f.Filename,
                f.SongName,
                Artist = f.FileArtists.Select(fa => fa.Artist.Name).FirstOrDefault(),
                f.MusicalKey
            })
            .Take(100)
            .ToListAsync();

        var matches = new List<(int Priority, SearchSuggestion Suggestion)>();

        foreach (var file in candidates)
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
        return new SearchSuggestionsResponse { Suggestions = suggestions };
    }

    [HttpGet("search_artists")]
    public async Task<ActionResult<ArtistSearchResponse>> SearchArtists([FromQuery] string q = "")
    {
        if (string.IsNullOrWhiteSpace(q))
            return Ok(new ArtistSearchResponse { Artists = new List<string>() });

        var cacheKey = $"artists:{q.ToLowerInvariant()}";
        var resp = await _cache.GetOrSetAsync<ArtistSearchResponse>(cacheKey, SuggestTtl,
            async () => (ArtistSearchResponse?)await SearchArtistsCore(q),
            "music:any");
        return Ok(resp ?? new ArtistSearchResponse { Artists = new List<string>() });
    }

    private async Task<ArtistSearchResponse> SearchArtistsCore(string q)
    {
        var pattern = $"%{q}%";
        var candidates = await _context.Artists
            .AsNoTracking()
            .Where(a => a.Name != null
                && EF.Functions.ILike(AppDbContext.Unaccent(a.Name), AppDbContext.Unaccent(pattern)))
            .Select(a => a.Name!)
            .Take(100)
            .ToListAsync();

        var matches = candidates
            .Select(artist => new { Name = artist, Priority = TextHelper.GetMatchPriority(artist, q) })
            .Where(m => m.Priority > 0)
            .OrderBy(m => m.Priority).ThenBy(m => m.Name)
            .Take(20)
            .Select(m => m.Name)
            .ToList();

        return new ArtistSearchResponse { Artists = matches };
    }

    [HttpPost("check_duplicate")]
    [RequestSizeLimit(52_428_800)]
    public async Task<ActionResult<CheckDuplicateResponse>> CheckDuplicate(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { success = false, error = "Nenhum arquivo enviado" });

        if (!file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { success = false, error = "Arquivo deve ser PDF" });

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
}
