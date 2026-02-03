using System.Text.Json.Serialization;

namespace MusicasIgreja.Api.DTOs;

public class SearchSuggestion
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("filename")]
    public string Filename { get; set; } = string.Empty;

    [JsonPropertyName("song_name")]
    public string? SongName { get; set; }

    [JsonPropertyName("artist")]
    public string? Artist { get; set; }

    [JsonPropertyName("musical_key")]
    public string? MusicalKey { get; set; }
}

public class SearchSuggestionsResponse
{
    [JsonPropertyName("suggestions")]
    public List<SearchSuggestion> Suggestions { get; set; } = new();
}

public class ArtistSearchResponse
{
    [JsonPropertyName("artists")]
    public List<string> Artists { get; set; } = new();
}
