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
    
    [JsonPropertyName("total_liturgical_times")]
    public int TotalLiturgicalTimes { get; set; }
    
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
