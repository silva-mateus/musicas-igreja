using MusicasIgreja.Api.DTOs;

namespace MusicasIgreja.Api.Services.Interfaces;

public interface IArtistService
{
    Task<List<FilterOptionDto>> GetArtistsAsync();
    Task<List<EntityDetailDto>> GetArtistsWithDetailsAsync();
    Task<int> CreateAsync(EntityDto dto);
    Task<bool> UpdateAsync(int id, EntityDto dto);
    Task<bool> DeleteAsync(int id);
    Task<(bool Success, string Message, int MergedCount)> MergeAsync(int sourceId, int targetId);
}
