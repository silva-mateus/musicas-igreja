using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Models;

namespace MusicasIgreja.Api.Services.Interfaces;

public interface IMusicService
{
    Task<FileListResponseDto> GetMusicsAsync(int workspaceId, string? query, List<string>? categorySlugs,
        Dictionary<string, List<string>>? customFilterSlugs, List<string>? artistSlugs, string? musicalKey,
        int page, int perPage, string? sortBy, string? sortOrder, bool? hasYoutube = null);

    Task<FileDto?> GetMusicByIdAsync(int id);

    Task<PdfFile> UploadMusicAsync(int workspaceId, IFormFile file, FileUploadDto metadata);

    Task<bool> UpdateMusicAsync(int id, FileUpdateDto dto);

    Task<bool> DeleteMusicAsync(int id);

    Task<List<GroupedFilesDto>> GetGroupedByArtistAsync(int workspaceId);

    Task<List<GroupedFilesDto>> GetGroupedByCategoryAsync(int workspaceId);

    Task<PdfFile> ReplacePdfAsync(int id, IFormFile replacementPdf);
}
