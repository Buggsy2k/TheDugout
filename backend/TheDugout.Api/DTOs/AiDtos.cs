namespace TheDugout.Api.DTOs;

public class TokenUsageInfo
{
    public int InputTokens { get; set; }
    public int OutputTokens { get; set; }
    public int TotalTokens { get; set; }
    public long? TokensRemaining { get; set; }
    public long? TokensLimit { get; set; }
    public long? InputTokensRemaining { get; set; }
    public long? OutputTokensRemaining { get; set; }
}

public class AiResponse<T>
{
    public T Result { get; set; } = default!;
    public TokenUsageInfo TokenUsage { get; set; } = new();
}

public class CardIdentificationResult
{
    public string PlayerName { get; set; } = string.Empty;
    public int? Year { get; set; }
    public string? SetName { get; set; }
    public string? CardNumber { get; set; }
    public string? Team { get; set; }
    public string? Manufacturer { get; set; }
    public string? EstimatedCondition { get; set; }
    public string? ConditionNotes { get; set; }
    public decimal? ValueRangeLow { get; set; }
    public decimal? ValueRangeHigh { get; set; }
    public string? Notes { get; set; }
    public string? Tags { get; set; }
    public float Confidence { get; set; }
}

public class PageIdentificationResult
{
    public List<PageCardResult> Cards { get; set; } = new();
    public string? PageNotes { get; set; }
}

public class PageCardResult
{
    public int Row { get; set; }
    public int Column { get; set; }
    public CardIdentificationResult? Card { get; set; }
    public bool IsEmpty { get; set; }
}

public class BulkRescanRequest
{
    public List<int> CardIds { get; set; } = new();
}

public class BulkRescanResult
{
    public int Updated { get; set; }
    public int Failed { get; set; }
    public int Skipped { get; set; }
    public int TotalTokensUsed { get; set; }
    public List<BulkRescanDetail> Details { get; set; } = new();
}

public class BulkRescanDetail
{
    public int CardId { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}
