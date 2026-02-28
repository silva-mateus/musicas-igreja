using Core.Auth.Helpers;
using Core.Auth.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Models;
using MusicasIgreja.Api.Services;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/admin")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IFileService _fileService;
    private readonly ICoreAuthService _authService;
    private readonly ILogger<AdminController> _logger;

    public AdminController(AppDbContext context, IFileService fileService, ICoreAuthService authService, ILogger<AdminController> logger)
    {
        _context = context;
        _fileService = fileService;
        _authService = authService;
        _logger = logger;
    }

    [HttpGet("verify-pdfs")]
    public async Task<ActionResult> VerifyPdfs()
    {
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.AccessAdmin))
            return StatusCode(403, new { error = "Sem permissão" });

        var files = await _context.PdfFiles
            .Include(f => f.FileArtists).ThenInclude(fa => fa.Artist)
            .ToListAsync();

        var mismatchedFiles = new List<object>();
        foreach (var file in files)
        {
            var artistName = file.FileArtists.Select(fa => fa.Artist.Name).FirstOrDefault();
            var expectedFilename = _fileService.GenerateFilename(file.SongName, artistName, file.OriginalName, file.MusicalKey);

            if (file.Filename != expectedFilename)
            {
                mismatchedFiles.Add(new
                {
                    id = file.Id,
                    current_filename = file.Filename,
                    expected_filename = expectedFilename,
                    song_name = file.SongName ?? "",
                    artist = artistName ?? "",
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

    [HttpPost("fix-pdf-names")]
    public async Task<ActionResult> FixPdfNames([FromBody] FixPdfNamesRequest request)
    {
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.AccessAdmin))
            return StatusCode(403, new { error = "Sem permissão" });

        if (request.FileIds == null || !request.FileIds.Any())
            return BadRequest(new { error = "Nenhum arquivo selecionado" });

        var fixedCount = 0;
        var errors = new List<string>();

        foreach (var fileId in request.FileIds)
        {
            try
            {
                var file = await _context.PdfFiles
                    .Include(f => f.FileArtists).ThenInclude(fa => fa.Artist)
                    .FirstOrDefaultAsync(f => f.Id == fileId);
                if (file == null) continue;

                var artistName = file.FileArtists.Select(fa => fa.Artist.Name).FirstOrDefault();
                var expectedFilename = _fileService.GenerateFilename(file.SongName, artistName, file.OriginalName, file.MusicalKey);
                if (file.Filename == expectedFilename) continue;

                var currentPath = _fileService.GetAbsolutePath(file.FilePath);
                var directory = Path.GetDirectoryName(currentPath) ?? "";
                var uniqueFilename = _fileService.GetUniqueFilename(directory, expectedFilename);
                var newPath = Path.Combine(directory, uniqueFilename);

                if (System.IO.File.Exists(currentPath))
                {
                    System.IO.File.Move(currentPath, newPath);
                    file.Filename = uniqueFilename;
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

    [HttpGet("discover-entities")]
    public async Task<ActionResult> DiscoverEntities()
    {
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.AccessAdmin))
            return StatusCode(403, new { error = "Sem permissão" });

        var registeredArtists = await _context.Artists.Select(a => a.Name).ToListAsync();
        var registeredCategories = await _context.Categories.Select(c => c.Name).ToListAsync();

        var fileArtists = await _context.FileArtists
            .Select(fa => fa.Artist.Name).Distinct().ToListAsync();
        var fileCategories = await _context.FileCategories
            .Select(fc => fc.Category.Name).Distinct().ToListAsync();

        var unregisteredArtists = fileArtists.Except(registeredArtists, StringComparer.OrdinalIgnoreCase).OrderBy(a => a).ToList();
        var unregisteredCategories = fileCategories.Except(registeredCategories, StringComparer.OrdinalIgnoreCase).OrderBy(c => c).ToList();
        var musicalKeys = await _context.PdfFiles
            .Where(f => !string.IsNullOrEmpty(f.MusicalKey))
            .Select(f => f.MusicalKey!)
            .Distinct().OrderBy(k => k).ToListAsync();
        var totalFiles = await _context.PdfFiles.CountAsync();

        return Ok(new
        {
            success = true,
            data = new
            {
                discovered = new
                {
                    artists = unregisteredArtists,
                    categories = unregisteredCategories,
                    musical_keys = musicalKeys
                },
                registered = new
                {
                    artists = registeredArtists.OrderBy(a => a).ToList(),
                    categories = registeredCategories.OrderBy(c => c).ToList()
                },
                stats = new
                {
                    total_files = totalFiles,
                    files_processed = totalFiles
                }
            }
        });
    }

    [HttpPost("register-discovered-entities")]
    public async Task<ActionResult> RegisterDiscoveredEntities([FromBody] RegisterEntitiesRequest request)
    {
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.AccessAdmin))
            return StatusCode(403, new { error = "Sem permissão" });

        var addedArtists = 0;
        var addedCategories = 0;

        if (request.Artists != null)
        {
            foreach (var name in request.Artists.Where(n => !string.IsNullOrWhiteSpace(n)))
            {
                if (!await _context.Artists.AnyAsync(a => a.Name.ToLower() == name.ToLower()))
                {
                    _context.Artists.Add(new Artist { Name = name });
                    addedArtists++;
                }
            }
        }

        if (request.Categories != null)
        {
            foreach (var name in request.Categories.Where(n => !string.IsNullOrWhiteSpace(n)))
            {
                if (!await _context.Categories.AnyAsync(c => c.Name.ToLower() == name.ToLower()))
                {
                    _context.Categories.Add(new Category { Name = name, WorkspaceId = 1 });
                    addedCategories++;
                }
            }
        }

        await _context.SaveChangesAsync();
        return Ok(new { success = true, message = $"Registrados: {addedArtists} artistas, {addedCategories} categorias" });
    }

    [HttpPost("cleanup-entities")]
    public async Task<ActionResult> CleanupEntities()
    {
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.AccessAdmin))
            return StatusCode(403, new { error = "Sem permissão" });

        var removedArtists = 0;
        var removedCategories = 0;

        // --- Artists: remove duplicates (migrate relationships) then empty ---
        var allArtists = await _context.Artists.ToListAsync();
        var artistDupGroups = allArtists
            .Where(a => !string.IsNullOrWhiteSpace(a.Name))
            .GroupBy(a => a.Name.ToLower())
            .Where(g => g.Count() > 1);

        foreach (var group in artistDupGroups)
        {
            var kept = group.First();
            foreach (var dup in group.Skip(1))
            {
                var orphanedLinks = await _context.FileArtists.Where(fa => fa.ArtistId == dup.Id).ToListAsync();
                foreach (var link in orphanedLinks)
                {
                    if (!await _context.FileArtists.AnyAsync(fa => fa.FileId == link.FileId && fa.ArtistId == kept.Id))
                        _context.FileArtists.Add(new FileArtist { FileId = link.FileId, ArtistId = kept.Id });
                }
                _context.FileArtists.RemoveRange(orphanedLinks);
                _context.Artists.Remove(dup);
                removedArtists++;
            }
        }

        var emptyArtists = allArtists.Where(a => string.IsNullOrWhiteSpace(a.Name)).ToList();
        foreach (var empty in emptyArtists)
        {
            var links = await _context.FileArtists.Where(fa => fa.ArtistId == empty.Id).ToListAsync();
            _context.FileArtists.RemoveRange(links);
            _context.Artists.Remove(empty);
            removedArtists++;
        }

        // --- Categories: remove duplicates (migrate relationships) then empty ---
        var allCategories = await _context.Categories.ToListAsync();
        var catDupGroups = allCategories
            .Where(c => !string.IsNullOrWhiteSpace(c.Name))
            .GroupBy(c => c.Name.ToLower())
            .Where(g => g.Count() > 1);

        foreach (var group in catDupGroups)
        {
            var kept = group.First();
            foreach (var dup in group.Skip(1))
            {
                var orphanedLinks = await _context.FileCategories.Where(fc => fc.CategoryId == dup.Id).ToListAsync();
                foreach (var link in orphanedLinks)
                {
                    if (!await _context.FileCategories.AnyAsync(fc => fc.FileId == link.FileId && fc.CategoryId == kept.Id))
                        _context.FileCategories.Add(new FileCategory { FileId = link.FileId, CategoryId = kept.Id });
                }
                _context.FileCategories.RemoveRange(orphanedLinks);
                _context.Categories.Remove(dup);
                removedCategories++;
            }
        }

        var emptyCategories = allCategories.Where(c => string.IsNullOrWhiteSpace(c.Name)).ToList();
        foreach (var empty in emptyCategories)
        {
            var links = await _context.FileCategories.Where(fc => fc.CategoryId == empty.Id).ToListAsync();
            _context.FileCategories.RemoveRange(links);
            _context.Categories.Remove(empty);
            removedCategories++;
        }

        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = $"Removidos: {removedArtists} artistas, {removedCategories} categorias" });
    }
}
