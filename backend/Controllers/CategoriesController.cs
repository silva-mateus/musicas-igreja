using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Helpers;
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

    [HttpGet("with-details")]
    public async Task<ActionResult<object>> GetCategoriesWithDetails()
    {
        var categories = await _context.Categories
            .OrderBy(c => c.Name)
            .Select(c => new
            {
                id = c.Id,
                name = c.Name,
                description = c.Description,
                file_count = c.FileCategories.Count
            })
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

    [HttpPut("{id}")]
    public async Task<ActionResult<object>> UpdateCategory(int id, [FromBody] CategoryDto dto)
    {
        var category = await _context.Categories.FindAsync(id);
        if (category == null)
            return NotFound(new { success = false, error = "Categoria não encontrada" });

        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { success = false, error = "Nome é obrigatório" });

        // Check for duplicate name (excluding current)
        var duplicate = await _context.Categories
            .FirstOrDefaultAsync(c => c.Name == dto.Name && c.Id != id);
        if (duplicate != null)
            return Conflict(new { success = false, error = "Já existe outra categoria com este nome" });

        category.Name = dto.Name;
        category.Description = dto.Description;

        await _context.SaveChangesAsync();

        return Ok(new { success = true });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<object>> DeleteCategory(int id)
    {
        var category = await _context.Categories
            .Include(c => c.FileCategories)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (category == null)
            return NotFound(new { success = false, error = "Categoria não encontrada" });

        // Remove all file associations first, then delete category
        _context.FileCategories.RemoveRange(category.FileCategories);
        _context.Categories.Remove(category);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, deleted_name = category.Name });
    }

    /// <summary>
    /// Merge (consolidate) one category into another.
    /// All files from source category will be associated with target category.
    /// Source category will be deleted.
    /// </summary>
    [HttpPost("{sourceId}/merge/{targetId}")]
    public async Task<ActionResult<object>> MergeCategory(int sourceId, int targetId)
    {
        if (sourceId == targetId)
            return BadRequest(new { success = false, error = "Não é possível consolidar uma categoria com ela mesma" });

        var source = await _context.Categories
            .Include(c => c.FileCategories)
            .FirstOrDefaultAsync(c => c.Id == sourceId);

        var target = await _context.Categories.FindAsync(targetId);

        if (source == null)
            return NotFound(new { success = false, error = "Categoria de origem não encontrada" });

        if (target == null)
            return NotFound(new { success = false, error = "Categoria de destino não encontrada" });

        var mergedCount = source.FileCategories.Count;

        // Move all file associations from source to target
        foreach (var fileCategory in source.FileCategories.ToList())
        {
            // Check if target already has this file association
            var existingAssociation = await _context.FileCategories
                .FirstOrDefaultAsync(fc => fc.FileId == fileCategory.FileId && fc.CategoryId == targetId);

            if (existingAssociation == null)
            {
                // Create new association with target
                _context.FileCategories.Add(new FileCategory
                {
                    FileId = fileCategory.FileId,
                    CategoryId = targetId
                });
            }

            // Remove old association
            _context.FileCategories.Remove(fileCategory);
        }

        // Delete the source category
        _context.Categories.Remove(source);
        await _context.SaveChangesAsync();

        return Ok(new { 
            success = true, 
            message = $"Categoria '{source.Name}' consolidada com '{target.Name}' com sucesso",
            merged_files = mergedCount
        });
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

    [HttpGet("with-details")]
    public async Task<ActionResult<object>> GetLiturgicalTimesWithDetails()
    {
        var times = await _context.LiturgicalTimes
            .OrderBy(l => l.Name)
            .Select(l => new
            {
                id = l.Id,
                name = l.Name,
                description = l.Description,
                file_count = l.FileLiturgicalTimes.Count
            })
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

    [HttpPut("{id}")]
    public async Task<ActionResult<object>> UpdateLiturgicalTime(int id, [FromBody] LiturgicalTimeDto dto)
    {
        var time = await _context.LiturgicalTimes.FindAsync(id);
        if (time == null)
            return NotFound(new { success = false, error = "Tempo litúrgico não encontrado" });

        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { success = false, error = "Nome é obrigatório" });

        // Check for duplicate name (excluding current)
        var duplicate = await _context.LiturgicalTimes
            .FirstOrDefaultAsync(l => l.Name == dto.Name && l.Id != id);
        if (duplicate != null)
            return Conflict(new { success = false, error = "Já existe outro tempo litúrgico com este nome" });

        time.Name = dto.Name;
        time.Description = dto.Description;

        await _context.SaveChangesAsync();

        return Ok(new { success = true });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<object>> DeleteLiturgicalTime(int id)
    {
        var time = await _context.LiturgicalTimes
            .Include(l => l.FileLiturgicalTimes)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (time == null)
            return NotFound(new { success = false, error = "Tempo litúrgico não encontrado" });

        // Remove all file associations first, then delete
        _context.FileLiturgicalTimes.RemoveRange(time.FileLiturgicalTimes);
        _context.LiturgicalTimes.Remove(time);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, deleted_name = time.Name });
    }

    /// <summary>
    /// Merge (consolidate) one liturgical time into another.
    /// All files from source will be associated with target.
    /// Source will be deleted.
    /// </summary>
    [HttpPost("{sourceId}/merge/{targetId}")]
    public async Task<ActionResult<object>> MergeLiturgicalTime(int sourceId, int targetId)
    {
        if (sourceId == targetId)
            return BadRequest(new { success = false, error = "Não é possível consolidar um tempo litúrgico com ele mesmo" });

        var source = await _context.LiturgicalTimes
            .Include(l => l.FileLiturgicalTimes)
            .FirstOrDefaultAsync(l => l.Id == sourceId);

        var target = await _context.LiturgicalTimes.FindAsync(targetId);

        if (source == null)
            return NotFound(new { success = false, error = "Tempo litúrgico de origem não encontrado" });

        if (target == null)
            return NotFound(new { success = false, error = "Tempo litúrgico de destino não encontrado" });

        var mergedCount = source.FileLiturgicalTimes.Count;

        // Move all file associations from source to target
        foreach (var fileLiturgicalTime in source.FileLiturgicalTimes.ToList())
        {
            // Check if target already has this file association
            var existingAssociation = await _context.FileLiturgicalTimes
                .FirstOrDefaultAsync(flt => flt.FileId == fileLiturgicalTime.FileId && flt.LiturgicalTimeId == targetId);

            if (existingAssociation == null)
            {
                // Create new association with target
                _context.FileLiturgicalTimes.Add(new FileLiturgicalTime
                {
                    FileId = fileLiturgicalTime.FileId,
                    LiturgicalTimeId = targetId
                });
            }

            // Remove old association
            _context.FileLiturgicalTimes.Remove(fileLiturgicalTime);
        }

        // Delete the source
        _context.LiturgicalTimes.Remove(source);
        await _context.SaveChangesAsync();

        return Ok(new { 
            success = true, 
            message = $"Tempo litúrgico '{source.Name}' consolidado com '{target.Name}' com sucesso",
            merged_files = mergedCount
        });
    }
}
