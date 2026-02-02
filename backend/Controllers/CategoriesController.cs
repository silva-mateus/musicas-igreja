using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Models;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/categories")]
public class CategoriesController : ControllerBase
{
    private readonly AppDbContext _context;

    public CategoriesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<object>> GetCategories()
    {
        var categories = await _context.Categories
            .OrderBy(c => c.Name)
            .Select(c => c.Name)
            .ToListAsync();

        return Ok(new { categories });
    }

    [HttpPost]
    public async Task<ActionResult<object>> CreateCategory([FromBody] CategoryDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { success = false, error = "Nome é obrigatório" });

        var existing = await _context.Categories.FirstOrDefaultAsync(c => c.Name == dto.Name);
        if (existing != null)
            return Conflict(new { success = false, error = "Categoria já existe" });

        var category = new Category
        {
            Name = dto.Name,
            Description = dto.Description
        };

        _context.Categories.Add(category);
        await _context.SaveChangesAsync();

        return StatusCode(201, new { success = true, id = category.Id });
    }
}

[ApiController]
[Route("api/liturgical_times")]
public class LiturgicalTimesController : ControllerBase
{
    private readonly AppDbContext _context;

    public LiturgicalTimesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<object>> GetLiturgicalTimes()
    {
        var times = await _context.LiturgicalTimes
            .OrderBy(l => l.Name)
            .Select(l => l.Name)
            .ToListAsync();

        return Ok(new { liturgical_times = times });
    }

    [HttpPost]
    public async Task<ActionResult<object>> CreateLiturgicalTime([FromBody] LiturgicalTimeDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { success = false, error = "Nome é obrigatório" });

        var existing = await _context.LiturgicalTimes.FirstOrDefaultAsync(l => l.Name == dto.Name);
        if (existing != null)
            return Conflict(new { success = false, error = "Tempo litúrgico já existe" });

        var time = new LiturgicalTime
        {
            Name = dto.Name,
            Description = dto.Description
        };

        _context.LiturgicalTimes.Add(time);
        await _context.SaveChangesAsync();

        return StatusCode(201, new { success = true, id = time.Id });
    }
}

