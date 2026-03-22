namespace TheDugoutViewer.Api.DTOs;

public class BinderDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? TotalPages { get; set; }
    public DateTime CreatedAt { get; set; }
    public int CardCount { get; set; }
}

public class BinderDetailDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? TotalPages { get; set; }
    public DateTime CreatedAt { get; set; }
    public int CardCount { get; set; }
    public List<CardDto> Cards { get; set; } = new();
}
