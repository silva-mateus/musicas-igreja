namespace MusicasIgreja.Api.DTOs;

public record DashboardStatsDto(
    int TotalFiles,
    int TotalCategories,
    int TotalLiturgicalTimes,
    int TotalArtists,
    int TotalLists
);

public record CategoryDto(
    int Id,
    string Name,
    string? Description
);

public record LiturgicalTimeDto(
    int Id,
    string Name,
    string? Description
);

public record ArtistDto(
    int Id,
    string Name,
    string? Description
);

