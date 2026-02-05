using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MusicasIgreja.Api.Models;

[Table("alert_configurations")]
public class AlertConfiguration
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("config_key")]
    [MaxLength(100)]
    public string ConfigKey { get; set; } = string.Empty;

    [Required]
    [Column("name")]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Column("description")]
    [MaxLength(500)]
    public string? Description { get; set; }

    [Required]
    [Column("metric_type")]
    [MaxLength(50)]
    public string MetricType { get; set; } = string.Empty; // disk_usage, failed_logins, etc

    [Required]
    [Column("threshold_value")]
    public double ThresholdValue { get; set; }

    [Required]
    [Column("threshold_unit")]
    [MaxLength(20)]
    public string ThresholdUnit { get; set; } = string.Empty; // %, MB, count

    [Required]
    [Column("comparison_operator")]
    [MaxLength(10)]
    public string ComparisonOperator { get; set; } = "greater_than"; // greater_than, less_than, equals

    [Required]
    [Column("severity")]
    [MaxLength(20)]
    public string Severity { get; set; } = "medium"; // low, medium, high, critical

    [Required]
    [Column("is_enabled")]
    public bool IsEnabled { get; set; } = true;

    [Required]
    [Column("created_date")]
    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    [Column("updated_date")]
    public DateTime? UpdatedDate { get; set; }
}
