using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.Models;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/artists")]
public class ArtistsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ArtistsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<object>> GetArtists()
    {
        var artists = await _context.Artists
            .OrderBy(a => a.Name)
            .Select(a => a.Name)
            .ToListAsync();

        return Ok(new { artists });
    }

    [HttpGet("with-details")]
    public async Task<ActionResult<object>> GetArtistsWithDetails()
    {
        var artists = await _context.Artists
            .OrderBy(a => a.Name)
            .Select(a => new
            {
                id = a.Id,
                name = a.Name,
                description = a.Description,
                file_count = a.FileArtists.Count
            })
            .ToListAsync();

        return Ok(new { artists });
    }

    [HttpPost]
    public async Task<ActionResult<object>> CreateArtist([FromBody] ArtistDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { success = false, error = "Nome é obrigatório" });

        var existing = await _context.Artists.FirstOrDefaultAsync(a => a.Name == dto.Name);
        if (existing != null)
            return Conflict(new { success = false, error = "Artista já existe" });

        var artist = new Artist
        {
            Name = dto.Name,
            Description = dto.Description
        };

        _context.Artists.Add(artist);
        await _context.SaveChangesAsync();

        return StatusCode(201, new { success = true, id = artist.Id });
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<object>> UpdateArtist(int id, [FromBody] ArtistDto dto)
    {
        var artist = await _context.Artists.FindAsync(id);
        if (artist == null)
            return NotFound(new { success = false, error = "Artista não encontrado" });

        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { success = false, error = "Nome é obrigatório" });

        // Check for duplicate name (excluding current)
        var duplicate = await _context.Artists
            .FirstOrDefaultAsync(a => a.Name == dto.Name && a.Id != id);
        if (duplicate != null)
            return Conflict(new { success = false, error = "Já existe outro artista com este nome" });

        artist.Name = dto.Name;
        artist.Description = dto.Description;

        await _context.SaveChangesAsync();

        return Ok(new { success = true });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<object>> DeleteArtist(int id)
    {
        var artist = await _context.Artists
            .Include(a => a.FileArtists)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (artist == null)
            return NotFound(new { success = false, error = "Artista não encontrado" });

        // Remove all file associations first
        _context.FileArtists.RemoveRange(artist.FileArtists);
        _context.Artists.Remove(artist);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, deleted_name = artist.Name });
    }

    /// <summary>
    /// Merge (consolidate) one artist into another.
    /// All files from source artist will be associated with target artist.
    /// Source artist will be deleted.
    /// </summary>
    [HttpPost("{sourceId}/merge/{targetId}")]
    public async Task<ActionResult<object>> MergeArtist(int sourceId, int targetId)
    {
        if (sourceId == targetId)
            return BadRequest(new { success = false, error = "Não é possível consolidar um artista com ele mesmo" });

        var source = await _context.Artists
            .Include(a => a.FileArtists)
            .FirstOrDefaultAsync(a => a.Id == sourceId);

        var target = await _context.Artists.FindAsync(targetId);

        if (source == null)
            return NotFound(new { success = false, error = "Artista de origem não encontrado" });

        if (target == null)
            return NotFound(new { success = false, error = "Artista de destino não encontrado" });

        // Move all file associations from source to target
        foreach (var fileArtist in source.FileArtists.ToList())
        {
            // Check if target already has this file association
            var existingAssociation = await _context.FileArtists
                .FirstOrDefaultAsync(fa => fa.FileId == fileArtist.FileId && fa.ArtistId == targetId);

            if (existingAssociation == null)
            {
                // Create new association with target
                _context.FileArtists.Add(new FileArtist
                {
                    FileId = fileArtist.FileId,
                    ArtistId = targetId
                });
            }

            // Remove old association
            _context.FileArtists.Remove(fileArtist);
        }

        // Delete the source artist
        _context.Artists.Remove(source);
        await _context.SaveChangesAsync();

        return Ok(new { 
            success = true, 
            message = $"Artista '{source.Name}' consolidado com '{target.Name}' com sucesso",
            merged_files = source.FileArtists.Count
        });
    }
}

public record ArtistDto(string Name, string? Description = null);
