namespace MusicasIgreja.Api.DTOs;

public record FileDto(
    int Id,
    string Filename,
    string OriginalName,
    string? SongName,
    string? Artist,
    List<string> Categories,
    Dictionary<string, FileCustomFilterGroupDto> CustomFilters,
    string? MusicalKey,
    string? YoutubeLink,
    long? FileSize,
    int? PageCount,
    DateTime UploadDate,
    string? Description
);

public class FileCustomFilterGroupDto
{
    public string GroupName { get; set; } = string.Empty;
    public List<string> Values { get; set; } = new();
}

public record FileListResponseDto(
    List<FileDto> Files,
    PaginationDto Pagination
);

public record PaginationDto(
    int Page,
    int PerPage,
    int Total,
    int TotalPages
);

public record FileUploadDto
{
    public string? SongName { get; init; }
    public string? Artist { get; init; }
    public List<string>? Categories { get; init; }
    public Dictionary<string, List<string>>? CustomFilters { get; init; }
    public string? MusicalKey { get; init; }
    public string? YoutubeLink { get; init; }
    public string? Description { get; init; }
}

public record FileUpdateDto
{
    public string? SongName { get; init; }
    public string? Artist { get; init; }
    public List<string>? Categories { get; init; }
    public Dictionary<string, List<string>>? CustomFilters { get; init; }
    public string? MusicalKey { get; init; }
    public string? YoutubeLink { get; init; }
    public string? Description { get; init; }
}

public record FileUploadResultDto
{
    public string Filename { get; init; } = string.Empty;
    public string OriginalName { get; init; } = string.Empty;
    public long Size { get; init; }
    public string Status { get; init; } = "success";
    public string? DuplicateOf { get; init; }
    public string? Message { get; init; }
    public int? FileId { get; init; }
}

public record GroupedFilesDto(string Name, int Count, List<GroupedFileItemDto> Files);

public record GroupedFileItemDto(
    int Id,
    string Filename,
    string? SongName,
    string? Artist,
    string? MusicalKey,
    List<string> Categories,
    Dictionary<string, FileCustomFilterGroupDto> CustomFilters,
    string? YoutubeLink
);

public record EntityDto
{
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
}

public record EntityDetailDto(
    int Id,
    string Name,
    string Slug,
    string? Description,
    int FileCount
);
