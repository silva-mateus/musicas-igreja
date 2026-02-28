using Core.Common.Entities;

namespace MusicasIgreja.Api.Models;

public class Workspace : ISlugEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    public ICollection<PdfFile> PdfFiles { get; set; } = new List<PdfFile>();
    public ICollection<Category> Categories { get; set; } = new List<Category>();
    public ICollection<CustomFilterGroup> CustomFilterGroups { get; set; } = new List<CustomFilterGroup>();
    public ICollection<MergeList> MergeLists { get; set; } = new List<MergeList>();
}
