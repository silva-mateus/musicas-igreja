namespace MusicasIgreja.Api.Models;

public class FileLiturgicalTime
{
    public int Id { get; set; }
    public int FileId { get; set; }
    public int LiturgicalTimeId { get; set; }

    public PdfFile PdfFile { get; set; } = null!;
    public LiturgicalTime LiturgicalTime { get; set; } = null!;
}

