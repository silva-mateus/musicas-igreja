namespace MusicasIgreja.Api.Models;

public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    public ICollection<FileCategory> FileCategories { get; set; } = new List<FileCategory>();
}

