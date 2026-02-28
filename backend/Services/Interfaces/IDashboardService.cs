using MusicasIgreja.Api.DTOs;

namespace MusicasIgreja.Api.Services.Interfaces;

public interface IDashboardService
{
    Task<DashboardStatsDto> GetStatsAsync(int workspaceId);
    Task<List<FilterOptionDto>> GetCategoriesAsync(int workspaceId);
    Task<List<CustomFilterGroupDto>> GetCustomFilterGroupsAsync(int workspaceId);
    Task<List<FilterOptionDto>> GetArtistsAsync(int workspaceId);
    Task<object> GetTopArtistsAsync(int workspaceId, int limit = 10);
    Task<object> GetTopSongsByCategoryAsync(int workspaceId, string categorySlug);
    Task<object> GetUploadsTimelineAsync(int workspaceId, int months = 12);
}
