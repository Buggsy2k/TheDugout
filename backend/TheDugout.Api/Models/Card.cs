using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using NpgsqlTypes;

namespace TheDugout.Api.Models;

public class Card
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [Required]
    public int BinderNumber { get; set; }

    [Required]
    public int PageNumber { get; set; }

    [Required]
    public int Row { get; set; }

    [Required]
    public int Column { get; set; }

    [Required]
    [MaxLength(200)]
    public string PlayerName { get; set; } = string.Empty;

    [Required]
    public int Year { get; set; }

    [Required]
    [MaxLength(200)]
    public string SetName { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? CardNumber { get; set; }

    [MaxLength(100)]
    public string? Team { get; set; }

    [MaxLength(100)]
    public string? Manufacturer { get; set; }

    [Required]
    [MaxLength(20)]
    public string EstimatedCondition { get; set; } = CardCondition.UNKNOWN.ToString();

    [MaxLength(500)]
    public string? ConditionNotes { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? ValueRangeLow { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? ValueRangeHigh { get; set; }

    [MaxLength(500)]
    public string? ImagePath { get; set; }

    [MaxLength(500)]
    public string? SourceImagePath { get; set; }

    [MaxLength(1000)]
    public string? Notes { get; set; }

    [MaxLength(500)]
    public string? Tags { get; set; }

    public bool IsGraded { get; set; }

    public bool IsUnassigned { get; set; }

    [MaxLength(50)]
    public string? GradingService { get; set; }

    [MaxLength(20)]
    public string? GradeValue { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Full-text search vector (generated column in PostgreSQL)
    public NpgsqlTsVector? SearchVector { get; set; }

    // Navigation property
    public Binder? Binder { get; set; }
}
