using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Models;
using MusicasIgreja.Api.Services.Interfaces;

namespace MusicasIgreja.Api.Services;

public class CustomFilterService : ICustomFilterService
{
    private readonly AppDbContext _context;
    private readonly ILogger<CustomFilterService> _logger;

    public CustomFilterService(AppDbContext context, ILogger<CustomFilterService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<List<CustomFilterGroupDto>> GetGroupsAsync(int workspaceId)
    {
        return await _context.CustomFilterGroups
            .Where(g => g.WorkspaceId == workspaceId)
            .OrderBy(g => g.SortOrder)
            .Select(g => new CustomFilterGroupDto
            {
                Id = g.Id,
                Name = g.Name,
                Slug = g.Slug,
                SortOrder = g.SortOrder,
                Values = g.Values.OrderBy(v => v.SortOrder).Select(v => new CustomFilterValueDto
                {
                    Id = v.Id,
                    Name = v.Name,
                    Slug = v.Slug,
                    SortOrder = v.SortOrder,
                    FileCount = v.FileCustomFilters.Count
                }).ToList()
            })
            .ToListAsync();
    }

    public async Task<CustomFilterGroupDto?> GetGroupByIdAsync(int id)
    {
        return await _context.CustomFilterGroups
            .Where(g => g.Id == id)
            .Select(g => new CustomFilterGroupDto
            {
                Id = g.Id,
                Name = g.Name,
                Slug = g.Slug,
                SortOrder = g.SortOrder,
                Values = g.Values.OrderBy(v => v.SortOrder).Select(v => new CustomFilterValueDto
                {
                    Id = v.Id,
                    Name = v.Name,
                    Slug = v.Slug,
                    SortOrder = v.SortOrder,
                    FileCount = v.FileCustomFilters.Count
                }).ToList()
            })
            .FirstOrDefaultAsync();
    }

    public async Task<int> CreateGroupAsync(int workspaceId, EntityDto dto)
    {
        var exists = await _context.CustomFilterGroups
            .AnyAsync(g => g.WorkspaceId == workspaceId && g.Name == dto.Name.Trim());
        if (exists)
            throw new InvalidOperationException("Já existe um grupo de filtro com este nome neste workspace.");

        var maxOrder = await _context.CustomFilterGroups
            .Where(g => g.WorkspaceId == workspaceId)
            .Select(g => (int?)g.SortOrder)
            .MaxAsync() ?? -1;

        var group = new CustomFilterGroup
        {
            WorkspaceId = workspaceId,
            Name = dto.Name.Trim(),
            SortOrder = maxOrder + 1
        };
        _context.CustomFilterGroups.Add(group);
        await _context.SaveChangesAsync();
        return group.Id;
    }

    public async Task<bool> UpdateGroupAsync(int id, EntityDto dto)
    {
        var group = await _context.CustomFilterGroups.FindAsync(id);
        if (group == null) return false;

        var exists = await _context.CustomFilterGroups
            .AnyAsync(g => g.WorkspaceId == group.WorkspaceId && g.Name == dto.Name.Trim() && g.Id != id);
        if (exists)
            throw new InvalidOperationException("Já existe um grupo de filtro com este nome neste workspace.");

        group.Name = dto.Name.Trim();
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteGroupAsync(int id)
    {
        var group = await _context.CustomFilterGroups.FindAsync(id);
        if (group == null) return false;

        _context.CustomFilterGroups.Remove(group);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Deleted custom filter group {Id} ({Name})", id, group.Name);
        return true;
    }

    public async Task<List<EntityDetailDto>> GetValuesWithDetailsAsync(int groupId)
    {
        return await _context.CustomFilterValues
            .Where(v => v.FilterGroupId == groupId)
            .OrderBy(v => v.SortOrder)
            .Select(v => new EntityDetailDto(
                v.Id,
                v.Name,
                v.Slug,
                null,
                v.FileCustomFilters.Count))
            .ToListAsync();
    }

    public async Task<int> CreateValueAsync(int groupId, EntityDto dto)
    {
        var group = await _context.CustomFilterGroups.FindAsync(groupId);
        if (group == null)
            throw new InvalidOperationException("Grupo de filtro não encontrado.");

        var exists = await _context.CustomFilterValues
            .AnyAsync(v => v.FilterGroupId == groupId && v.Name == dto.Name.Trim());
        if (exists)
            throw new InvalidOperationException("Já existe um valor com este nome neste grupo.");

        var maxOrder = await _context.CustomFilterValues
            .Where(v => v.FilterGroupId == groupId)
            .Select(v => (int?)v.SortOrder)
            .MaxAsync() ?? -1;

        var value = new CustomFilterValue
        {
            FilterGroupId = groupId,
            Name = dto.Name.Trim(),
            SortOrder = maxOrder + 1
        };
        _context.CustomFilterValues.Add(value);
        await _context.SaveChangesAsync();
        return value.Id;
    }

    public async Task<bool> UpdateValueAsync(int id, EntityDto dto)
    {
        var value = await _context.CustomFilterValues.FindAsync(id);
        if (value == null) return false;

        var exists = await _context.CustomFilterValues
            .AnyAsync(v => v.FilterGroupId == value.FilterGroupId && v.Name == dto.Name.Trim() && v.Id != id);
        if (exists)
            throw new InvalidOperationException("Já existe um valor com este nome neste grupo.");

        value.Name = dto.Name.Trim();
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteValueAsync(int id)
    {
        var value = await _context.CustomFilterValues.FindAsync(id);
        if (value == null) return false;

        _context.CustomFilterValues.Remove(value);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<(bool Success, string Message, int MergedCount)> MergeValuesAsync(int sourceId, int targetId)
    {
        if (sourceId == targetId)
            return (false, "Não é possível mesclar um valor com ele mesmo.", 0);

        var source = await _context.CustomFilterValues.FindAsync(sourceId);
        var target = await _context.CustomFilterValues.FindAsync(targetId);
        if (source == null || target == null)
            return (false, "Valor de origem ou destino não encontrado.", 0);
        if (source.FilterGroupId != target.FilterGroupId)
            return (false, "Os valores devem pertencer ao mesmo grupo de filtro.", 0);

        var sourceAssocs = await _context.FileCustomFilters
            .Where(fcf => fcf.FilterValueId == sourceId)
            .ToListAsync();
        var targetFileIds = await _context.FileCustomFilters
            .Where(fcf => fcf.FilterValueId == targetId)
            .Select(fcf => fcf.FileId)
            .ToHashSetAsync();

        var toRemove = new List<FileCustomFilter>();
        var mergedCount = 0;
        foreach (var assoc in sourceAssocs)
        {
            if (targetFileIds.Contains(assoc.FileId))
            {
                toRemove.Add(assoc);
            }
            else
            {
                assoc.FilterValueId = targetId;
                targetFileIds.Add(assoc.FileId);
                mergedCount++;
            }
        }
        _context.FileCustomFilters.RemoveRange(toRemove);
        _context.CustomFilterValues.Remove(source);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Merged custom filter value {SourceId} into {TargetId}, {Count} associations moved",
            sourceId, targetId, mergedCount);
        return (true, $"Mesclagem concluída. {mergedCount} associações movidas.", mergedCount);
    }
}
