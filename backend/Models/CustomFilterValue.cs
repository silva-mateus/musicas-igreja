using Core.Common.Entities;

namespace MusicasIgreja.Api.Models;

public class CustomFilterValue : ISlugEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    public int FilterGroupId { get; set; }
    public CustomFilterGroup FilterGroup { get; set; } = null!;

    public ICollection<FileCustomFilter> FileCustomFilters { get; set; } = new List<FileCustomFilter>();
}
