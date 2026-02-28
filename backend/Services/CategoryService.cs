using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Models;
using MusicasIgreja.Api.Services.Interfaces;

namespace MusicasIgreja.Api.Services;

public class CategoryService : ICategoryService
{
    private readonly AppDbContext _context;
    private readonly ILogger<CategoryService> _logger;

    public CategoryService(AppDbContext context, ILogger<CategoryService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<List<FilterOptionDto>> GetCategoriesAsync(int workspaceId)
    {
        return await _context.Categories
            .Where(c => c.WorkspaceId == workspaceId)
            .OrderBy(c => c.Name)
            .Select(c => new FilterOptionDto(c.Slug, c.Name))
            .ToListAsync();
    }

    public async Task<List<EntityDetailDto>> GetCategoriesWithDetailsAsync(int workspaceId)
    {
        return await _context.Categories
            .Where(c => c.WorkspaceId == workspaceId)
            .OrderBy(c => c.Name)
            .Select(c => new EntityDetailDto(
                c.Id,
                c.Name,
                c.Slug,
                c.Description,
                c.FileCategories.Count))
            .ToListAsync();
    }

    public async Task<int> CreateAsync(int workspaceId, EntityDto dto)
    {
        var exists = await _context.Categories
            .AnyAsync(c => c.WorkspaceId == workspaceId && c.Name == dto.Name);
        if (exists)
            throw new InvalidOperationException("Já existe uma categoria com este nome neste workspace.");

        var entity = new Category
        {
            WorkspaceId = workspaceId,
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim()
        };
        _context.Categories.Add(entity);
        await _context.SaveChangesAsync();
        return entity.Id;
    }

    public async Task<bool> UpdateAsync(int id, EntityDto dto)
    {
        var entity = await _context.Categories.FindAsync(id);
        if (entity == null) return false;

        var exists = await _context.Categories
            .AnyAsync(c => c.WorkspaceId == entity.WorkspaceId && c.Name == dto.Name && c.Id != id);
        if (exists)
            throw new InvalidOperationException("Já existe uma categoria com este nome neste workspace.");

        entity.Name = dto.Name.Trim();
        entity.Description = dto.Description?.Trim();
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var entity = await _context.Categories.FindAsync(id);
        if (entity == null) return false;

        var associations = await _context.FileCategories
            .Where(fc => fc.CategoryId == id)
            .ToListAsync();
        _context.FileCategories.RemoveRange(associations);
        _context.Categories.Remove(entity);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<(bool Success, string Message, int MergedCount)> MergeAsync(int sourceId, int targetId)
    {
        if (sourceId == targetId)
            return (false, "Não é possível mesclar uma categoria com ela mesma.", 0);

        var source = await _context.Categories.FindAsync(sourceId);
        var target = await _context.Categories.FindAsync(targetId);
        if (source == null || target == null)
            return (false, "Categoria de origem ou destino não encontrada.", 0);
        if (source.WorkspaceId != target.WorkspaceId)
            return (false, "As categorias devem pertencer ao mesmo workspace.", 0);

        var sourceAssocs = await _context.FileCategories
            .Where(fc => fc.CategoryId == sourceId)
            .ToListAsync();
        var targetFileIds = await _context.FileCategories
            .Where(fc => fc.CategoryId == targetId)
            .Select(fc => fc.FileId)
            .ToHashSetAsync();

        var toRemove = new List<FileCategory>();
        var mergedCount = 0;
        foreach (var assoc in sourceAssocs)
        {
            if (targetFileIds.Contains(assoc.FileId))
            {
                toRemove.Add(assoc);
            }
            else
            {
                assoc.CategoryId = targetId;
                targetFileIds.Add(assoc.FileId);
                mergedCount++;
            }
        }
        _context.FileCategories.RemoveRange(toRemove);
        _context.Categories.Remove(source);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Merged category {SourceId} into {TargetId}, {Count} associations moved", sourceId, targetId, mergedCount);
        return (true, $"Mesclagem concluída. {mergedCount} associações movidas.", mergedCount);
    }
}
