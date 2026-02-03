using System.Text.Json.Serialization;

namespace MusicasIgreja.Api.DTOs;

public class FixPdfNamesRequest
{
    [JsonPropertyName("file_ids")]
    public List<int>? FileIds { get; set; }
}

public class RegisterEntitiesRequest
{
    [JsonPropertyName("artists")]
    public List<string>? Artists { get; set; }

    [JsonPropertyName("categories")]
    public List<string>? Categories { get; set; }

    [JsonPropertyName("liturgical_times")]
    public List<string>? LiturgicalTimes { get; set; }
}

public class CheckDuplicateResponse
{
    [JsonPropertyName("is_duplicate")]
    public bool IsDuplicate { get; set; }

    [JsonPropertyName("existing_file")]
    public ExistingFileInfo? ExistingFile { get; set; }
}

public class ExistingFileInfo
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("filename")]
    public string Filename { get; set; } = string.Empty;

    [JsonPropertyName("song_name")]
    public string? SongName { get; set; }

    [JsonPropertyName("artist")]
    public string? Artist { get; set; }

    [JsonPropertyName("category")]
    public string? Category { get; set; }

    [JsonPropertyName("upload_date")]
    public DateTime UploadDate { get; set; }
}
