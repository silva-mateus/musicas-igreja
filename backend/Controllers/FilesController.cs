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
    private readonly IChordPdfRenderer _chordRenderer;
    private readonly System.Threading.Channels.ChannelWriter<OcrJob> _ocrWriter;
    private readonly ILogger<FilesController> _logger;

    public FilesController(
        IMusicService musicService,
        IFileService fileService,
        ICoreAuthService authService,
        IMonitoringService monitoringService,
        IChordPdfRenderer chordRenderer,
        System.Threading.Channels.ChannelWriter<OcrJob> ocrWriter,
        ILogger<FilesController> logger)
    {
        _musicService = musicService;
        _fileService = fileService;
        _authService = authService;
        _monitoringService = monitoringService;
        _chordRenderer = chordRenderer;
        _ocrWriter = ocrWriter;
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
        [FromForm] string? custom_filters_json = null,
        [FromForm] bool auto_ocr = true)
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

            if (auto_ocr && !string.IsNullOrEmpty(result.FilePath))
            {
                result.ContentType = "chord_converting";
                result.OcrStatus = "queued";
                await _musicService.SaveChangesAsync();
                var absPath = _fileService.GetAbsolutePath(result.FilePath);
                await _ocrWriter.WriteAsync(new OcrJob { FileId = result.Id, FilePath = absPath });
            }

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

        if (file.ContentType == "chord_converting")
            return StatusCode(202, new { status = file.OcrStatus, message = "Conversão em andamento" });

        if (file.ContentType == "chord")
        {
            if (string.IsNullOrEmpty(file.ChordContent))
                return BadRequest(new { error = "Conteúdo da cifra vazio" });

            try
            {
                var chordPdf = _chordRenderer.Render(file.ChordContent, file.MusicalKey);
                var ms = new MemoryStream();
                chordPdf.Save(ms, false);
                ms.Position = 0;
                var filename = $"{file.SongName ?? "cifra"}.pdf";
                return File(ms, "application/pdf", filename);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao gerar PDF da cifra {FileId}", id);
                return StatusCode(500, new { error = "Erro ao gerar PDF" });
            }
        }

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

        if (file.ContentType == "chord_converting")
            return StatusCode(202, new { status = file.OcrStatus, message = "Conversão em andamento" });

        if (file.ContentType == "chord")
        {
            if (string.IsNullOrEmpty(file.ChordContent))
                return BadRequest(new { error = "Conteúdo da cifra vazio" });

            try
            {
                var chordPdf = _chordRenderer.Render(file.ChordContent, file.MusicalKey);
                var ms = new MemoryStream();
                chordPdf.Save(ms, false);
                ms.Position = 0;
                return File(ms, "application/pdf");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao gerar PDF da cifra {FileId}", id);
                return StatusCode(500, new { error = "Erro ao gerar PDF" });
            }
        }

        var absolutePath = ResolveFilePath(file);
        if (absolutePath == null)
        {
            var storedRelative = file.FilePath ?? "(null)";
            var resolvedAttempt = string.IsNullOrEmpty(file.FilePath)
                ? "(no FilePath stored)"
                : _fileService.GetAbsolutePath(file.FilePath);
            var fileExists = !string.IsNullOrEmpty(resolvedAttempt) && System.IO.File.Exists(resolvedAttempt);
            _logger.LogWarning(
                "StreamFile: physical file not found for FileId={FileId} Filename={Filename} StoredPath={StoredPath} ResolvedPath={ResolvedPath} Exists={Exists} CWD={CWD}",
                id, file.Filename, storedRelative, resolvedAttempt, fileExists, Directory.GetCurrentDirectory());
            return NotFound(new { success = false, error = "Arquivo físico não encontrado", stored_path = storedRelative, resolved_path = resolvedAttempt });
        }

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
    }

    [HttpPost("batch-ocr")]
    public async Task<ActionResult<object>> BatchOcr(
        [FromBody] BatchOcrDto? dto,
        [FromQuery] int workspace_id = 1)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });

        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.EditMetadata))
            return StatusCode(403, new { error = "Sem permissão" });

        var files = await _musicService.GetPdfOnlyFilesAsync(workspace_id, dto?.Ids);
        if (files.Count == 0)
            return Ok(new { queued = 0, message = "Nenhum arquivo PDF encontrado para converter" });

        foreach (var file in files)
        {
            file.ContentType = "chord_converting";
            file.OcrStatus = "queued";
        }
        await _musicService.SaveChangesAsync();

        var queued = 0;
        foreach (var file in files)
        {
            var absPath = _fileService.GetAbsolutePath(file.FilePath!);
            await _ocrWriter.WriteAsync(new OcrJob { FileId = file.Id, FilePath = absPath });
            queued++;
        }

        return Ok(new { queued, message = $"{queued} arquivo(s) enfileirado(s) para conversão" });
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

    [HttpPost("chord")]
    public async Task<ActionResult<object>> CreateChordSong(
        [FromBody] CreateChordSongDto dto,
        [FromQuery] int workspace_id = 1)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });

        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.EditMetadata))
            return StatusCode(403, new { error = "Sem permissão" });

        if (string.IsNullOrWhiteSpace(dto.ChordContent))
            return BadRequest(new { error = "ChordContent não pode estar vazio" });

        try
        {
            var pdfFile = await _musicService.CreateChordSongAsync(workspace_id, dto);
            var fileId = pdfFile.Id;

            var userId = CoreAuthHelper.GetCurrentUserId(HttpContext) ?? 0;
            var username = CoreAuthHelper.GetCurrentUsername(HttpContext) ?? "unknown";
            var ipAddress = CoreAuthHelper.GetClientIp(HttpContext);
            await _monitoringService.LogAuditActionAsync("create_chord", "file", fileId, userId, username, ipAddress);

            return StatusCode(201, new { success = true, file_id = fileId, message = "Música em cifra criada com sucesso" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar música em cifra");
            return StatusCode(500, new { error = $"Erro ao processar: {ex.Message}" });
        }
    }

    [HttpGet("{id}/chord")]
    public async Task<ActionResult<object>> GetChordContent(int id)
    {
        var file = await _musicService.GetFileRecordByIdAsync(id);
        if (file == null)
            return NotFound(new { error = "Arquivo não encontrado" });

        if (file.ContentType != "chord")
            return BadRequest(new { error = "Arquivo não é uma cifra" });

        return Ok(new { success = true, chord_content = file.ChordContent, status = file.OcrStatus });
    }

    [HttpPut("{id}/chord")]
    public async Task<ActionResult<object>> UpdateChordContent(int id, [FromBody] UpdateChordContentDto dto)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });

        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.EditMetadata))
            return StatusCode(403, new { error = "Sem permissão" });

        try
        {
            var success = await _musicService.UpdateChordContentAsync(id, dto);
            if (!success)
                return NotFound(new { error = "Arquivo não encontrado" });

            return Ok(new { success = true, message = "Cifra atualizada com sucesso" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao atualizar cifra");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpDelete("{id}/chord/draft")]
    public async Task<ActionResult<object>> DiscardChordDraft(int id)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });

        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.EditMetadata))
            return StatusCode(403, new { error = "Sem permissão" });

        try
        {
            var success = await _musicService.DiscardChordDraftAsync(id);
            if (!success)
                return NotFound(new { error = "Arquivo não encontrado" });

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao descartar rascunho de cifra");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("{id}/preferences")]
    public async Task<ActionResult<object>> GetUserPreference(int id)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });

        var userIdStr = CoreAuthHelper.GetCurrentUserId(HttpContext)?.ToString();
        if (string.IsNullOrEmpty(userIdStr))
            return Unauthorized(new { error = "Usuário inválido" });

        var pref = await _musicService.GetUserPreferenceAsync(id, userIdStr);
        if (pref == null)
            return Ok(new { success = true, preferences = new UserSongPreferenceDto(0, 0, null) });

        return Ok(new { success = true, preferences = pref });
    }

    [HttpPut("{id}/preferences")]
    public async Task<ActionResult<object>> UpdateUserPreference(int id, [FromBody] UpdateUserSongPreferenceDto dto)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });

        var userIdStr = CoreAuthHelper.GetCurrentUserId(HttpContext)?.ToString();
        if (string.IsNullOrEmpty(userIdStr))
            return Unauthorized(new { error = "Usuário inválido" });

        try
        {
            var success = await _musicService.UpdateUserPreferenceAsync(id, userIdStr, dto);
            if (!success)
                return NotFound(new { error = "Arquivo não encontrado" });

            return Ok(new { success = true, message = "Preferências atualizadas com sucesso" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao atualizar preferências do usuário");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("{id}/ocr")]
    public async Task<ActionResult<object>> StartOcr(int id)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });

        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.EditMetadata))
            return StatusCode(403, new { error = "Sem permissão" });

        var file = await _musicService.GetFileRecordByIdAsync(id);
        if (file == null)
            return NotFound(new { error = "Arquivo não encontrado" });

        if (file.ContentType != "pdf_only")
            return BadRequest(new { error = "Apenas arquivos PDF podem ser convertidos" });

        if (string.IsNullOrEmpty(file.FilePath))
            return BadRequest(new { error = "Caminho do arquivo não encontrado" });

        try
        {
            file.OcrStatus = "queued";
            file.OcrError = null;
            await _musicService.SaveChangesAsync();

            var absPath = _fileService.GetAbsolutePath(file.FilePath);
            await _ocrWriter.WriteAsync(new OcrJob { FileId = id, FilePath = absPath });

            return Accepted(new { success = true, status = "queued", message = "OCR iniciado" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao iniciar OCR");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("{id}/ocr-status")]
    public async Task<ActionResult<object>> GetOcrStatus(int id)
    {
        var file = await _musicService.GetFileRecordByIdAsync(id);
        if (file == null)
            return NotFound(new { error = "Arquivo não encontrado" });

        return Ok(new
        {
            success = true,
            status = file.OcrStatus ?? "none",
            error = file.OcrError,
            started_at = file.OcrStartedAt
        });
    }

    [HttpPost("{id}/export-chord-pdf")]
    public async Task<IActionResult> ExportChordPdf(
        int id,
        [FromBody] ChordPdfExportDto? dto = null)
    {
        var file = await _musicService.GetFileRecordByIdAsync(id);
        if (file == null)
            return NotFound(new { error = "Arquivo não encontrado" });

        if (file.ContentType != "chord")
            return BadRequest(new { error = "Arquivo não é uma cifra" });

        try
        {
            var key = dto?.TransposedKey ?? file.MusicalKey ?? "C";
            var capoFret = CalculateCapoFret(file.MusicalKey ?? "C", key);
            var useCapo = dto?.UseCapo ?? true;

            var pdf = _chordRenderer.Render(file.ChordContent!, key, useCapo, capoFret);

            var ms = new MemoryStream();
            pdf.Save(ms, false);
            ms.Position = 0;

            return File(ms, "application/pdf", $"{file.SongName ?? file.Filename}.pdf");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao gerar PDF de cifra");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    private int CalculateCapoFret(string originalKey, string targetKey)
    {
        var notes = new[] { "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" };
        var origIdx = Array.IndexOf(notes, originalKey.Split('/')[0]);
        var targetIdx = Array.IndexOf(notes, targetKey.Split('/')[0]);

        if (origIdx < 0 || targetIdx < 0) return 0;
        return (targetIdx - origIdx + 12) % 12;
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
