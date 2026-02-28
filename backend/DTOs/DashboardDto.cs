using System.Text.Json.Serialization;

namespace MusicasIgreja.Api.DTOs;

public class DashboardStatsDto
{
    [JsonPropertyName("total_musics")]
    public int TotalMusics { get; set; }
    
    [JsonPropertyName("total_lists")]
    public int TotalLists { get; set; }
    
    [JsonPropertyName("total_categories")]
    public int TotalCategories { get; set; }
    
    [JsonPropertyName("total_filter_groups")]
    public int TotalFilterGroups { get; set; }
    
    [JsonPropertyName("total_artists")]
    public int TotalArtists { get; set; }
    
    [JsonPropertyName("total_file_size_mb")]
    public double TotalFileSizeMb { get; set; }
    
    [JsonPropertyName("total_pages")]
    public int TotalPages { get; set; }
    
    [JsonPropertyName("musics_with_youtube")]
    public int MusicsWithYoutube { get; set; }
    
    [JsonPropertyName("avg_musics_per_list")]
    public double AvgMusicsPerList { get; set; }
    
    [JsonPropertyName("largest_list")]
    public LargestListDto? LargestList { get; set; }
    
    [JsonPropertyName("most_popular_category")]
    public MostPopularCategoryDto? MostPopularCategory { get; set; }
}

public class LargestListDto
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
    
    [JsonPropertyName("count")]
    public int Count { get; set; }
}

public class MostPopularCategoryDto
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
    
    [JsonPropertyName("count")]
    public int Count { get; set; }
}

public class WorkspaceDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedDate { get; set; }
    public int MusicCount { get; set; }
    public int CategoryCount { get; set; }
    public int ListCount { get; set; }
    public int FilterGroupCount { get; set; }
}

public record CreateWorkspaceDto
{
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string? Icon { get; init; }
    public string? Color { get; init; }
}

public record UpdateWorkspaceDto
{
    public string? Name { get; init; }
    public string? Description { get; init; }
    public string? Icon { get; init; }
    public string? Color { get; init; }
    public bool? IsActive { get; init; }
    public int? SortOrder { get; init; }
}

public class CustomFilterGroupDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public List<CustomFilterValueDto> Values { get; set; } = new();
}

public class CustomFilterValueDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public int FileCount { get; set; }
}

public record ArtistDto(
    int Id,
    string Name,
    string? Description
);
