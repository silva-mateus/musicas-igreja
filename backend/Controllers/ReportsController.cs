using Microsoft.AspNetCore.Mvc;
using MusicasIgreja.Api.Services.Interfaces;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api")]
public class ReportsController : ControllerBase
{
    private readonly IListService _listService;

    public ReportsController(IListService listService)
    {
        _listService = listService;
    }

    [HttpGet("generate_report/{id}")]
    public async Task<ActionResult<object>> GenerateReport(int id)
    {
        var report = await _listService.GenerateReportAsync(id);
        if (report == null)
            return NotFound(new { success = false, message = "Lista não encontrada" });
        return Ok(new { success = true, report });
    }
}
