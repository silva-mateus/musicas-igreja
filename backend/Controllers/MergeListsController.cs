using Core.Auth.Helpers;
using Core.Auth.Services;
using Microsoft.AspNetCore.Mvc;
using MusicasIgreja.Api;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Services.Interfaces;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/merge_lists")]
public class MergeListsController : ControllerBase
{
    private readonly IListService _listService;
    private readonly ICoreAuthService _authService;

    public MergeListsController(IListService listService, ICoreAuthService authService)
    {
        _listService = listService;
        _authService = authService;
    }

    [HttpGet]
    public async Task<ActionResult<List<MergeListSummaryDto>>> GetLists(
        [FromQuery] int workspace_id = 1,
        [FromQuery] string? search = null,
        [FromQuery] string? sort_by = "updated_date",
        [FromQuery] string? sort_order = "desc")
    {
        var lists = await _listService.GetListsAsync(workspace_id, search, sort_by, sort_order);
        return Ok(lists);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<object>> GetList(int id)
    {
        var dto = await _listService.GetListByIdAsync(id);
        if (dto == null)
            return NotFound(new { success = false, error = "Lista não encontrada" });
        return Ok(new { success = true, list = dto });
    }

    [HttpPost]
    public async Task<ActionResult<object>> CreateList([FromBody] CreateMergeListDto dto, [FromQuery] int workspace_id = 1)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.ManageLists))
            return StatusCode(403, new { error = "Sem permissão" });

        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { success = false, error = "Nome é obrigatório" });

        var listId = await _listService.CreateListAsync(workspace_id, dto);
        return StatusCode(201, new { success = true, list_id = listId, message = "Lista criada com sucesso" });
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<object>> UpdateList(int id, [FromBody] UpdateMergeListDto dto)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.ManageLists))
            return StatusCode(403, new { error = "Sem permissão" });

        var success = await _listService.UpdateListAsync(id, dto);
        if (!success)
            return NotFound(new { success = false, error = "Lista não encontrada" });
        return Ok(new { success = true });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<object>> DeleteList(int id)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.ManageLists))
            return StatusCode(403, new { error = "Sem permissão" });

        var success = await _listService.DeleteListAsync(id);
        if (!success)
            return NotFound(new { success = false, error = "Lista não encontrada" });
        return Ok(new { success = true });
    }

    [HttpPost("{id}/items")]
    public async Task<ActionResult<object>> AddItems(int id, [FromBody] AddItemsDto dto)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.ManageLists))
            return StatusCode(403, new { error = "Sem permissão" });

        var newItemIds = await _listService.AddItemsAsync(id, dto.FileIds);
        return Ok(new { success = true, added = newItemIds.Count, new_item_ids = newItemIds });
    }

    [HttpPost("{id}/reorder")]
    public async Task<ActionResult<object>> ReorderItems(int id, [FromBody] ReorderItemsDto dto)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.ManageLists))
            return StatusCode(403, new { error = "Sem permissão" });

        var success = await _listService.ReorderItemsAsync(id, dto.ItemOrder);
        if (!success)
            return NotFound(new { success = false, error = "Lista não encontrada" });
        return Ok(new { success = true });
    }

    [HttpPost("{id}/duplicate")]
    public async Task<ActionResult<object>> DuplicateList(int id, [FromBody] CreateMergeListDto dto)
    {
        if (!CoreAuthHelper.IsAuthenticated(HttpContext))
            return Unauthorized(new { error = "Não autenticado" });
        if (!await CoreAuthHelper.HasPermissionAsync(HttpContext, _authService, Permissions.ManageLists))
            return StatusCode(403, new { error = "Sem permissão" });

        var newId = await _listService.DuplicateListAsync(id, dto.Name);
        if (newId < 0)
            return NotFound(new { success = false, error = "Lista não encontrada" });
        return Ok(new { success = true, new_list_id = newId, message = "Lista duplicada com sucesso" });
    }

    [HttpGet("{id}/report")]
    public async Task<ActionResult<object>> GenerateReport(int id)
    {
        var report = await _listService.GenerateReportAsync(id);
        if (report == null)
            return NotFound(new { success = false, error = "Lista não encontrada ou vazia" });
        return Ok(new { success = true, report });
    }

    [HttpGet("{id}/export")]
    public async Task<IActionResult> ExportList(int id)
    {
        var (stream, listName) = await _listService.ExportListAsync(id);
        if (stream == null)
            return NotFound(new { success = false, error = "Lista não encontrada ou sem arquivos" });
        return File(stream, "application/pdf", $"{listName}.pdf");
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
            list.UpdatedDate = DateTime.UtcNow;

        _context.MergeListItems.Remove(item);
        await _context.SaveChangesAsync();
        return Ok(new { success = true });
    }
}
