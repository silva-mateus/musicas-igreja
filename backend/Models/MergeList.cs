namespace MusicasIgreja.Api.Models;

public class MergeList
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Observations { get; set; }
    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedDate { get; set; } = DateTime.UtcNow;

    public ICollection<MergeListItem> Items { get; set; } = new List<MergeListItem>();
}

