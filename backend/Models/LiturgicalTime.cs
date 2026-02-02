namespace MusicasIgreja.Api.Models;

public class LiturgicalTime
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    public ICollection<FileLiturgicalTime> FileLiturgicalTimes { get; set; } = new List<FileLiturgicalTime>();
}

