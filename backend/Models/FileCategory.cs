namespace MusicasIgreja.Api.Models;

public class FileCategory
{
    public int Id { get; set; }
    public int FileId { get; set; }
    public int CategoryId { get; set; }

    public PdfFile PdfFile { get; set; } = null!;
    public Category Category { get; set; } = null!;
}

