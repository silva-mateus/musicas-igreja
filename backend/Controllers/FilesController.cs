using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Models;
using MusicasIgreja.Api.Services;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/files")]
public class FilesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IFileService _fileService;
    private readonly ILogger<FilesController> _logger;

    public FilesController(AppDbContext context, IFileService fileService, ILogger<FilesController> logger)
    {
        _context = context;
        _fileService = fileService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<FileListResponseDto>> GetFiles(
        [FromQuery] string? q = null,
        [FromQuery] string? category = null,
        [FromQuery] string? liturgical_time = null,
        [FromQuery] int page = 1,
        [FromQuery] int per_page = 20)
    {
        var query = _context.PdfFiles
            .Include(f => f.FileCategories).ThenInclude(fc => fc.Category)
            .Include(f => f.FileLiturgicalTimes).ThenInclude(flt => flt.LiturgicalTime)
            .AsQueryable();

        // Apply search filter
        if (!string.IsNullOrWhiteSpace(q))
        {
            var searchTerm = q.ToLower();
            query = query.Where(f =>
                (f.SongName != null && f.SongName.ToLower().Contains(searchTerm)) ||
                (f.Artist != null && f.Artist.ToLower().Contains(searchTerm)) ||
                f.Filename.ToLower().Contains(searchTerm));
        }

        // Apply category filter
        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(f =>
                f.Category == category ||
                f.FileCategories.Any(fc => fc.Category.Name == category));
        }

        // Apply liturgical time filter
        if (!string.IsNullOrWhiteSpace(liturgical_time))
        {
            query = query.Where(f =>
                f.LiturgicalTime == liturgical_time ||
                f.FileLiturgicalTimes.Any(flt => flt.LiturgicalTime.Name == liturgical_time));
        }

        var total = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(total / (double)per_page);

        var files = await query
            .OrderByDescending(f => f.UploadDate)
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
        [FromForm] string? description = null)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { success = false, error = "Nenhum arquivo enviado" });

        if (!file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { success = false, error = "Apenas arquivos PDF são permitidos" });

        try
        {
            var result = await _fileService.SaveFileAsync(file, new FileUploadDto
            {
                SongName = song_name,
                Artist = artist,
                Categories = categories,
                LiturgicalTimes = liturgical_times,
                MusicalKey = musical_key,
                YoutubeLink = youtube_link,
                Description = description
            });

            return StatusCode(201, new
            {
                success = true,
                file_id = result.Id,
                filename = result.Filename
            });
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("duplicado"))
        {
            return Conflict(new { success = false, error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao fazer upload do arquivo");
            return StatusCode(500, new { success = false, error = "Erro interno ao processar arquivo" });
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<object>> UpdateFile(int id, [FromBody] FileUpdateDto dto)
    {
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
        var file = await _context.PdfFiles.FindAsync(id);
        if (file == null)
            return NotFound(new { success = false, error = "Arquivo não encontrado" });

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

        var stream = new FileStream(absolutePath, FileMode.Open, FileAccess.Read);
        return File(stream, "application/pdf", file.Filename);
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

        var stream = new FileStream(absolutePath, FileMode.Open, FileAccess.Read);
        return File(stream, "application/pdf");
    }
}

