using MusicasIgreja.Api.DTOs;

namespace MusicasIgreja.Api.Services.Interfaces;

public interface ICategoryService
{
    Task<List<FilterOptionDto>> GetCategoriesAsync(int workspaceId);
    Task<List<EntityDetailDto>> GetCategoriesWithDetailsAsync(int workspaceId);
    Task<int> CreateAsync(int workspaceId, EntityDto dto);
    Task<bool> UpdateAsync(int id, EntityDto dto);
    Task<bool> DeleteAsync(int id);
    Task<(bool Success, string Message, int MergedCount)> MergeAsync(int sourceId, int targetId);
}
