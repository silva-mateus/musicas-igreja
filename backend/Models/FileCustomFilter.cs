namespace MusicasIgreja.Api.Models;

public class FileCustomFilter
{
    public int Id { get; set; }
    public int FileId { get; set; }
    public int FilterValueId { get; set; }

    public PdfFile PdfFile { get; set; } = null!;
    public CustomFilterValue FilterValue { get; set; } = null!;
}
