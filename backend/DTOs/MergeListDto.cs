namespace MusicasIgreja.Api.DTOs;

public record MergeListSummaryDto(
    int Id,
    string Name,
    string? Observations,
    DateTime CreatedDate,
    DateTime UpdatedDate,
    int FileCount
);

public record MergeListDetailDto(
    int Id,
    string Name,
    string? Observations,
    DateTime CreatedDate,
    DateTime UpdatedDate,
    List<MergeListItemDto> Items
);

public record MergeListItemDto(
    int ItemId,
    int OrderPosition,
    MergeListFileDto File
);

public record MergeListFileDto(
    int Id,
    string Filename,
    string? SongName,
    string? Artist,
    string? Category,
    string? LiturgicalTime,
    string? MusicalKey,
    string? YoutubeLink
);

public record CreateMergeListDto
{
    public string Name { get; init; } = string.Empty;
    public string? Observations { get; init; }
    public List<int>? FileIds { get; init; }
}

public record UpdateMergeListDto
{
    public string? Name { get; init; }
    public string? Observations { get; init; }
}

public record AddItemsDto
{
    public List<int> FileIds { get; init; } = new();
}

public record ReorderItemsDto
{
    public List<int> ItemOrder { get; init; } = new();
}

