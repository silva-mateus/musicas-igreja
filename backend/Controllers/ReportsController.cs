using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api")]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ReportsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("generate_report/{id}")]
    public async Task<ActionResult<object>> GenerateReport(int id)
    {
        var list = await _context.MergeLists
            .Include(l => l.Items)
                .ThenInclude(i => i.PdfFile)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (list == null)
        {
            return NotFound(new { success = false, message = "Lista não encontrada" });
        }

        if (!list.Items.Any())
        {
            return Ok(new { success = true, report = "", message = "Lista vazia" });
        }

        var lines = list.Items
            .OrderBy(i => i.OrderPosition)
            .Select(i =>
            {
                var file = i.PdfFile;
                var parts = new List<string>();

                // Song name or filename
                if (!string.IsNullOrEmpty(file.SongName))
                    parts.Add(file.SongName);
                else
                    parts.Add(file.Filename.Replace(".pdf", ""));

                // Artist
                if (!string.IsNullOrEmpty(file.Artist))
                    parts.Add(file.Artist);

                // Musical key
                if (!string.IsNullOrEmpty(file.MusicalKey))
                    parts.Add($"Tom: {file.MusicalKey}");

                // YouTube link
                if (!string.IsNullOrEmpty(file.YoutubeLink))
                    parts.Add(file.YoutubeLink);

                return string.Join(" - ", parts);
            });

        var report = string.Join("\n", lines);

        return Ok(new { success = true, report });
    }
}

