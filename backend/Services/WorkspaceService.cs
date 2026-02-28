using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Models;
using MusicasIgreja.Api.Services.Interfaces;

namespace MusicasIgreja.Api.Services;

public class WorkspaceService : IWorkspaceService
{
    private readonly AppDbContext _db;
    private readonly ILogger<WorkspaceService> _logger;

    public WorkspaceService(AppDbContext db, ILogger<WorkspaceService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<List<WorkspaceDto>> GetAllAsync()
    {
        var workspaces = await _db.Workspaces
            .OrderBy(w => w.SortOrder)
            .Select(w => new WorkspaceDto
            {
                Id = w.Id,
                Name = w.Name,
                Slug = w.Slug,
                Description = w.Description,
                Icon = w.Icon,
                Color = w.Color,
                IsActive = w.IsActive,
                SortOrder = w.SortOrder,
                CreatedDate = w.CreatedDate,
                MusicCount = w.PdfFiles.Count,
                CategoryCount = w.Categories.Count,
                ListCount = w.MergeLists.Count,
                FilterGroupCount = w.CustomFilterGroups.Count
            })
            .ToListAsync();
        return workspaces;
    }

    public async Task<WorkspaceDto?> GetByIdAsync(int id)
    {
        var w = await _db.Workspaces.FindAsync(id);
        if (w == null) return null;
        return await MapToDtoAsync(w);
    }

    public async Task<WorkspaceDto?> GetBySlugAsync(string slug)
    {
        var w = await _db.Workspaces.FirstOrDefaultAsync(x => x.Slug == slug);
        if (w == null) return null;
        return await MapToDtoAsync(w);
    }

    public async Task<WorkspaceDto> CreateAsync(CreateWorkspaceDto dto)
    {
        var exists = await _db.Workspaces.AnyAsync(w => w.Name.ToLower() == dto.Name.Trim().ToLower());
        if (exists)
            throw new InvalidOperationException("Já existe um workspace com este nome.");

        var maxOrder = await _db.Workspaces.AnyAsync()
            ? await _db.Workspaces.MaxAsync(w => w.SortOrder)
            : -1;

        var workspace = new Workspace
        {
            Name = dto.Name.Trim(),
            Description = dto.Description,
            Icon = dto.Icon,
            Color = dto.Color,
            IsActive = true,
            SortOrder = maxOrder + 1
        };
        _db.Workspaces.Add(workspace);
        await _db.SaveChangesAsync();
        _logger.LogInformation("Workspace {Name} created with id {Id}", workspace.Name, workspace.Id);
        return (await MapToDtoAsync(workspace))!;
    }

    public async Task<bool> UpdateAsync(int id, UpdateWorkspaceDto dto)
    {
        var w = await _db.Workspaces.FindAsync(id);
        if (w == null) return false;

        if (dto.Name != null)
        {
            var exists = await _db.Workspaces.AnyAsync(x => x.Name.ToLower() == dto.Name.Trim().ToLower() && x.Id != id);
            if (exists)
                throw new InvalidOperationException("Já existe um workspace com este nome.");
            w.Name = dto.Name.Trim();
        }
        if (dto.Description != null) w.Description = dto.Description;
        if (dto.Icon != null) w.Icon = dto.Icon;
        if (dto.Color != null) w.Color = dto.Color;
        if (dto.IsActive.HasValue) w.IsActive = dto.IsActive.Value;
        if (dto.SortOrder.HasValue) w.SortOrder = dto.SortOrder.Value;

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var w = await _db.Workspaces
            .Include(x => x.PdfFiles)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (w == null) return false;
        if (w.PdfFiles.Count > 0)
            return false;

        _db.Workspaces.Remove(w);
        await _db.SaveChangesAsync();
        _logger.LogInformation("Workspace {Id} deleted", id);
        return true;
    }

    private async Task<WorkspaceDto?> MapToDtoAsync(Workspace w)
    {
        await _db.Entry(w).Collection(x => x.PdfFiles).LoadAsync();
        await _db.Entry(w).Collection(x => x.Categories).LoadAsync();
        await _db.Entry(w).Collection(x => x.MergeLists).LoadAsync();
        await _db.Entry(w).Collection(x => x.CustomFilterGroups).LoadAsync();
        return new WorkspaceDto
        {
            Id = w.Id,
            Name = w.Name,
            Slug = w.Slug,
            Description = w.Description,
            Icon = w.Icon,
            Color = w.Color,
            IsActive = w.IsActive,
            SortOrder = w.SortOrder,
            CreatedDate = w.CreatedDate,
            MusicCount = w.PdfFiles.Count,
            CategoryCount = w.Categories.Count,
            ListCount = w.MergeLists.Count,
            FilterGroupCount = w.CustomFilterGroups.Count
        };
    }
}
