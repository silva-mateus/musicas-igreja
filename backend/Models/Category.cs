using Core.Common.Entities;

namespace MusicasIgreja.Api.Models;

public class Category : ISlugEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    public int WorkspaceId { get; set; }
    public Workspace Workspace { get; set; } = null!;

    public ICollection<FileCategory> FileCategories { get; set; } = new List<FileCategory>();
}
