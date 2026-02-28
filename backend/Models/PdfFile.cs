namespace MusicasIgreja.Api.Models;

public class PdfFile
{
    public int Id { get; set; }
    public string Filename { get; set; } = string.Empty;
    public string OriginalName { get; set; } = string.Empty;
    public string? SongName { get; set; }
    public string? MusicalKey { get; set; }
    public string? YoutubeLink { get; set; }
    public string FilePath { get; set; } = string.Empty;
    public long? FileSize { get; set; }
    public DateTime UploadDate { get; set; } = DateTime.UtcNow;
    public string? FileHash { get; set; }
    public int? PageCount { get; set; }
    public string? Description { get; set; }

    public int WorkspaceId { get; set; }
    public Workspace Workspace { get; set; } = null!;

    public ICollection<FileCategory> FileCategories { get; set; } = new List<FileCategory>();
    public ICollection<FileArtist> FileArtists { get; set; } = new List<FileArtist>();
    public ICollection<FileCustomFilter> FileCustomFilters { get; set; } = new List<FileCustomFilter>();
    public ICollection<MergeListItem> MergeListItems { get; set; } = new List<MergeListItem>();
}
