using MusicasIgreja.Api.DTOs;

namespace MusicasIgreja.Api.Services.Interfaces;

public interface ICustomFilterService
{
    Task<List<CustomFilterGroupDto>> GetGroupsAsync(int workspaceId);
    Task<CustomFilterGroupDto?> GetGroupByIdAsync(int id);
    Task<int> CreateGroupAsync(int workspaceId, EntityDto dto);
    Task<bool> UpdateGroupAsync(int id, EntityDto dto);
    Task<bool> DeleteGroupAsync(int id);

    Task<List<EntityDetailDto>> GetValuesWithDetailsAsync(int groupId);
    Task<int> CreateValueAsync(int groupId, EntityDto dto);
    Task<bool> UpdateValueAsync(int id, EntityDto dto);
    Task<bool> DeleteValueAsync(int id);
    Task<(bool Success, string Message, int MergedCount)> MergeValuesAsync(int sourceId, int targetId);
}
