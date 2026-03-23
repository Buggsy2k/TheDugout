namespace TheDugoutViewer.Api.DTOs;

public class CardDto
{
    public int Id { get; set; }
    public int BinderNumber { get; set; }
    public int PageNumber { get; set; }
    public int Row { get; set; }
    public int Column { get; set; }
    public string PlayerName { get; set; } = string.Empty;
    public int Year { get; set; }
    public string SetName { get; set; } = string.Empty;
    public string? CardNumber { get; set; }
    public string? Team { get; set; }
    public string? Manufacturer { get; set; }
    public string EstimatedCondition { get; set; } = "UNKNOWN";
    public string? ConditionNotes { get; set; }
    public string? ImagePath { get; set; }
    public string? BackImagePath { get; set; }
    public string? Notes { get; set; }
    public string? Tags { get; set; }
    public bool IsGraded { get; set; }
    public string? GradingService { get; set; }
    public string? GradeValue { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CardQueryParams
{
    public string? Search { get; set; }
    public int? BinderNumber { get; set; }
    public int? Page { get; set; }
    public int? Year { get; set; }
    public string? SetName { get; set; }
    public string? Team { get; set; }
    public string? Manufacturer { get; set; }
    public string? Tags { get; set; }
    public bool? IsGraded { get; set; }
    public string SortBy { get; set; } = "playerName";
    public string SortDir { get; set; } = "asc";
    public int PageNum { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public class PaginatedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int PageNum { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
}

public class CollectionStats
{
    public int TotalCards { get; set; }
    public int TotalBinders { get; set; }
    public List<SetBreakdown> BySet { get; set; } = new();
    public List<YearBreakdown> ByYear { get; set; } = new();
    public List<ConditionBreakdown> ByCondition { get; set; } = new();
    public List<CardDto> RecentAdditions { get; set; } = new();
    public List<DecadeBreakdown> ByDecade { get; set; } = new();
}

public class SetBreakdown
{
    public string SetName { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class YearBreakdown
{
    public int Year { get; set; }
    public int Count { get; set; }
}

public class ConditionBreakdown
{
    public string Condition { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class DecadeBreakdown
{
    public string Decade { get; set; } = string.Empty;
    public int Count { get; set; }
}
