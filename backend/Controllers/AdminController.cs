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
        var conflicts = new List<object>();

        foreach (var file in files)
        {
            var artistName = file.FileArtists.Select(fa => fa.Artist.Name).FirstOrDefault();
            var expectedFilename = _fileService.GenerateFilename(file.SongName, artistName, file.OriginalName, file.MusicalKey);

            if (string.Equals(file.Filename?.Trim(), expectedFilename.Trim(), StringComparison.Ordinal))
                continue;

            var currentPath = _fileService.GetAbsolutePath(file.FilePath);
            var directory = Path.GetDirectoryName(currentPath) ?? "";
            var targetPath = Path.Combine(directory, expectedFilename);

            var hasConflict = !string.Equals(currentPath, targetPath, StringComparison.OrdinalIgnoreCase)
                              && System.IO.File.Exists(targetPath);

            if (hasConflict)
            {
                var conflictingFile = files.FirstOrDefault(f =>
                    f.Id != file.Id &&
                    string.Equals(f.Filename?.Trim(), expectedFilename?.Trim(), StringComparison.OrdinalIgnoreCase));

                conflicts.Add(new
                {
                    file_to_fix = new
                    {
                        id = file.Id,
                        filename = file.Filename,
                        file_path = file.FilePath,
                        file_size = file.FileSize ?? 0L,
                        upload_date = file.UploadDate
                    },
                    conflicting_file = conflictingFile != null ? new
                    {
                        id = conflictingFile.Id,
                        filename = conflictingFile.Filename,
                        file_path = conflictingFile.FilePath,
                        file_size = conflictingFile.FileSize ?? 0L,
                        upload_date = conflictingFile.UploadDate
                    } : null,
                    expected_filename = expectedFilename,
                    song_name = file.SongName ?? "",
                    artist = artistName ?? "",
                    musical_key = file.MusicalKey ?? ""
                });
            }
            else
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
            mismatched_files = mismatchedFiles,
            conflicts
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
        var skippedDuplicates = 0;
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
                var targetPath = Path.Combine(directory, expectedFilename);

                _logger.LogInformation("Fix PDF {FileId}: '{Current}' -> '{Expected}' | CurrentPath: {CurrentPath} | TargetPath: {TargetPath}",
                    fileId, file.Filename, expectedFilename, currentPath, targetPath);

                if (string.Equals(currentPath, targetPath, StringComparison.OrdinalIgnoreCase))
                {
                    file.Filename = expectedFilename;
                    file.FilePath = _fileService.NormalizeToRelativePath(targetPath);
                    fixedCount++;
                    _logger.LogInformation("Fix PDF {FileId}: DB-only update (same path, different case)", fileId);
                    continue;
                }

                if (System.IO.File.Exists(targetPath))
                {
                    skippedDuplicates++;
                    var msg = $"Conflito: \"{expectedFilename}\" já existe no diretório. Resolva duplicatas primeiro.";
                    errors.Add(msg);
                    _logger.LogWarning("Fix PDF {FileId}: skipped - target already exists at {TargetPath}", fileId, targetPath);
                    continue;
                }

                if (System.IO.File.Exists(currentPath))
                {
                    System.IO.File.Move(currentPath, targetPath);
                    file.Filename = expectedFilename;
                    file.FilePath = _fileService.NormalizeToRelativePath(targetPath);
                    fixedCount++;
                    _logger.LogInformation("Fix PDF {FileId}: renamed successfully", fileId);
                }
                else
                {
                    var msg = $"Arquivo físico não encontrado: {file.Filename} (path: {currentPath})";
                    errors.Add(msg);
                    _logger.LogWarning("Fix PDF {FileId}: file not found at {CurrentPath}", fileId, currentPath);
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
            skipped_duplicates = skippedDuplicates,
            errors = errors.Any() ? errors : null
        });
    }

    [HttpGet("normalize-titles")]
    public async Task<ActionResult> NormalizeTitles()
    {
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.AccessAdmin))
            return StatusCode(403, new { error = "Sem permissão" });

        var files = await _context.PdfFiles
            .Where(f => f.SongName != null && f.SongName != "")
            .ToListAsync();

        var changes = new List<object>();

        foreach (var file in files)
        {
            var normalized = _fileService.NormalizeSongTitle(file.SongName);
            if (normalized != null && normalized != file.SongName)
            {
                changes.Add(new
                {
                    id = file.Id,
                    current_title = file.SongName,
                    normalized_title = normalized
                });
            }
        }

        return Ok(new
        {
            total_files = files.Count,
            changes_count = changes.Count,
            changes
        });
    }

    [HttpPost("apply-normalized-titles")]
    public async Task<ActionResult> ApplyNormalizedTitles([FromBody] ApplyNormalizedTitlesRequest request)
    {
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.AccessAdmin))
            return StatusCode(403, new { error = "Sem permissão" });

        if (request.FileIds == null || !request.FileIds.Any())
            return BadRequest(new { error = "Nenhum arquivo selecionado" });

        var updatedCount = 0;
        var renamedCount = 0;
        var errors = new List<string>();

        foreach (var fileId in request.FileIds)
        {
            try
            {
                var file = await _context.PdfFiles
                    .Include(f => f.FileArtists).ThenInclude(fa => fa.Artist)
                    .FirstOrDefaultAsync(f => f.Id == fileId);
                if (file == null) continue;

                var normalized = _fileService.NormalizeSongTitle(file.SongName);
                if (normalized == null || normalized == file.SongName) continue;

                file.SongName = normalized;
                updatedCount++;

                var artistName = file.FileArtists.Select(fa => fa.Artist.Name).FirstOrDefault();
                var expectedFilename = _fileService.GenerateFilename(file.SongName, artistName, file.OriginalName, file.MusicalKey);

                if (file.Filename == expectedFilename) continue;

                var currentPath = _fileService.GetAbsolutePath(file.FilePath);
                var directory = Path.GetDirectoryName(currentPath) ?? "";
                var targetPath = Path.Combine(directory, expectedFilename);

                if (string.Equals(currentPath, targetPath, StringComparison.OrdinalIgnoreCase))
                {
                    file.Filename = expectedFilename;
                    file.FilePath = _fileService.NormalizeToRelativePath(targetPath);
                    renamedCount++;
                    continue;
                }

                if (System.IO.File.Exists(targetPath))
                {
                    _logger.LogWarning("Normalize title {FileId}: skipped rename - target already exists at {TargetPath}", fileId, targetPath);
                    continue;
                }

                if (System.IO.File.Exists(currentPath))
                {
                    System.IO.File.Move(currentPath, targetPath);
                    file.Filename = expectedFilename;
                    file.FilePath = _fileService.NormalizeToRelativePath(targetPath);
                    renamedCount++;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao normalizar título do arquivo {FileId}", fileId);
                errors.Add($"Erro no arquivo {fileId}: {ex.Message}");
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            updated_count = updatedCount,
            renamed_count = renamedCount,
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

    [HttpGet("find-duplicates")]
    public async Task<ActionResult> FindDuplicates()
    {
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.AccessAdmin))
            return StatusCode(403, new { error = "Sem permissão" });

        var files = await _context.PdfFiles
            .Include(f => f.FileArtists).ThenInclude(fa => fa.Artist)
            .Select(f => new
            {
                f.Id,
                f.SongName,
                f.MusicalKey,
                f.Filename,
                f.FilePath,
                f.FileSize,
                f.UploadDate,
                f.WorkspaceId,
                Artist = f.FileArtists.Select(fa => fa.Artist.Name).FirstOrDefault() ?? ""
            })
            .ToListAsync();

        var duplicateGroups = files
            .GroupBy(f => new
            {
                Song = (f.SongName ?? "").Trim().ToLowerInvariant(),
                Artist = f.Artist.Trim().ToLowerInvariant(),
                Key = (f.MusicalKey ?? "").Trim().ToLowerInvariant()
            })
            .Where(g => g.Count() > 1)
            .Select(g => new
            {
                song_name = g.First().SongName ?? "",
                artist = g.First().Artist,
                musical_key = g.First().MusicalKey ?? "",
                files = g.Select(f => new
                {
                    id = f.Id,
                    filename = f.Filename,
                    file_path = f.FilePath,
                    file_size = f.FileSize,
                    upload_date = f.UploadDate,
                    workspace_id = f.WorkspaceId
                }).OrderBy(f => f.upload_date).ToList()
            })
            .OrderBy(g => g.song_name)
            .ToList();

        return Ok(new
        {
            total_groups = duplicateGroups.Count,
            total_duplicate_files = duplicateGroups.Sum(g => g.files.Count),
            groups = duplicateGroups
        });
    }

    [HttpPost("delete-duplicate")]
    public async Task<ActionResult> DeleteDuplicate([FromBody] DeleteDuplicateRequest request)
    {
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.AccessAdmin))
            return StatusCode(403, new { error = "Sem permissão" });

        var file = await _context.PdfFiles
            .Include(f => f.FileArtists)
            .Include(f => f.FileCategories)
            .Include(f => f.MergeListItems)
            .FirstOrDefaultAsync(f => f.Id == request.FileId);

        if (file == null)
            return NotFound(new { error = "Arquivo não encontrado" });

        if (file.MergeListItems.Any())
            return BadRequest(new { error = $"Este arquivo está em {file.MergeListItems.Count} lista(s). Remova-o das listas antes de excluir." });

        var absolutePath = _fileService.GetAbsolutePath(file.FilePath);
        if (System.IO.File.Exists(absolutePath))
            System.IO.File.Delete(absolutePath);

        _context.FileArtists.RemoveRange(file.FileArtists);
        _context.FileCategories.RemoveRange(file.FileCategories);
        _context.PdfFiles.Remove(file);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Arquivo duplicado excluído com sucesso." });
    }

    [HttpGet("scan-legacy-files")]
    public async Task<ActionResult> ScanLegacyFiles()
    {
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.AccessAdmin))
            return StatusCode(403, new { error = "Sem permissão" });

        var workspaceSlugs = await _context.Workspaces
            .Select(w => w.Slug)
            .ToListAsync();

        // _organizedFolder is the root (e.g. C:\...\backend\organized)
        // Workspace slugs are direct children (e.g. organized/igreja/)
        // Legacy dirs are also direct children (e.g. organized/Aclamação/)
        var organizedRoot = _fileService.GetAbsolutePath("organized/").TrimEnd(Path.DirectorySeparatorChar);

        if (!Directory.Exists(organizedRoot))
            return Ok(new { legacy_directories = Array.Empty<object>(), total_legacy_files = 0, total_size_bytes = 0L });

        var allDirs = Directory.GetDirectories(organizedRoot);
        var legacyDirs = allDirs
            .Where(d => !workspaceSlugs.Contains(Path.GetFileName(d), StringComparer.OrdinalIgnoreCase))
            .ToList();

        var results = new List<object>();
        var totalLegacyFiles = 0;
        long totalSizeBytes = 0;
        var duplicateCount = 0;
        var uniqueCount = 0;

        foreach (var legacyDir in legacyDirs)
        {
            var dirName = Path.GetFileName(legacyDir);
            var pdfs = Directory.GetFiles(legacyDir, "*.pdf", SearchOption.AllDirectories);

            var files = new List<object>();
            foreach (var pdf in pdfs)
            {
                var fileName = Path.GetFileName(pdf);
                var fileInfo = new FileInfo(pdf);
                var relativeCategoryPath = Path.GetRelativePath(organizedRoot, Path.GetDirectoryName(pdf)!);

                var isDuplicate = false;
                foreach (var slug in workspaceSlugs)
                {
                    var newPath = Path.Combine(organizedRoot, slug, relativeCategoryPath, fileName);
                    if (System.IO.File.Exists(newPath))
                    {
                        isDuplicate = true;
                        break;
                    }
                }

                files.Add(new
                {
                    filename = fileName,
                    relative_path = Path.GetRelativePath(organizedRoot, pdf).Replace('\\', '/'),
                    size = fileInfo.Length,
                    is_duplicate = isDuplicate
                });

                totalSizeBytes += fileInfo.Length;
                if (isDuplicate) duplicateCount++; else uniqueCount++;
            }

            if (files.Any())
            {
                results.Add(new
                {
                    directory = dirName,
                    file_count = files.Count,
                    files
                });
                totalLegacyFiles += files.Count;
            }
        }

        return Ok(new
        {
            legacy_directories = results,
            total_legacy_files = totalLegacyFiles,
            duplicate_count = duplicateCount,
            unique_count = uniqueCount,
            total_size_bytes = totalSizeBytes,
            total_size_mb = Math.Round(totalSizeBytes / 1048576.0, 2)
        });
    }

    [HttpPost("cleanup-legacy-files")]
    public async Task<ActionResult> CleanupLegacyFiles()
    {
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.AccessAdmin))
            return StatusCode(403, new { error = "Sem permissão" });

        var workspaceSlugs = await _context.Workspaces
            .Select(w => w.Slug)
            .ToListAsync();

        var organizedRoot = _fileService.GetAbsolutePath("organized/").TrimEnd(Path.DirectorySeparatorChar);

        if (!Directory.Exists(organizedRoot))
            return Ok(new { deleted = 0, moved = 0, errors = Array.Empty<string>() });

        var allDirs = Directory.GetDirectories(organizedRoot);
        var legacyDirs = allDirs
            .Where(d => !workspaceSlugs.Contains(Path.GetFileName(d), StringComparer.OrdinalIgnoreCase))
            .ToList();

        var defaultSlug = workspaceSlugs.FirstOrDefault() ?? "igreja";
        var deletedCount = 0;
        var movedCount = 0;
        var errors = new List<string>();

        foreach (var legacyDir in legacyDirs)
        {
            var pdfs = Directory.GetFiles(legacyDir, "*.pdf", SearchOption.AllDirectories);

            foreach (var pdf in pdfs)
            {
                try
                {
                    var fileName = Path.GetFileName(pdf);
                    var relativeCategoryPath = Path.GetRelativePath(organizedRoot, Path.GetDirectoryName(pdf)!);
                    var targetDir = Path.Combine(organizedRoot, defaultSlug, relativeCategoryPath);
                    var targetPath = Path.Combine(targetDir, fileName);

                    if (System.IO.File.Exists(targetPath))
                    {
                        System.IO.File.Delete(pdf);
                        deletedCount++;
                        _logger.LogInformation("Deleted legacy duplicate: {Path}", pdf);
                    }
                    else
                    {
                        Directory.CreateDirectory(targetDir);
                        System.IO.File.Move(pdf, targetPath);
                        movedCount++;
                        _logger.LogInformation("Moved legacy file: {From} -> {To}", pdf, targetPath);

                        var relativePath = $"organized/{defaultSlug}/{relativeCategoryPath}/{fileName}".Replace('\\', '/');
                        var oldRelativePath = $"organized/{relativeCategoryPath}/{fileName}".Replace('\\', '/');
                        var dbFile = await _context.PdfFiles.FirstOrDefaultAsync(f => f.FilePath == oldRelativePath);
                        if (dbFile != null)
                        {
                            dbFile.FilePath = relativePath;
                            _logger.LogInformation("Updated DB path for file {Id}: {Old} -> {New}", dbFile.Id, oldRelativePath, relativePath);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing legacy file: {Path}", pdf);
                    errors.Add($"{Path.GetFileName(pdf)}: {ex.Message}");
                }
            }
        }

        await _context.SaveChangesAsync();

        var removedDirs = 0;
        foreach (var legacyDir in legacyDirs.OrderByDescending(d => d.Length))
        {
            try
            {
                CleanEmptyDirectories(legacyDir);
                if (Directory.Exists(legacyDir) && !Directory.EnumerateFileSystemEntries(legacyDir).Any())
                {
                    Directory.Delete(legacyDir, false);
                    removedDirs++;
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug("Could not remove directory {Dir}: {Message}", legacyDir, ex.Message);
            }
        }

        return Ok(new
        {
            deleted = deletedCount,
            moved = movedCount,
            directories_removed = removedDirs,
            errors = errors.Any() ? errors : null
        });
    }

    private static void CleanEmptyDirectories(string rootDir)
    {
        foreach (var dir in Directory.GetDirectories(rootDir))
        {
            CleanEmptyDirectories(dir);
            if (!Directory.EnumerateFileSystemEntries(dir).Any())
            {
                try { Directory.Delete(dir, false); }
                catch { /* ignore */ }
            }
        }
    }

    [HttpPost("replace-duplicates")]
    public async Task<ActionResult> ReplaceDuplicates([FromBody] ReplaceDuplicateRequest request)
    {
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.AccessAdmin))
            return StatusCode(403, new { error = "Sem permissão" });

        if (request.RemoveFileIds == null || !request.RemoveFileIds.Any())
            return BadRequest(new { error = "Nenhum arquivo para substituir" });

        var keepFile = await _context.PdfFiles.FindAsync(request.KeepFileId);
        if (keepFile == null)
            return NotFound(new { error = "Arquivo a manter não encontrado" });

        var listsUpdated = 0;
        var itemsRemoved = 0;
        var filesDeleted = 0;
        var errors = new List<string>();

        foreach (var removeFileId in request.RemoveFileIds)
        {
            if (removeFileId == request.KeepFileId) continue;

            try
            {
                var removeFile = await _context.PdfFiles
                    .Include(f => f.FileArtists)
                    .Include(f => f.FileCategories)
                    .Include(f => f.MergeListItems)
                    .FirstOrDefaultAsync(f => f.Id == removeFileId);

                if (removeFile == null)
                {
                    errors.Add($"Arquivo {removeFileId} não encontrado");
                    continue;
                }

                // Migrate list references
                foreach (var listItem in removeFile.MergeListItems.ToList())
                {
                    var keepAlreadyInList = await _context.MergeListItems
                        .AnyAsync(i => i.MergeListId == listItem.MergeListId && i.PdfFileId == request.KeepFileId);

                    if (keepAlreadyInList)
                    {
                        _context.MergeListItems.Remove(listItem);
                        itemsRemoved++;
                    }
                    else
                    {
                        listItem.PdfFileId = request.KeepFileId;
                        listsUpdated++;
                    }
                }

                // Delete physical file
                var absolutePath = _fileService.GetAbsolutePath(removeFile.FilePath);
                if (System.IO.File.Exists(absolutePath))
                    System.IO.File.Delete(absolutePath);

                // Remove relationships and the file record
                _context.FileArtists.RemoveRange(removeFile.FileArtists);
                _context.FileCategories.RemoveRange(removeFile.FileCategories);
                _context.PdfFiles.Remove(removeFile);
                filesDeleted++;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao substituir duplicata {RemoveFileId} por {KeepFileId}", removeFileId, request.KeepFileId);
                errors.Add($"Erro no arquivo {removeFileId}: {ex.Message}");
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = $"{filesDeleted} arquivo(s) substituído(s) com sucesso.",
            files_deleted = filesDeleted,
            lists_updated = listsUpdated,
            items_removed = itemsRemoved,
            errors = errors.Any() ? errors : null
        });
    }
}
