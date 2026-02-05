using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Helpers;
using MusicasIgreja.Api.Models;
using MusicasIgreja.Api.Services;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/files")]
public class FilesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IFileService _fileService;
    private readonly IAuthService _authService;
    private readonly IMonitoringService _monitoringService;
    private readonly ILogger<FilesController> _logger;

    public FilesController(AppDbContext context, IFileService fileService, IAuthService authService, IMonitoringService monitoringService, ILogger<FilesController> logger)
    {
        _context = context;
        _fileService = fileService;
        _authService = authService;
        _monitoringService = monitoringService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<FileListResponseDto>> GetFiles(
        [FromQuery] string? q = null,
        [FromQuery] List<string>? category = null,
        [FromQuery] List<string>? liturgical_time = null,
        [FromQuery] List<string>? artist = null,
        [FromQuery] string? musical_key = null,
        [FromQuery] int page = 1,
        [FromQuery] int per_page = 20,
        [FromQuery] string? sort_by = "upload_date",
        [FromQuery] string? sort_order = "desc")
    {
        var query = _context.PdfFiles
            .Include(f => f.FileCategories).ThenInclude(fc => fc.Category)
            .Include(f => f.FileLiturgicalTimes).ThenInclude(flt => flt.LiturgicalTime)
            .AsQueryable();

        // Apply search filter with accent-insensitive matching
        if (!string.IsNullOrWhiteSpace(q))
        {
            // Get all files and filter in memory for accent-insensitive search
            var allFiles = await query.ToListAsync();
            var filteredIds = allFiles
                .Where(f => 
                    TextHelper.ContainsIgnoreAccents(f.SongName, q) ||
                    TextHelper.ContainsIgnoreAccents(f.Artist, q) ||
                    TextHelper.ContainsIgnoreAccents(f.Filename, q))
                .Select(f => f.Id)
                .ToList();
            
            query = _context.PdfFiles
                .Include(f => f.FileCategories).ThenInclude(fc => fc.Category)
                .Include(f => f.FileLiturgicalTimes).ThenInclude(flt => flt.LiturgicalTime)
                .Where(f => filteredIds.Contains(f.Id));
        }

        // Apply category filter (supports multiple categories with OR logic)
        var categories = category?.Where(c => !string.IsNullOrWhiteSpace(c)).ToList();
        if (categories != null && categories.Count > 0)
        {
            query = query.Where(f =>
                categories.Contains(f.Category!) ||
                f.FileCategories.Any(fc => categories.Contains(fc.Category.Name)));
        }

        // Apply liturgical time filter (supports multiple times with OR logic)
        var liturgicalTimes = liturgical_time?.Where(t => !string.IsNullOrWhiteSpace(t)).ToList();
        if (liturgicalTimes != null && liturgicalTimes.Count > 0)
        {
            query = query.Where(f =>
                liturgicalTimes.Contains(f.LiturgicalTime!) ||
                f.FileLiturgicalTimes.Any(flt => liturgicalTimes.Contains(flt.LiturgicalTime.Name)));
        }

        // Apply artist filter (supports multiple artists with OR logic)
        var artists = artist?.Where(a => !string.IsNullOrWhiteSpace(a)).ToList();
        if (artists != null && artists.Count > 0)
        {
            query = query.Where(f => artists.Contains(f.Artist!));
        }

        // Apply musical key filter
        if (!string.IsNullOrWhiteSpace(musical_key))
        {
            query = query.Where(f => f.MusicalKey == musical_key);
        }

        var total = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(total / (double)per_page);

        // Apply sorting
        query = (sort_by?.ToLower(), sort_order?.ToLower()) switch
        {
            ("song_name", "asc") => query.OrderBy(f => f.SongName),
            ("song_name", "desc") => query.OrderByDescending(f => f.SongName),
            ("artist", "asc") => query.OrderBy(f => f.Artist),
            ("artist", "desc") => query.OrderByDescending(f => f.Artist),
            ("category", "asc") => query.OrderBy(f => f.Category),
            ("category", "desc") => query.OrderByDescending(f => f.Category),
            ("upload_date", "asc") => query.OrderBy(f => f.UploadDate),
            _ => query.OrderByDescending(f => f.UploadDate) // Default: newest first
        };

        var files = await query
            .Skip((page - 1) * per_page)
            .Take(per_page)
            .ToListAsync();

        var fileDtos = files.Select(f => new FileDto(
            f.Id,
            f.Filename,
            f.OriginalName,
            f.SongName,
            f.Artist,
            f.Category,
            f.LiturgicalTime,
            f.FileCategories.Select(fc => fc.Category.Name).ToList(),
            f.FileLiturgicalTimes.Select(flt => flt.LiturgicalTime.Name).ToList(),
            f.MusicalKey,
            f.YoutubeLink,
            f.FileSize,
            f.PageCount,
            f.UploadDate,
            f.Description
        )).ToList();

        return Ok(new FileListResponseDto(
            fileDtos,
            new PaginationDto(page, per_page, total, totalPages)
        ));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<object>> GetFile(int id)
    {
        var file = await _context.PdfFiles
            .Include(f => f.FileCategories).ThenInclude(fc => fc.Category)
            .Include(f => f.FileLiturgicalTimes).ThenInclude(flt => flt.LiturgicalTime)
            .FirstOrDefaultAsync(f => f.Id == id);

        if (file == null)
            return NotFound(new { success = false, error = "Arquivo não encontrado" });

        var dto = new FileDto(
            file.Id,
            file.Filename,
            file.OriginalName,
            file.SongName,
            file.Artist,
            file.Category,
            file.LiturgicalTime,
            file.FileCategories.Select(fc => fc.Category.Name).ToList(),
            file.FileLiturgicalTimes.Select(flt => flt.LiturgicalTime.Name).ToList(),
            file.MusicalKey,
            file.YoutubeLink,
            file.FileSize,
            file.PageCount,
            file.UploadDate,
            file.Description
        );

        return Ok(new { success = true, file = dto });
    }

    [HttpPost]
    [RequestSizeLimit(52_428_800)] // 50MB
    public async Task<ActionResult<object>> UploadFile(
        IFormFile file,
        [FromForm] string? song_name = null,
        [FromForm] string? artist = null,
        [FromForm] List<string>? categories = null,
        [FromForm] List<string>? liturgical_times = null,
        [FromForm] string? musical_key = null,
        [FromForm] string? youtube_link = null,
        [FromForm] string? description = null,
        [FromForm] List<string>? new_categories = null,
        [FromForm] List<string>? new_liturgical_times = null,
        [FromForm] string? new_artist = null)
    {
        // Check authentication
        var authCheck = AuthHelper.CheckAuthentication(HttpContext, _logger);
        if (authCheck != null) return authCheck;

        // Check upload permission
        var canUpload = await AuthHelper.HasPermissionAsync(HttpContext, _authService, role => role.CanUploadMusic);
        var permissionCheck = AuthHelper.CheckPermission(HttpContext, canUpload, _logger);
        if (permissionCheck != null) return permissionCheck;

        if (file == null || file.Length == 0)
            return BadRequest(new FileUploadResultDto
            {
                OriginalName = file?.FileName ?? "unknown",
                Size = file?.Length ?? 0,
                Status = "error",
                Message = "Nenhum arquivo enviado"
            });

        if (!file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new FileUploadResultDto
            {
                OriginalName = file.FileName,
                Size = file.Length,
                Status = "error",
                Message = "Apenas arquivos PDF são permitidos"
            });

        try
        {
            // Merge new categories/times with selected ones
            var allCategories = (categories ?? new List<string>()).Concat(new_categories ?? new List<string>()).Where(c => !string.IsNullOrWhiteSpace(c)).Distinct().ToList();
            var allLiturgicalTimes = (liturgical_times ?? new List<string>()).Concat(new_liturgical_times ?? new List<string>()).Where(t => !string.IsNullOrWhiteSpace(t)).Distinct().ToList();
            
            // Handle new artist
            var finalArtist = artist;
            if (!string.IsNullOrWhiteSpace(new_artist) && string.IsNullOrWhiteSpace(artist))
            {
                finalArtist = new_artist;
                // Create artist if it doesn't exist
                var existingArtist = await _context.Artists.FirstOrDefaultAsync(a => a.Name == new_artist);
                if (existingArtist == null)
                {
                    _context.Artists.Add(new Artist { Name = new_artist });
                    await _context.SaveChangesAsync();
                }
            }

            var result = await _fileService.SaveFileAsync(file, new FileUploadDto
            {
                SongName = song_name,
                Artist = finalArtist,
                Categories = allCategories,
                LiturgicalTimes = allLiturgicalTimes,
                MusicalKey = musical_key,
                YoutubeLink = youtube_link,
                Description = description
            });

            // Log upload metrics and audit
            var userId = HttpContext.Session.GetInt32("UserId") ?? 0;
            var username = HttpContext.Session.GetString("Username") ?? "unknown";
            var ipAddress = AuthHelper.GetClientIp(HttpContext);
            
            await _monitoringService.RecordMetricAsync("upload_size", file.Length / (1024.0 * 1024.0), "MB");
            await _monitoringService.LogAuditActionAsync("upload", "file", result.Id, userId, username, ipAddress);

            return StatusCode(201, new FileUploadResultDto
            {
                Filename = result.Filename,
                OriginalName = result.OriginalName,
                Size = result.FileSize ?? 0,
                Status = "success",
                Message = "Arquivo enviado com sucesso",
                FileId = result.Id
            });
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("duplicado"))
        {
            // Extract duplicate filename from error message
            var duplicateFilename = ex.Message.Replace("Arquivo duplicado encontrado: ", "");
            
            return StatusCode(409, new FileUploadResultDto
            {
                OriginalName = file.FileName,
                Size = file.Length,
                Status = "duplicate",
                DuplicateOf = duplicateFilename,
                Message = $"Arquivo duplicado: {duplicateFilename}"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao fazer upload do arquivo");
            return StatusCode(500, new FileUploadResultDto
            {
                OriginalName = file.FileName,
                Size = file.Length,
                Status = "error",
                Message = $"Erro ao processar arquivo: {ex.Message}"
            });
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<object>> UpdateFile(int id, [FromBody] FileUpdateDto dto)
    {
        // Check authentication
        var authCheck = AuthHelper.CheckAuthentication(HttpContext, _logger);
        if (authCheck != null) return authCheck;

        // Check edit permission
        var canEdit = await AuthHelper.HasPermissionAsync(HttpContext, _authService, role => role.CanEditMusicMetadata);
        var permissionCheck = AuthHelper.CheckPermission(HttpContext, canEdit, _logger);
        if (permissionCheck != null) return permissionCheck;

        var file = await _context.PdfFiles
            .Include(f => f.FileCategories)
            .Include(f => f.FileLiturgicalTimes)
            .FirstOrDefaultAsync(f => f.Id == id);

        if (file == null)
            return NotFound(new { success = false, error = "Arquivo não encontrado" });

        // Update basic fields
        if (dto.SongName != null) file.SongName = dto.SongName;
        if (dto.Artist != null) file.Artist = dto.Artist;
        if (dto.MusicalKey != null) file.MusicalKey = dto.MusicalKey;
        if (dto.YoutubeLink != null) file.YoutubeLink = dto.YoutubeLink;
        if (dto.Description != null) file.Description = dto.Description;

        // Update categories
        if (dto.Categories != null)
        {
            _context.FileCategories.RemoveRange(file.FileCategories);
            
            foreach (var catName in dto.Categories)
            {
                var category = await _context.Categories.FirstOrDefaultAsync(c => c.Name == catName);
                if (category == null)
                {
                    category = new Category { Name = catName };
                    _context.Categories.Add(category);
                    await _context.SaveChangesAsync();
                }
                
                file.FileCategories.Add(new FileCategory { FileId = file.Id, CategoryId = category.Id });
            }

            file.Category = dto.Categories.FirstOrDefault() ?? file.Category;
        }

        // Update liturgical times
        if (dto.LiturgicalTimes != null)
        {
            _context.FileLiturgicalTimes.RemoveRange(file.FileLiturgicalTimes);
            
            foreach (var ltName in dto.LiturgicalTimes)
            {
                var lt = await _context.LiturgicalTimes.FirstOrDefaultAsync(l => l.Name == ltName);
                if (lt == null)
                {
                    lt = new LiturgicalTime { Name = ltName };
                    _context.LiturgicalTimes.Add(lt);
                    await _context.SaveChangesAsync();
                }
                
                file.FileLiturgicalTimes.Add(new FileLiturgicalTime { FileId = file.Id, LiturgicalTimeId = lt.Id });
            }

            file.LiturgicalTime = dto.LiturgicalTimes.FirstOrDefault();
        }

        // Regenerate filename if needed
        file.Filename = _fileService.GenerateFilename(file.SongName, file.Artist, file.OriginalName, file.MusicalKey);

        await _context.SaveChangesAsync();

        return Ok(new { success = true });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<object>> DeleteFile(int id)
    {
        // Check authentication
        var authCheck = AuthHelper.CheckAuthentication(HttpContext, _logger);
        if (authCheck != null) return authCheck;

        // Check delete permission
        var canDelete = await AuthHelper.HasPermissionAsync(HttpContext, _authService, role => role.CanDeleteMusic);
        var permissionCheck = AuthHelper.CheckPermission(HttpContext, canDelete, _logger);
        if (permissionCheck != null) return permissionCheck;

        var file = await _context.PdfFiles.FindAsync(id);
        if (file == null)
            return NotFound(new { success = false, error = "Arquivo não encontrado" });

        // Log audit before deleting
        var userId = HttpContext.Session.GetInt32("UserId") ?? 0;
        var username = HttpContext.Session.GetString("Username") ?? "unknown";
        var ipAddress = AuthHelper.GetClientIp(HttpContext);
        
        await _monitoringService.LogAuditActionAsync("delete", "file", id, userId, username, ipAddress);

        // Delete physical file
        _fileService.DeleteFile(file.FilePath);

        _context.PdfFiles.Remove(file);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, deleted_filename = file.Filename });
    }

    [HttpGet("{id}/download")]
    public async Task<IActionResult> DownloadFile(int id)
    {
        var file = await _context.PdfFiles.FindAsync(id);
        if (file == null)
            return NotFound(new { success = false, error = "Arquivo não encontrado" });

        var absolutePath = _fileService.GetAbsolutePath(file.FilePath);
        if (!System.IO.File.Exists(absolutePath))
            return NotFound(new { success = false, error = "Arquivo físico não encontrado" });

        // Use PhysicalFile to ensure proper disposal
        return PhysicalFile(absolutePath, "application/pdf", file.Filename);
    }

    [HttpGet("{id}/stream")]
    public async Task<IActionResult> StreamFile(int id)
    {
        var file = await _context.PdfFiles.FindAsync(id);
        if (file == null)
            return NotFound(new { success = false, error = "Arquivo não encontrado" });

        var absolutePath = _fileService.GetAbsolutePath(file.FilePath);
        if (!System.IO.File.Exists(absolutePath))
            return NotFound(new { success = false, error = "Arquivo físico não encontrado" });

        // Use PhysicalFile to ensure proper disposal
        return PhysicalFile(absolutePath, "application/pdf");
    }

    [HttpGet("grouped/by-artist")]
    public async Task<ActionResult<object>> GetFilesGroupedByArtist()
    {
        var files = await _context.PdfFiles
            .Include(f => f.FileCategories).ThenInclude(fc => fc.Category)
            .Include(f => f.FileLiturgicalTimes).ThenInclude(flt => flt.LiturgicalTime)
            .Where(f => f.Artist != null && f.Artist != "")
            .OrderBy(f => f.Artist)
            .ThenBy(f => f.SongName)
            .ToListAsync();

        var grouped = files
            .GroupBy(f => f.Artist ?? "Sem Artista")
            .OrderBy(g => g.Key)
            .Select(g => new
            {
                artist = g.Key,
                count = g.Count(),
                files = g.Select(f => new
                {
                    id = f.Id,
                    filename = f.Filename,
                    song_name = f.SongName,
                    musical_key = f.MusicalKey,
                    category = f.Category,
                    categories = f.FileCategories.Select(fc => fc.Category.Name).ToList(),
                    liturgical_time = f.LiturgicalTime,
                    liturgical_times = f.FileLiturgicalTimes.Select(flt => flt.LiturgicalTime.Name).ToList(),
                    youtube_link = f.YoutubeLink
                })
            })
            .ToList();

        return Ok(new { success = true, groups = grouped, total_artists = grouped.Count });
    }

    [HttpGet("grouped/by-category")]
    public async Task<ActionResult<object>> GetFilesGroupedByCategory()
    {
        var files = await _context.PdfFiles
            .Include(f => f.FileCategories).ThenInclude(fc => fc.Category)
            .Include(f => f.FileLiturgicalTimes).ThenInclude(flt => flt.LiturgicalTime)
            .OrderBy(f => f.Category)
            .ThenBy(f => f.SongName)
            .ToListAsync();

        var grouped = files
            .GroupBy(f => f.Category ?? "Diversos")
            .OrderBy(g => g.Key)
            .Select(g => new
            {
                category = g.Key,
                count = g.Count(),
                files = g.Select(f => new
                {
                    id = f.Id,
                    filename = f.Filename,
                    song_name = f.SongName,
                    artist = f.Artist,
                    musical_key = f.MusicalKey,
                    categories = f.FileCategories.Select(fc => fc.Category.Name).ToList(),
                    liturgical_time = f.LiturgicalTime,
                    liturgical_times = f.FileLiturgicalTimes.Select(flt => flt.LiturgicalTime.Name).ToList(),
                    youtube_link = f.YoutubeLink
                })
            })
            .ToList();

        return Ok(new { success = true, groups = grouped, total_categories = grouped.Count });
    }

    [HttpGet("grouped/by-liturgical-time")]
    public async Task<ActionResult<object>> GetFilesGroupedByLiturgicalTime()
    {
        var files = await _context.PdfFiles
            .Include(f => f.FileCategories).ThenInclude(fc => fc.Category)
            .Include(f => f.FileLiturgicalTimes).ThenInclude(flt => flt.LiturgicalTime)
            .Where(f => f.LiturgicalTime != null && f.LiturgicalTime != "")
            .OrderBy(f => f.LiturgicalTime)
            .ThenBy(f => f.SongName)
            .ToListAsync();

        var grouped = files
            .GroupBy(f => f.LiturgicalTime ?? "Sem Tempo Litúrgico")
            .OrderBy(g => g.Key)
            .Select(g => new
            {
                liturgical_time = g.Key,
                count = g.Count(),
                files = g.Select(f => new
                {
                    id = f.Id,
                    filename = f.Filename,
                    song_name = f.SongName,
                    artist = f.Artist,
                    musical_key = f.MusicalKey,
                    category = f.Category,
                    categories = f.FileCategories.Select(fc => fc.Category.Name).ToList(),
                    liturgical_times = f.FileLiturgicalTimes.Select(flt => flt.LiturgicalTime.Name).ToList(),
                    youtube_link = f.YoutubeLink
                })
            })
            .ToList();

        return Ok(new { success = true, groups = grouped, total_liturgical_times = grouped.Count });
    }

    [HttpPost("{id}/replace_pdf")]
    [RequestSizeLimit(52_428_800)] // 50MB
    public async Task<ActionResult<object>> ReplacePdf(int id, IFormFile replacement_pdf)
    {
        if (replacement_pdf == null || replacement_pdf.Length == 0)
            return BadRequest(new { success = false, error = "Nenhum arquivo enviado" });

        if (!replacement_pdf.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { success = false, error = "Apenas arquivos PDF são permitidos" });

        var file = await _context.PdfFiles.FindAsync(id);
        if (file == null)
            return NotFound(new { success = false, error = "Arquivo não encontrado" });

        try
        {
            // Get the current file path
            var currentPath = _fileService.GetAbsolutePath(file.FilePath);

            // Delete the old file if it exists
            if (System.IO.File.Exists(currentPath))
            {
                System.IO.File.Delete(currentPath);
            }

            // Save the new file in the same location
            using (var stream = new FileStream(currentPath, FileMode.Create))
            {
                await replacement_pdf.CopyToAsync(stream);
            }

            // Update file metadata
            file.FileSize = replacement_pdf.Length;
            file.OriginalName = replacement_pdf.FileName;

            // Compute new hash
            using (var hashStream = new FileStream(currentPath, FileMode.Open, FileAccess.Read))
            {
                file.FileHash = _fileService.ComputeFileHash(hashStream);
            }

            // Get new page count
            file.PageCount = _fileService.GetPdfPageCount(currentPath);

            await _context.SaveChangesAsync();

            _logger.LogInformation("[Files] PDF replaced successfully: {FileId}, new size: {Size} bytes", id, file.FileSize);

            return Ok(new
            {
                success = true,
                message = "PDF substituído com sucesso",
                file_id = file.Id,
                new_size = file.FileSize,
                new_pages = file.PageCount
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao substituir PDF para o arquivo {FileId}", id);
            return StatusCode(500, new { success = false, error = "Erro ao substituir PDF: " + ex.Message });
        }
    }
}

