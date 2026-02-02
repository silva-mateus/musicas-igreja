using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Models;
using MusicasIgreja.Api.Services;
using PdfSharpCore.Pdf;
using PdfSharpCore.Pdf.IO;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/merge_lists")]
public class MergeListsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IFileService _fileService;
    private readonly ILogger<MergeListsController> _logger;

    public MergeListsController(AppDbContext context, IFileService fileService, ILogger<MergeListsController> logger)
    {
        _context = context;
        _fileService = fileService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<MergeListSummaryDto>>> GetLists()
    {
        var lists = await _context.MergeLists
            .Include(l => l.Items)
            .OrderByDescending(l => l.UpdatedDate)
            .Select(l => new MergeListSummaryDto(
                l.Id,
                l.Name,
                l.Observations,
                l.CreatedDate,
                l.UpdatedDate,
                l.Items.Count
            ))
            .ToListAsync();

        return Ok(lists);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<object>> GetList(int id)
    {
        var list = await _context.MergeLists
            .Include(l => l.Items)
                .ThenInclude(i => i.PdfFile)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (list == null)
            return NotFound(new { success = false, error = "Lista não encontrada" });

        var dto = new MergeListDetailDto(
            list.Id,
            list.Name,
            list.Observations,
            list.CreatedDate,
            list.UpdatedDate,
            list.Items.OrderBy(i => i.OrderPosition).Select(i => new MergeListItemDto(
                i.Id,
                i.OrderPosition,
                new MergeListFileDto(
                    i.PdfFile.Id,
                    i.PdfFile.Filename,
                    i.PdfFile.SongName,
                    i.PdfFile.Artist,
                    i.PdfFile.MusicalKey,
                    i.PdfFile.YoutubeLink
                )
            )).ToList()
        );

        return Ok(new { success = true, list = dto });
    }

    [HttpPost]
    public async Task<ActionResult<object>> CreateList([FromBody] CreateMergeListDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { success = false, error = "Nome é obrigatório" });

        var list = new MergeList
        {
            Name = dto.Name,
            Observations = dto.Observations
        };

        _context.MergeLists.Add(list);
        await _context.SaveChangesAsync();

        // Add items if provided
        if (dto.FileIds != null && dto.FileIds.Count > 0)
        {
            var position = 0;
            foreach (var fileId in dto.FileIds)
            {
                var file = await _context.PdfFiles.FindAsync(fileId);
                if (file != null)
                {
                    _context.MergeListItems.Add(new MergeListItem
                    {
                        MergeListId = list.Id,
                        PdfFileId = fileId,
                        OrderPosition = position++
                    });
                }
            }
            await _context.SaveChangesAsync();
        }

        return StatusCode(201, new { success = true, list_id = list.Id, message = "Lista criada com sucesso" });
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<object>> UpdateList(int id, [FromBody] UpdateMergeListDto dto)
    {
        var list = await _context.MergeLists.FindAsync(id);
        if (list == null)
            return NotFound(new { success = false, error = "Lista não encontrada" });

        if (dto.Name != null) list.Name = dto.Name;
        if (dto.Observations != null) list.Observations = dto.Observations;
        list.UpdatedDate = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { success = true });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<object>> DeleteList(int id)
    {
        var list = await _context.MergeLists.FindAsync(id);
        if (list == null)
            return NotFound(new { success = false, error = "Lista não encontrada" });

        _context.MergeLists.Remove(list);
        await _context.SaveChangesAsync();

        return Ok(new { success = true });
    }

    [HttpPost("{id}/items")]
    public async Task<ActionResult<object>> AddItems(int id, [FromBody] AddItemsDto dto)
    {
        var list = await _context.MergeLists
            .Include(l => l.Items)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (list == null)
            return NotFound(new { success = false, error = "Lista não encontrada" });

        var maxPosition = list.Items.Any() ? list.Items.Max(i => i.OrderPosition) : -1;
        var addedCount = 0;

        foreach (var fileId in dto.FileIds)
        {
            var file = await _context.PdfFiles.FindAsync(fileId);
            if (file != null)
            {
                _context.MergeListItems.Add(new MergeListItem
                {
                    MergeListId = id,
                    PdfFileId = fileId,
                    OrderPosition = ++maxPosition
                });
                addedCount++;
            }
        }

        list.UpdatedDate = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { success = true, added_count = addedCount });
    }

    [HttpPost("{id}/reorder")]
    public async Task<ActionResult<object>> ReorderItems(int id, [FromBody] ReorderItemsDto dto)
    {
        var list = await _context.MergeLists
            .Include(l => l.Items)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (list == null)
            return NotFound(new { success = false, error = "Lista não encontrada" });

        for (int i = 0; i < dto.ItemOrder.Count; i++)
        {
            var item = list.Items.FirstOrDefault(it => it.Id == dto.ItemOrder[i]);
            if (item != null)
            {
                item.OrderPosition = i;
            }
        }

        list.UpdatedDate = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { success = true });
    }

    [HttpPost("{id}/duplicate")]
    public async Task<ActionResult<object>> DuplicateList(int id, [FromBody] CreateMergeListDto dto)
    {
        var originalList = await _context.MergeLists
            .Include(l => l.Items)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (originalList == null)
            return NotFound(new { success = false, error = "Lista não encontrada" });

        var newList = new MergeList
        {
            Name = dto.Name ?? $"{originalList.Name} (cópia)",
            Observations = originalList.Observations
        };

        _context.MergeLists.Add(newList);
        await _context.SaveChangesAsync();

        foreach (var item in originalList.Items.OrderBy(i => i.OrderPosition))
        {
            _context.MergeListItems.Add(new MergeListItem
            {
                MergeListId = newList.Id,
                PdfFileId = item.PdfFileId,
                OrderPosition = item.OrderPosition
            });
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            new_list_id = newList.Id,
            items_copied = originalList.Items.Count,
            message = "Lista duplicada com sucesso"
        });
    }

    [HttpGet("{id}/export")]
    public async Task<IActionResult> ExportList(int id)
    {
        var list = await _context.MergeLists
            .Include(l => l.Items)
                .ThenInclude(i => i.PdfFile)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (list == null)
            return NotFound(new { success = false, error = "Lista não encontrada" });

        if (!list.Items.Any())
            return BadRequest(new { success = false, error = "Lista vazia" });

        // Get all PDF files in order
        var orderedItems = list.Items.OrderBy(i => i.OrderPosition).ToList();
        
        // Validate all files exist
        var filePaths = new List<string>();
        foreach (var item in orderedItems)
        {
            var absolutePath = _fileService.GetAbsolutePath(item.PdfFile.FilePath);
            if (!System.IO.File.Exists(absolutePath))
            {
                _logger.LogWarning("Arquivo não encontrado: {Path} (ID: {Id})", absolutePath, item.PdfFile.Id);
                continue; // Skip missing files instead of failing
            }
            filePaths.Add(absolutePath);
        }

        if (!filePaths.Any())
            return NotFound(new { success = false, error = "Nenhum arquivo PDF encontrado" });

        // If only one file, return it directly
        if (filePaths.Count == 1)
        {
            var stream = new FileStream(filePaths[0], FileMode.Open, FileAccess.Read);
            return File(stream, "application/pdf", $"{list.Name}.pdf");
        }

        try
        {
            // Merge PDFs using PdfSharpCore
            using var outputDocument = new PdfDocument();
            outputDocument.Info.Title = list.Name;
            outputDocument.Info.Author = "Músicas Igreja";

            foreach (var filePath in filePaths)
            {
                try
                {
                    using var inputDocument = PdfReader.Open(filePath, PdfDocumentOpenMode.Import);
                    
                    // Copy all pages from the input document to the output
                    for (int i = 0; i < inputDocument.PageCount; i++)
                    {
                        var page = inputDocument.Pages[i];
                        outputDocument.AddPage(page);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Erro ao processar PDF: {Path}", filePath);
                    // Continue with other files
                }
            }

            if (outputDocument.PageCount == 0)
                return BadRequest(new { success = false, error = "Não foi possível processar os PDFs" });

            // Save to memory stream and return
            var memoryStream = new MemoryStream();
            outputDocument.Save(memoryStream, false);
            memoryStream.Position = 0;

            _logger.LogInformation("PDF mesclado com sucesso: {ListName}, {PageCount} páginas", list.Name, outputDocument.PageCount);

            return File(memoryStream, "application/pdf", $"{list.Name}.pdf");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao mesclar PDFs para lista {ListId}", id);
            return StatusCode(500, new { success = false, error = "Erro ao mesclar PDFs" });
        }
    }
}

[ApiController]
[Route("api/merge_list_items")]
public class MergeListItemsController : ControllerBase
{
    private readonly AppDbContext _context;

    public MergeListItemsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<object>> DeleteItem(int id)
    {
        var item = await _context.MergeListItems.FindAsync(id);
        if (item == null)
            return NotFound(new { success = false, error = "Item não encontrado" });

        var list = await _context.MergeLists.FindAsync(item.MergeListId);
        if (list != null)
        {
            list.UpdatedDate = DateTime.UtcNow;
        }

        _context.MergeListItems.Remove(item);
        await _context.SaveChangesAsync();

        return Ok(new { success = true });
    }
}

