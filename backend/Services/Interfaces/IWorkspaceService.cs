using MusicasIgreja.Api.DTOs;

namespace MusicasIgreja.Api.Services.Interfaces;

public interface IWorkspaceService
{
    Task<List<WorkspaceDto>> GetAllAsync();
    Task<WorkspaceDto?> GetByIdAsync(int id);
    Task<WorkspaceDto?> GetBySlugAsync(string slug);
    Task<WorkspaceDto> CreateAsync(CreateWorkspaceDto dto);
    Task<bool> UpdateAsync(int id, UpdateWorkspaceDto dto);
    Task<bool> DeleteAsync(int id);
}
