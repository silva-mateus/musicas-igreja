using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MusicasIgreja.Api.Models;

[Table("system_events")]
public class SystemEvent
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("event_type")]
    [MaxLength(50)]
    public string EventType { get; set; } = string.Empty;

    [Required]
    [Column("severity")]
    [MaxLength(20)]
    public string Severity { get; set; } = "low"; // low, medium, high, critical

    [Required]
    [Column("source")]
    [MaxLength(100)]
    public string Source { get; set; } = string.Empty;

    [Required]
    [Column("message")]
    public string Message { get; set; } = string.Empty;

    [Column("user_id")]
    public int? UserId { get; set; }

    [Column("ip_address")]
    [MaxLength(45)]
    public string? IpAddress { get; set; }

    [Column("user_agent")]
    [MaxLength(500)]
    public string? UserAgent { get; set; }

    [Column("metadata")]
    public string? Metadata { get; set; } // JSON string

    [Column("is_read")]
    public bool IsRead { get; set; } = false;

    [Required]
    [Column("created_date")]
    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    // Navigation property
    [ForeignKey("UserId")]
    public User? User { get; set; }
}
