namespace MusicasIgreja.Api.Models;

public class MergeListItem
{
    public int Id { get; set; }
    public int MergeListId { get; set; }
    public int PdfFileId { get; set; }
    public int OrderPosition { get; set; }

    // Navigation properties
    public MergeList MergeList { get; set; } = null!;
    public PdfFile PdfFile { get; set; } = null!;
}

