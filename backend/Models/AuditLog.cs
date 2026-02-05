using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MusicasIgreja.Api.Models;

[Table("audit_logs")]
public class AuditLog
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("action")]
    [MaxLength(50)]
    public string Action { get; set; } = string.Empty; // create, update, delete, view

    [Required]
    [Column("entity_type")]
    [MaxLength(50)]
    public string EntityType { get; set; } = string.Empty; // user, file, list, etc

    [Column("entity_id")]
    public int? EntityId { get; set; }

    [Required]
    [Column("user_id")]
    public int UserId { get; set; }

    [Required]
    [Column("username")]
    [MaxLength(255)]
    public string Username { get; set; } = string.Empty;

    [Column("ip_address")]
    [MaxLength(45)]
    public string? IpAddress { get; set; }

    [Column("old_value")]
    public string? OldValue { get; set; } // JSON string

    [Column("new_value")]
    public string? NewValue { get; set; } // JSON string

    [Required]
    [Column("created_date")]
    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    // Navigation property
    [ForeignKey("UserId")]
    public User User { get; set; } = null!;
}
