using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MusicasIgreja.Api.Models;

[Table("system_metrics")]
public class SystemMetric
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("metric_type")]
    [MaxLength(50)]
    public string MetricType { get; set; } = string.Empty; // disk_usage, upload_size, memory, cpu, etc

    [Required]
    [Column("value")]
    public double Value { get; set; }

    [Required]
    [Column("unit")]
    [MaxLength(20)]
    public string Unit { get; set; } = string.Empty; // MB, GB, %, count, ms

    [Column("metadata")]
    public string? Metadata { get; set; } // JSON string for additional context

    [Required]
    [Column("timestamp")]
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
