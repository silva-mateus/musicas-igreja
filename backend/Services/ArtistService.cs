using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Models;
using MusicasIgreja.Api.Services.Interfaces;

namespace MusicasIgreja.Api.Services;

public class ArtistService : IArtistService
{
    private readonly AppDbContext _context;
    private readonly ILogger<ArtistService> _logger;

    public ArtistService(AppDbContext context, ILogger<ArtistService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<List<FilterOptionDto>> GetArtistsAsync()
    {
        return await _context.Artists
            .OrderBy(a => a.Name)
            .Select(a => new FilterOptionDto(a.Slug, a.Name))
            .ToListAsync();
    }

    public async Task<List<EntityDetailDto>> GetArtistsWithDetailsAsync()
    {
        return await _context.Artists
            .OrderBy(a => a.Name)
            .Select(a => new EntityDetailDto(
                a.Id,
                a.Name,
                a.Slug,
                a.Description,
                a.FileArtists.Count))
            .ToListAsync();
    }

    public async Task<int> CreateAsync(EntityDto dto)
    {
        var exists = await _context.Artists.AnyAsync(a => a.Name == dto.Name);
        if (exists)
            throw new InvalidOperationException("Já existe um artista com este nome.");

        var entity = new Artist
        {
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim()
        };
        _context.Artists.Add(entity);
        await _context.SaveChangesAsync();
        return entity.Id;
    }

    public async Task<bool> UpdateAsync(int id, EntityDto dto)
    {
        var entity = await _context.Artists.FindAsync(id);
        if (entity == null) return false;

        var exists = await _context.Artists.AnyAsync(a => a.Name == dto.Name && a.Id != id);
        if (exists)
            throw new InvalidOperationException("Já existe um artista com este nome.");

        entity.Name = dto.Name.Trim();
        entity.Description = dto.Description?.Trim();
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var entity = await _context.Artists.FindAsync(id);
        if (entity == null) return false;

        var associations = await _context.FileArtists
            .Where(fa => fa.ArtistId == id)
            .ToListAsync();
        _context.FileArtists.RemoveRange(associations);
        _context.Artists.Remove(entity);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<(bool Success, string Message, int MergedCount)> MergeAsync(int sourceId, int targetId)
    {
        if (sourceId == targetId)
            return (false, "Não é possível mesclar um artista com ele mesmo.", 0);

        var source = await _context.Artists.FindAsync(sourceId);
        var target = await _context.Artists.FindAsync(targetId);
        if (source == null || target == null)
            return (false, "Artista de origem ou destino não encontrado.", 0);

        var sourceAssocs = await _context.FileArtists
            .Where(fa => fa.ArtistId == sourceId)
            .ToListAsync();
        var targetFileIds = await _context.FileArtists
            .Where(fa => fa.ArtistId == targetId)
            .Select(fa => fa.FileId)
            .ToHashSetAsync();

        var toRemove = new List<FileArtist>();
        var mergedCount = 0;
        foreach (var assoc in sourceAssocs)
        {
            if (targetFileIds.Contains(assoc.FileId))
            {
                toRemove.Add(assoc);
            }
            else
            {
                assoc.ArtistId = targetId;
                targetFileIds.Add(assoc.FileId);
                mergedCount++;
            }
        }
        _context.FileArtists.RemoveRange(toRemove);
        _context.Artists.Remove(source);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Merged artist {SourceId} into {TargetId}, {Count} associations moved", sourceId, targetId, mergedCount);
        return (true, $"Mesclagem concluída. {mergedCount} associações movidas.", mergedCount);
    }
}
