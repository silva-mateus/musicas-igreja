using MusicasIgreja.Api.DTOs;

namespace MusicasIgreja.Api.Services.Interfaces;

public interface IListService
{
    Task<List<MergeListSummaryDto>> GetListsAsync(int workspaceId, string? search, string? sortBy, string? sortOrder);
    Task<MergeListDetailDto?> GetListByIdAsync(int id);
    Task<int> CreateListAsync(int workspaceId, CreateMergeListDto dto);
    Task<bool> UpdateListAsync(int id, UpdateMergeListDto dto);
    Task<bool> DeleteListAsync(int id);
    Task<List<int>> AddItemsAsync(int id, List<int> fileIds);
    Task<bool> ReorderItemsAsync(int id, List<int> itemOrder);
    Task<int> DuplicateListAsync(int id, string? newName);
    Task<string?> GenerateReportAsync(int id);
    Task<(Stream? Stream, string? ListName)> ExportListAsync(int id);
}
