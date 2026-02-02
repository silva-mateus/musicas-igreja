using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.Models;
using MusicasIgreja.Api.Services;
using System.Text.Json.Serialization;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/admin")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IFileService _fileService;
    private readonly ILogger<AdminController> _logger;

    public AdminController(AppDbContext context, IFileService fileService, ILogger<AdminController> logger)
    {
        _context = context;
        _fileService = fileService;
        _logger = logger;
    }

    /// <summary>
    /// Verify that all PDF filenames follow the expected pattern: "SongName - Key - Artist.pdf"
    /// </summary>
    [HttpGet("verify-pdfs")]
    public async Task<ActionResult> VerifyPdfs()
    {
        var files = await _context.PdfFiles.ToListAsync();
        var mismatchedFiles = new List<object>();

        foreach (var file in files)
        {
            var expectedFilename = _fileService.GenerateFilename(
                file.SongName,
                file.Artist,
                file.OriginalName,
                file.MusicalKey
            );

            if (file.Filename != expectedFilename)
            {
                mismatchedFiles.Add(new
                {
                    id = file.Id,
                    current_filename = file.Filename,
                    expected_filename = expectedFilename,
                    song_name = file.SongName ?? "",
                    artist = file.Artist ?? "",
                    musical_key = file.MusicalKey ?? "",
                    file_path = file.FilePath
                });
            }
        }

        return Ok(new
        {
            total_files = files.Count,
            mismatched_count = mismatchedFiles.Count,
            mismatched_files = mismatchedFiles
        });
    }

    /// <summary>
    /// Fix PDF filenames to follow the expected pattern
    /// </summary>
    [HttpPost("fix-pdf-names")]
    public async Task<ActionResult> FixPdfNames([FromBody] FixPdfNamesRequest request)
    {
        if (request.FileIds == null || !request.FileIds.Any())
            return BadRequest(new { error = "Nenhum arquivo selecionado" });

        var fixedCount = 0;
        var errors = new List<string>();

        foreach (var fileId in request.FileIds)
        {
            try
            {
                var file = await _context.PdfFiles.FindAsync(fileId);
                if (file == null) continue;

                var expectedFilename = _fileService.GenerateFilename(
                    file.SongName,
                    file.Artist,
                    file.OriginalName,
                    file.MusicalKey
                );

                if (file.Filename == expectedFilename) continue;

                // Get current and new absolute paths
                var currentPath = _fileService.GetAbsolutePath(file.FilePath);
                var directory = Path.GetDirectoryName(currentPath);
                var newPath = Path.Combine(directory ?? "", expectedFilename);

                // Rename the physical file
                if (System.IO.File.Exists(currentPath))
                {
                    System.IO.File.Move(currentPath, newPath);

                    // Update the database record
                    file.Filename = expectedFilename;
                    file.FilePath = _fileService.NormalizeToRelativePath(newPath);

                    fixedCount++;
                }
                else
                {
                    errors.Add($"Arquivo não encontrado: {file.Filename}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao corrigir arquivo {FileId}", fileId);
                errors.Add($"Erro no arquivo {fileId}: {ex.Message}");
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            fixed_count = fixedCount,
            errors = errors.Any() ? errors : null
        });
    }

    /// <summary>
    /// Discover artists, categories, and liturgical times present in files but not registered
    /// </summary>
    [HttpGet("discover-entities")]
    public async Task<ActionResult> DiscoverEntities()
    {
        // Get registered entities
        var registeredArtists = await _context.Artists.Select(a => a.Name).ToListAsync();
        var registeredCategories = await _context.Categories.Select(c => c.Name).ToListAsync();
        var registeredLiturgicalTimes = await _context.LiturgicalTimes.Select(l => l.Name).ToListAsync();

        // Get all files
        var files = await _context.PdfFiles.ToListAsync();

        // Discover entities from files
        var fileArtists = files
            .Where(f => !string.IsNullOrWhiteSpace(f.Artist))
            .Select(f => f.Artist!)
            .Distinct()
            .ToList();

        var fileCategories = files
            .Where(f => !string.IsNullOrWhiteSpace(f.Category))
            .Select(f => f.Category)
            .Distinct()
            .ToList();

        var fileLiturgicalTimes = files
            .Where(f => !string.IsNullOrWhiteSpace(f.LiturgicalTime))
            .Select(f => f.LiturgicalTime!)
            .Distinct()
            .ToList();

        // Get musical keys (not stored in a separate table, just for reference)
        var musicalKeys = files
            .Where(f => !string.IsNullOrWhiteSpace(f.MusicalKey))
            .Select(f => f.MusicalKey!)
            .Distinct()
            .OrderBy(k => k)
            .ToList();

        // Find unregistered entities
        var unregisteredArtists = fileArtists.Except(registeredArtists, StringComparer.OrdinalIgnoreCase).OrderBy(a => a).ToList();
        var unregisteredCategories = fileCategories.Except(registeredCategories, StringComparer.OrdinalIgnoreCase).OrderBy(c => c).ToList();
        var unregisteredLiturgicalTimes = fileLiturgicalTimes.Except(registeredLiturgicalTimes, StringComparer.OrdinalIgnoreCase).OrderBy(l => l).ToList();

        return Ok(new
        {
            success = true,
            data = new
            {
                discovered = new
                {
                    artists = unregisteredArtists,
                    categories = unregisteredCategories,
                    liturgical_times = unregisteredLiturgicalTimes,
                    musical_keys = musicalKeys
                },
                registered = new
                {
                    artists = registeredArtists.OrderBy(a => a).ToList(),
                    categories = registeredCategories.OrderBy(c => c).ToList(),
                    liturgical_times = registeredLiturgicalTimes.OrderBy(l => l).ToList(),
                    musical_keys = musicalKeys
                },
                stats = new
                {
                    total_files = files.Count,
                    files_processed = files.Count
                }
            }
        });
    }

    /// <summary>
    /// Register discovered entities
    /// </summary>
    [HttpPost("register-discovered-entities")]
    public async Task<ActionResult> RegisterDiscoveredEntities([FromBody] RegisterEntitiesRequest request)
    {
        var addedArtists = 0;
        var addedCategories = 0;
        var addedLiturgicalTimes = 0;

        // Register artists
        if (request.Artists != null)
        {
            foreach (var artistName in request.Artists)
            {
                if (string.IsNullOrWhiteSpace(artistName)) continue;

                var exists = await _context.Artists.AnyAsync(a => a.Name.ToLower() == artistName.ToLower());
                if (!exists)
                {
                    _context.Artists.Add(new Artist { Name = artistName });
                    addedArtists++;
                }
            }
        }

        // Register categories
        if (request.Categories != null)
        {
            foreach (var categoryName in request.Categories)
            {
                if (string.IsNullOrWhiteSpace(categoryName)) continue;

                var exists = await _context.Categories.AnyAsync(c => c.Name.ToLower() == categoryName.ToLower());
                if (!exists)
                {
                    _context.Categories.Add(new Category { Name = categoryName });
                    addedCategories++;
                }
            }
        }

        // Register liturgical times
        if (request.LiturgicalTimes != null)
        {
            foreach (var timeName in request.LiturgicalTimes)
            {
                if (string.IsNullOrWhiteSpace(timeName)) continue;

                var exists = await _context.LiturgicalTimes.AnyAsync(l => l.Name.ToLower() == timeName.ToLower());
                if (!exists)
                {
                    _context.LiturgicalTimes.Add(new LiturgicalTime { Name = timeName });
                    addedLiturgicalTimes++;
                }
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = $"Registrados: {addedArtists} artistas, {addedCategories} categorias, {addedLiturgicalTimes} tempos litúrgicos"
        });
    }

    /// <summary>
    /// Cleanup empty or duplicate entities
    /// </summary>
    [HttpPost("cleanup-entities")]
    public async Task<ActionResult> CleanupEntities()
    {
        var removedArtists = 0;
        var removedCategories = 0;
        var removedLiturgicalTimes = 0;

        // Remove duplicate or empty artists
        var artistGroups = await _context.Artists
            .GroupBy(a => a.Name.ToLower())
            .Where(g => g.Count() > 1)
            .ToListAsync();

        foreach (var group in artistGroups)
        {
            var duplicates = group.Skip(1).ToList();
            _context.Artists.RemoveRange(duplicates);
            removedArtists += duplicates.Count;
        }

        // Remove empty artists
        var emptyArtists = await _context.Artists
            .Where(a => string.IsNullOrWhiteSpace(a.Name))
            .ToListAsync();
        _context.Artists.RemoveRange(emptyArtists);
        removedArtists += emptyArtists.Count;

        // Remove duplicate or empty categories
        var categoryGroups = await _context.Categories
            .GroupBy(c => c.Name.ToLower())
            .Where(g => g.Count() > 1)
            .ToListAsync();

        foreach (var group in categoryGroups)
        {
            var duplicates = group.Skip(1).ToList();
            _context.Categories.RemoveRange(duplicates);
            removedCategories += duplicates.Count;
        }

        // Remove empty categories
        var emptyCategories = await _context.Categories
            .Where(c => string.IsNullOrWhiteSpace(c.Name))
            .ToListAsync();
        _context.Categories.RemoveRange(emptyCategories);
        removedCategories += emptyCategories.Count;

        // Remove duplicate or empty liturgical times
        var timeGroups = await _context.LiturgicalTimes
            .GroupBy(l => l.Name.ToLower())
            .Where(g => g.Count() > 1)
            .ToListAsync();

        foreach (var group in timeGroups)
        {
            var duplicates = group.Skip(1).ToList();
            _context.LiturgicalTimes.RemoveRange(duplicates);
            removedLiturgicalTimes += duplicates.Count;
        }

        // Remove empty liturgical times
        var emptyTimes = await _context.LiturgicalTimes
            .Where(l => string.IsNullOrWhiteSpace(l.Name))
            .ToListAsync();
        _context.LiturgicalTimes.RemoveRange(emptyTimes);
        removedLiturgicalTimes += emptyTimes.Count;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = $"Removidos: {removedArtists} artistas, {removedCategories} categorias, {removedLiturgicalTimes} tempos litúrgicos"
        });
    }
}

public class FixPdfNamesRequest
{
    [JsonPropertyName("file_ids")]
    public List<int>? FileIds { get; set; }
}

public class RegisterEntitiesRequest
{
    [JsonPropertyName("artists")]
    public List<string>? Artists { get; set; }

    [JsonPropertyName("categories")]
    public List<string>? Categories { get; set; }

    [JsonPropertyName("liturgical_times")]
    public List<string>? LiturgicalTimes { get; set; }
}
