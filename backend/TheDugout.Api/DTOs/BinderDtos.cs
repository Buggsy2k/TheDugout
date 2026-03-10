namespace TheDugout.Api.DTOs;

public class BinderDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? TotalPages { get; set; }
    public DateTime CreatedAt { get; set; }
    public int CardCount { get; set; }
    public decimal? TotalValueLow { get; set; }
    public decimal? TotalValueHigh { get; set; }
}

public class BinderDetailDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? TotalPages { get; set; }
    public DateTime CreatedAt { get; set; }
    public int CardCount { get; set; }
    public decimal? TotalValueLow { get; set; }
    public decimal? TotalValueHigh { get; set; }
    public List<CardDto> Cards { get; set; } = new();
}

public class CreateBinderDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? TotalPages { get; set; }
}

public class UpdateBinderDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? TotalPages { get; set; }
}
