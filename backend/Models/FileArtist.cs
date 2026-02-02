namespace MusicasIgreja.Api.Models;

public class FileArtist
{
    public int Id { get; set; }
    public int FileId { get; set; }
    public int ArtistId { get; set; }

    public PdfFile PdfFile { get; set; } = null!;
    public Artist Artist { get; set; } = null!;
}
