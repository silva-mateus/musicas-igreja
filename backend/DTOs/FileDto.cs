namespace MusicasIgreja.Api.DTOs;

public record FileDto(
    int Id,
    string Filename,
    string OriginalName,
    string? SongName,
    string? Artist,
    string? PrimaryCategory,
    string? PrimaryLiturgicalTime,
    List<string> Categories,
    List<string> LiturgicalTimes,
    string? MusicalKey,
    string? YoutubeLink,
    long? FileSize,
    int? PageCount,
    DateTime UploadDate,
    string? Description
);

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
    public List<string>? LiturgicalTimes { get; init; }
    public string? MusicalKey { get; init; }
    public string? YoutubeLink { get; init; }
    public string? Description { get; init; }
}

public record FileUpdateDto
{
    public string? SongName { get; init; }
    public string? Artist { get; init; }
    public List<string>? Categories { get; init; }
    public List<string>? LiturgicalTimes { get; init; }
    public string? MusicalKey { get; init; }
    public string? YoutubeLink { get; init; }
    public string? Description { get; init; }
}

