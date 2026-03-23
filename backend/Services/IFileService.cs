using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Models;

namespace MusicasIgreja.Api.Services;

public interface IFileService
{
    Task<PdfFile> SaveFileAsync(IFormFile file, FileUploadDto metadata, int workspaceId, string workspaceSlug);
    void DeleteFile(string filePath);
    string GetAbsolutePath(string relativePath);
    string NormalizeToRelativePath(string path);
    string GenerateFilename(string? songName, string? artist, string originalFilename, string? musicalKey);
    string GetUniqueFilename(string directory, string filename);
    string ComputeFileHash(Stream stream);
    int GetPdfPageCount(string filePath);
    string? NormalizeSongTitle(string? title);
}
