namespace TheDugout.Api.DTOs;

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
    public decimal? ValueRangeLow { get; set; }
    public decimal? ValueRangeHigh { get; set; }
    public string? ImagePath { get; set; }
    public string? BackImagePath { get; set; }
    public string? SourceImagePath { get; set; }
    public string? Notes { get; set; }
    public string? Tags { get; set; }
    public bool IsGraded { get; set; }
    public string? GradingService { get; set; }
    public string? GradeValue { get; set; }
    public bool IsUnassigned { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateCardDto
{
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
    public decimal? ValueRangeLow { get; set; }
    public decimal? ValueRangeHigh { get; set; }
    public string? Notes { get; set; }
    public string? Tags { get; set; }
    public bool IsGraded { get; set; }
    public string? GradingService { get; set; }
    public string? GradeValue { get; set; }
}

public class UpdateCardDto
{
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
    public decimal? ValueRangeLow { get; set; }
    public decimal? ValueRangeHigh { get; set; }
    public string? Notes { get; set; }
    public string? Tags { get; set; }
    public bool IsGraded { get; set; }
    public string? GradingService { get; set; }
    public string? GradeValue { get; set; }
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
    public string? ConditionMin { get; set; }
    public string? ConditionMax { get; set; }
    public decimal? ValueLow { get; set; }
    public decimal? ValueHigh { get; set; }
    public string? Tags { get; set; }
    public bool? IsGraded { get; set; }
    public bool? IsUnassigned { get; set; }
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
    public decimal? TotalValueLow { get; set; }
    public decimal? TotalValueHigh { get; set; }
    public List<SetBreakdown> BySet { get; set; } = new();
    public List<YearBreakdown> ByYear { get; set; } = new();
    public List<ConditionBreakdown> ByCondition { get; set; } = new();
    public List<CardDto> TopValueCards { get; set; } = new();
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

public class ConflictCheckResult
{
    public bool HasConflicts { get; set; }
    public List<CardDto> ConflictingCards { get; set; } = new();
    public NextAvailableSuggestion? Suggestion { get; set; }
}

public class NextAvailableSuggestion
{
    public int BinderNumber { get; set; }
    public int PageNumber { get; set; }
    public int? Row { get; set; }
    public int? Column { get; set; }
}

public class UnassignRequest
{
    public List<int> CardIds { get; set; } = new();
}

public class BulkDeleteRequest
{
    public List<int> CardIds { get; set; } = new();
}

public class BulkDeleteResult
{
    public int DeletedCount { get; set; }
}

public class AssignExtractedImagesRequest
{
    public List<CardImageAssignment> Assignments { get; set; } = new();
}

public class CardImageAssignment
{
    public int CardId { get; set; }
    public string? FrontImagePath { get; set; }
    public string? BackImagePath { get; set; }
}
