using Core.Auth.Helpers;
using Core.Auth.Services;
using Microsoft.AspNetCore.Mvc;
using MusicasIgreja.Api;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Models;
using MusicasIgreja.Api.Services;
using MusicasIgreja.Api.Services.Interfaces;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/files")]
public class FilesController : ControllerBase
{
    private readonly IMusicService _musicService;
    private readonly IFileService _fileService;
    private readonly ICoreAuthService _authService;
    private readonly IMonitoringService _monitoringService;
    private readonly ILogger<FilesController> _logger;

    public FilesController(
        IMusicService musicService,
        IFileService fileService,
        ICoreAuthService authService,
        IMonitoringService monitoringService,
        ILogger<FilesController> logger)
    {
        _musicService = musicService;
        _fileService = fileService;
        _authService = authService;
        _monitoringService = monitoringService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<FileListResponseDto>> GetFiles(
        [FromQuery] int workspace_id = 1,
        [FromQuery] string? q = null,
        [FromQuery] List<string>? category = null,
        [FromQuery] List<string>? artist = null,
        [FromQuery] string? musical_key = null,
        [FromQuery] bool? has_youtube = null,
        [FromQuery] int page = 1,
        [FromQuery] int per_page = 20,
        [FromQuery] string? sort_by = "upload_date",
        [FromQuery] string? sort_order = "desc")
    {
        var customFilters = ParseCustomFilters();

        var result = await _musicService.GetMusicsAsync(
            workspace_id, q, category, customFilters, artist, musical_key,
            page, per_page, sort_by, sort_order, has_youtube);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<object>> GetFile(int id)
    {
        var dto = await _musicService.GetMusicByIdAsync(id);
        if (dto == null)
            return NotFound(new { success = false, error = "Arquivo não encontrado" });
        return Ok(new { success = true, file = dto });
    }

    [HttpPost]
    [RequestSizeLimit(52_428_800)]
    public async Task<ActionResult<object>> UploadFile(
        IFormFile file,
        [FromForm] int workspace_id = 1,
        [FromForm] string? song_name = null,
        [FromForm] string? artist = null,
        [FromForm] List<string>? categories = null,
        [FromForm] string? musical_key = null,
        [FromForm] string? youtube_link = null,
        [FromForm] string? description = null,
        [FromForm] List<string>? new_categories = null,
        [FromForm] string? new_artist = null,
        [FromForm] string? custom_filters_json = null)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });

        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.UploadMusic))
            return StatusCode(403, new { error = "Sem permissão" });

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
            var allCategories = (categories ?? []).Concat(new_categories ?? [])
                .Where(c => !string.IsNullOrWhiteSpace(c)).Distinct().ToList();
            var finalArtist = !string.IsNullOrWhiteSpace(new_artist) && string.IsNullOrWhiteSpace(artist) ? new_artist : artist;

            Dictionary<string, List<string>>? customFilters = null;
            if (!string.IsNullOrEmpty(custom_filters_json))
            {
                try
                {
                    customFilters = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, List<string>>>(custom_filters_json);
                }
                catch (System.Text.Json.JsonException ex)
                {
                    _logger.LogWarning(ex, "Failed to parse custom_filters_json: {Json}", custom_filters_json);
                }
            }

            var result = await _musicService.UploadMusicAsync(workspace_id, file, new FileUploadDto
            {
                SongName = song_name,
                Artist = finalArtist,
                Categories = allCategories,
                CustomFilters = customFilters,
                MusicalKey = musical_key,
                YoutubeLink = youtube_link,
                Description = description
            });

            var userId = CoreAuthHelper.GetCurrentUserId(HttpContext) ?? 0;
            var username = CoreAuthHelper.GetCurrentUsername(HttpContext) ?? "unknown";
            var ipAddress = CoreAuthHelper.GetClientIp(HttpContext);

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
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });

        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.EditMetadata))
            return StatusCode(403, new { error = "Sem permissão" });

        var success = await _musicService.UpdateMusicAsync(id, dto);
        if (!success)
            return NotFound(new { success = false, error = "Arquivo não encontrado" });

        return Ok(new { success = true });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<object>> DeleteFile(int id)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });

        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.DeleteMusic))
            return StatusCode(403, new { error = "Sem permissão" });

        var userId = CoreAuthHelper.GetCurrentUserId(HttpContext) ?? 0;
        var username = CoreAuthHelper.GetCurrentUsername(HttpContext) ?? "unknown";
        var ipAddress = CoreAuthHelper.GetClientIp(HttpContext);
        await _monitoringService.LogAuditActionAsync("delete", "file", id, userId, username, ipAddress);

        var success = await _musicService.DeleteMusicAsync(id);
        if (!success)
            return NotFound(new { success = false, error = "Arquivo não encontrado" });

        return Ok(new { success = true });
    }

    [HttpGet("{id}/download")]
    public async Task<IActionResult> DownloadFile(int id)
    {
        var file = await _musicService.GetFileRecordByIdAsync(id);
        if (file == null)
            return NotFound(new { success = false, error = "Arquivo não encontrado" });

        var absolutePath = ResolveFilePath(file);
        if (absolutePath == null)
            return NotFound(new { success = false, error = "Arquivo físico não encontrado" });

        return PhysicalFile(absolutePath, "application/pdf", file.Filename);
    }

    [HttpGet("{id}/stream")]
    public async Task<IActionResult> StreamFile(int id)
    {
        var file = await _musicService.GetFileRecordByIdAsync(id);
        if (file == null)
            return NotFound(new { success = false, error = "Arquivo não encontrado" });

        var absolutePath = ResolveFilePath(file);
        if (absolutePath == null)
            return NotFound(new { success = false, error = "Arquivo físico não encontrado" });

        return PhysicalFile(absolutePath, "application/pdf");
    }

    [HttpPost("{id}/replace_pdf")]
    [RequestSizeLimit(52_428_800)]
    public async Task<ActionResult<object>> ReplacePdf(int id, IFormFile replacement_pdf)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });

        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.EditMetadata))
            return StatusCode(403, new { error = "Sem permissão" });

        if (replacement_pdf == null || replacement_pdf.Length == 0)
            return BadRequest(new { success = false, error = "Nenhum arquivo enviado" });

        if (!replacement_pdf.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { success = false, error = "Apenas arquivos PDF são permitidos" });

        try
        {
            var file = await _musicService.ReplacePdfAsync(id, replacement_pdf);

            _logger.LogInformation("PDF replaced: {FileId}, new size: {Size} bytes", id, file.FileSize);

            return Ok(new
            {
                success = true,
                message = "PDF substituído com sucesso",
                file_id = file.Id,
                new_size = file.FileSize,
                new_pages = file.PageCount
            });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { success = false, error = "Arquivo não encontrado" });
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("duplicado"))
        {
            return Conflict(new { success = false, error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao substituir PDF para o arquivo {FileId}", id);
            return StatusCode(500, new { success = false, error = "Erro ao substituir PDF: " + ex.Message });
        }
    }

    [HttpGet("grouped/by-artist")]
    public async Task<ActionResult<object>> GetFilesGroupedByArtist([FromQuery] int workspace_id = 1)
    {
        var groups = await _musicService.GetGroupedByArtistAsync(workspace_id);
        return Ok(new { success = true, groups, total_artists = groups.Count });
    }

    [HttpGet("grouped/by-category")]
    public async Task<ActionResult<object>> GetFilesGroupedByCategory([FromQuery] int workspace_id = 1)
    {
        var groups = await _musicService.GetGroupedByCategoryAsync(workspace_id);
        return Ok(new { success = true, groups, total_categories = groups.Count });
    }

    [HttpGet("grouped/by-custom-filter/{groupSlug}")]
    public async Task<ActionResult<object>> GetFilesGroupedByCustomFilter(string groupSlug, [FromQuery] int workspace_id = 1)
    {
        var groups = await _musicService.GetGroupedByCustomFilterAsync(workspace_id, groupSlug);
        return Ok(new { success = true, groups, total_groups = groups.Count });
    }

    private Dictionary<string, List<string>>? ParseCustomFilters()
    {
        const string prefix = "custom_filter_";
        var result = new Dictionary<string, List<string>>();

        foreach (var key in Request.Query.Keys)
        {
            if (!key.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) continue;
            var groupSlug = key[prefix.Length..];
            var values = Request.Query[key].Where(v => !string.IsNullOrWhiteSpace(v)).ToList();
            if (values.Count > 0)
                result[groupSlug] = values!;
        }

        return result.Count > 0 ? result : null;
    }

    private string? ResolveFilePath(PdfFile file)
    {
        // Try stored FilePath first (most reliable)
        if (!string.IsNullOrEmpty(file.FilePath))
        {
            var storedPath = _fileService.GetAbsolutePath(file.FilePath);
            if (System.IO.File.Exists(storedPath)) return storedPath;
        }

        // Fallback: organized/{Filename}
        var organizedPath = _fileService.GetAbsolutePath($"organized/{file.Filename}");
        if (System.IO.File.Exists(organizedPath)) return organizedPath;

        // Fallback: recursive search by filename
        var baseDir = _fileService.GetAbsolutePath("organized");
        if (Directory.Exists(baseDir))
        {
            var found = Directory.GetFiles(baseDir, file.Filename, SearchOption.AllDirectories);
            if (found.Length > 0) return found[0];
        }

        return null;
    }
}
