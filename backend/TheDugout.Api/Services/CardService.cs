using Microsoft.EntityFrameworkCore;
using TheDugout.Api.Data;
using TheDugout.Api.DTOs;
using TheDugout.Api.Models;

namespace TheDugout.Api.Services;

public class CardService
{
    private readonly AppDbContext _db;

    public CardService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<PaginatedResult<CardDto>> GetCardsAsync(CardQueryParams query)
    {
        var q = _db.Cards.AsQueryable();

        // Filter by assignment status (default: show only assigned cards)
        if (query.IsUnassigned.HasValue)
            q = q.Where(c => c.IsUnassigned == query.IsUnassigned.Value);
        else
            q = q.Where(c => !c.IsUnassigned);

        // Full-text search
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var searchTerm = query.Search.Trim();
            q = q.Where(c =>
                c.SearchVector!.Matches(EF.Functions.PlainToTsQuery("english", searchTerm)) ||
                EF.Functions.ILike(c.PlayerName, $"%{searchTerm}%") ||
                EF.Functions.ILike(c.SetName, $"%{searchTerm}%") ||
                (c.Team != null && EF.Functions.ILike(c.Team, $"%{searchTerm}%")) ||
                (c.Manufacturer != null && EF.Functions.ILike(c.Manufacturer, $"%{searchTerm}%")) ||
                (c.Notes != null && EF.Functions.ILike(c.Notes, $"%{searchTerm}%")) ||
                (c.Tags != null && EF.Functions.ILike(c.Tags, $"%{searchTerm}%"))
            );
        }

        // Filters
        if (query.BinderNumber.HasValue)
            q = q.Where(c => c.BinderNumber == query.BinderNumber.Value);

        if (query.Page.HasValue)
            q = q.Where(c => c.PageNumber == query.Page.Value);

        if (query.Year.HasValue)
            q = q.Where(c => c.Year == query.Year.Value);

        if (!string.IsNullOrWhiteSpace(query.SetName))
            q = q.Where(c => EF.Functions.ILike(c.SetName, $"%{query.SetName}%"));

        if (!string.IsNullOrWhiteSpace(query.Team))
            q = q.Where(c => c.Team != null && EF.Functions.ILike(c.Team, $"%{query.Team}%"));

        if (!string.IsNullOrWhiteSpace(query.Manufacturer))
            q = q.Where(c => c.Manufacturer != null && EF.Functions.ILike(c.Manufacturer, $"%{query.Manufacturer}%"));

        if (query.ValueLow.HasValue)
            q = q.Where(c => c.ValueRangeHigh >= query.ValueLow.Value);

        if (query.ValueHigh.HasValue)
            q = q.Where(c => c.ValueRangeLow <= query.ValueHigh.Value);

        if (!string.IsNullOrWhiteSpace(query.Tags))
        {
            var tags = query.Tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            foreach (var tag in tags)
            {
                q = q.Where(c => c.Tags != null && EF.Functions.ILike(c.Tags, $"%{tag}%"));
            }
        }

        if (query.IsGraded.HasValue)
            q = q.Where(c => c.IsGraded == query.IsGraded.Value);

        if (!string.IsNullOrWhiteSpace(query.ConditionMin))
        {
            var conditionOrder = GetConditionOrder();
            if (conditionOrder.TryGetValue(query.ConditionMin.ToUpper(), out var minIdx))
                q = q.Where(c => conditionOrder.Keys.ToList().IndexOf(c.EstimatedCondition) >= minIdx);
        }

        if (!string.IsNullOrWhiteSpace(query.ConditionMax))
        {
            var conditionOrder = GetConditionOrder();
            if (conditionOrder.TryGetValue(query.ConditionMax.ToUpper(), out var maxIdx))
                q = q.Where(c => conditionOrder.Keys.ToList().IndexOf(c.EstimatedCondition) <= maxIdx);
        }

        var totalCount = await q.CountAsync();

        // Sorting
        q = query.SortBy?.ToLower() switch
        {
            "playername" => query.SortDir == "desc" ? q.OrderByDescending(c => c.PlayerName) : q.OrderBy(c => c.PlayerName),
            "year" => query.SortDir == "desc" ? q.OrderByDescending(c => c.Year) : q.OrderBy(c => c.Year),
            "set" or "setname" => query.SortDir == "desc" ? q.OrderByDescending(c => c.SetName) : q.OrderBy(c => c.SetName),
            "valuehigh" => query.SortDir == "desc" ? q.OrderByDescending(c => c.ValueRangeHigh) : q.OrderBy(c => c.ValueRangeHigh),
            "valuelow" => query.SortDir == "desc" ? q.OrderByDescending(c => c.ValueRangeLow) : q.OrderBy(c => c.ValueRangeLow),
            "condition" => query.SortDir == "desc" ? q.OrderByDescending(c => c.EstimatedCondition) : q.OrderBy(c => c.EstimatedCondition),
            "dateadded" or "createdat" => query.SortDir == "desc" ? q.OrderByDescending(c => c.CreatedAt) : q.OrderBy(c => c.CreatedAt),
            "binder" => query.SortDir == "desc"
                ? q.OrderByDescending(c => c.BinderNumber).ThenByDescending(c => c.PageNumber).ThenByDescending(c => c.Row).ThenByDescending(c => c.Column)
                : q.OrderBy(c => c.BinderNumber).ThenBy(c => c.PageNumber).ThenBy(c => c.Row).ThenBy(c => c.Column),
            _ => q.OrderBy(c => c.PlayerName)
        };

        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var pageNum = Math.Max(query.PageNum, 1);

        var items = await q
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .Select(c => MapToDto(c))
            .ToListAsync();

        return new PaginatedResult<CardDto>
        {
            Items = items,
            TotalCount = totalCount,
            PageNum = pageNum,
            PageSize = pageSize
        };
    }

    public async Task<CardDto?> GetCardByIdAsync(int id)
    {
        var card = await _db.Cards.FindAsync(id);
        return card == null ? null : MapToDto(card);
    }

    public async Task<CardDto> CreateCardAsync(CreateCardDto dto)
    {
        var card = new Card
        {
            BinderNumber = dto.BinderNumber,
            PageNumber = dto.PageNumber,
            Row = dto.Row,
            Column = dto.Column,
            PlayerName = dto.PlayerName,
            Year = dto.Year,
            SetName = dto.SetName,
            CardNumber = dto.CardNumber,
            Team = dto.Team,
            Manufacturer = dto.Manufacturer,
            EstimatedCondition = dto.EstimatedCondition,
            ConditionNotes = dto.ConditionNotes,
            ValueRangeLow = dto.ValueRangeLow,
            ValueRangeHigh = dto.ValueRangeHigh,
            Notes = dto.Notes,
            Tags = dto.Tags,
            IsGraded = dto.IsGraded,
            GradingService = dto.GradingService,
            GradeValue = dto.GradeValue,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.Cards.Add(card);
        await _db.SaveChangesAsync();
        return MapToDto(card);
    }

    public async Task<CardDto?> UpdateCardAsync(int id, UpdateCardDto dto)
    {
        var card = await _db.Cards.FindAsync(id);
        if (card == null) return null;

        card.BinderNumber = dto.BinderNumber;
        card.PageNumber = dto.PageNumber;
        card.Row = dto.Row;
        card.Column = dto.Column;
        card.PlayerName = dto.PlayerName;
        card.Year = dto.Year;
        card.SetName = dto.SetName;
        card.CardNumber = dto.CardNumber;
        card.Team = dto.Team;
        card.Manufacturer = dto.Manufacturer;
        card.EstimatedCondition = dto.EstimatedCondition;
        card.ConditionNotes = dto.ConditionNotes;
        card.ValueRangeLow = dto.ValueRangeLow;
        card.ValueRangeHigh = dto.ValueRangeHigh;
        card.Notes = dto.Notes;
        card.Tags = dto.Tags;
        card.IsGraded = dto.IsGraded;
        card.GradingService = dto.GradingService;
        card.GradeValue = dto.GradeValue;

        await _db.SaveChangesAsync();
        return MapToDto(card);
    }

    public async Task<bool> DeleteCardAsync(int id)
    {
        var card = await _db.Cards.FindAsync(id);
        if (card == null) return false;

        _db.Cards.Remove(card);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<List<CardDto>> BulkCreateAsync(List<CreateCardDto> dtos)
    {
        var cards = dtos.Select(dto => new Card
        {
            BinderNumber = dto.BinderNumber,
            PageNumber = dto.PageNumber,
            Row = dto.Row,
            Column = dto.Column,
            PlayerName = dto.PlayerName,
            Year = dto.Year,
            SetName = dto.SetName,
            CardNumber = dto.CardNumber,
            Team = dto.Team,
            Manufacturer = dto.Manufacturer,
            EstimatedCondition = dto.EstimatedCondition,
            ConditionNotes = dto.ConditionNotes,
            ValueRangeLow = dto.ValueRangeLow,
            ValueRangeHigh = dto.ValueRangeHigh,
            Notes = dto.Notes,
            Tags = dto.Tags,
            IsGraded = dto.IsGraded,
            GradingService = dto.GradingService,
            GradeValue = dto.GradeValue,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        }).ToList();

        _db.Cards.AddRange(cards);
        await _db.SaveChangesAsync();
        return cards.Select(MapToDto).ToList();
    }

    public async Task<string?> UploadImageAsync(int id, IFormFile file, string uploadsPath)
    {
        var card = await _db.Cards.FindAsync(id);
        if (card == null) return null;

        var fileName = $"card_{id}_{Guid.NewGuid():N}{Path.GetExtension(file.FileName)}";
        var filePath = Path.Combine(uploadsPath, "cards", fileName);
        Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        card.ImagePath = $"/uploads/cards/{fileName}";
        await _db.SaveChangesAsync();
        return card.ImagePath;
    }

    public async Task<CollectionStats> GetStatsAsync()
    {
        var cards = _db.Cards.Where(c => !c.IsUnassigned);
        var totalCards = await cards.CountAsync();

        var stats = new CollectionStats
        {
            TotalCards = totalCards,
            TotalValueLow = await cards.SumAsync(c => c.ValueRangeLow ?? 0),
            TotalValueHigh = await cards.SumAsync(c => c.ValueRangeHigh ?? 0),
            BySet = await cards.GroupBy(c => c.SetName)
                .Select(g => new SetBreakdown { SetName = g.Key, Count = g.Count() })
                .OrderByDescending(s => s.Count)
                .Take(20)
                .ToListAsync(),
            ByYear = await cards.GroupBy(c => c.Year)
                .Select(g => new YearBreakdown { Year = g.Key, Count = g.Count() })
                .OrderBy(y => y.Year)
                .ToListAsync(),
            ByCondition = await cards.GroupBy(c => c.EstimatedCondition)
                .Select(g => new ConditionBreakdown { Condition = g.Key, Count = g.Count() })
                .ToListAsync(),
            TopValueCards = await cards.Where(c => c.ValueRangeHigh != null)
                .OrderByDescending(c => c.ValueRangeHigh)
                .Take(10)
                .Select(c => MapToDto(c))
                .ToListAsync(),
            RecentAdditions = await cards.OrderByDescending(c => c.CreatedAt)
                .Take(10)
                .Select(c => MapToDto(c))
                .ToListAsync(),
            ByDecade = (await cards.GroupBy(c => (c.Year / 10) * 10)
                .Select(g => new { Decade = g.Key, Count = g.Count() })
                .OrderBy(d => d.Decade)
                .ToListAsync())
                .Select(d => new DecadeBreakdown { Decade = $"{d.Decade}s", Count = d.Count })
                .ToList()
        };

        return stats;
    }

    public async Task<List<CardDto>> GetPageCardsAsync(int binderNumber, int pageNumber)
    {
        return await _db.Cards
            .Where(c => c.BinderNumber == binderNumber && c.PageNumber == pageNumber && !c.IsUnassigned)
            .OrderBy(c => c.Row).ThenBy(c => c.Column)
            .Select(c => MapToDto(c))
            .ToListAsync();
    }

    public async Task<string?> UploadPageImageAsync(int binderNumber, int pageNumber, IFormFile file, string uploadsPath)
    {
        var fileName = $"page_b{binderNumber}_p{pageNumber}_{Guid.NewGuid():N}{Path.GetExtension(file.FileName)}";
        var filePath = Path.Combine(uploadsPath, "pages", fileName);
        Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        return $"/uploads/pages/{fileName}";
    }

    private static CardDto MapToDto(Card c) => new()
    {
        Id = c.Id,
        BinderNumber = c.BinderNumber,
        PageNumber = c.PageNumber,
        Row = c.Row,
        Column = c.Column,
        PlayerName = c.PlayerName,
        Year = c.Year,
        SetName = c.SetName,
        CardNumber = c.CardNumber,
        Team = c.Team,
        Manufacturer = c.Manufacturer,
        EstimatedCondition = c.EstimatedCondition,
        ConditionNotes = c.ConditionNotes,
        ValueRangeLow = c.ValueRangeLow,
        ValueRangeHigh = c.ValueRangeHigh,
        ImagePath = c.ImagePath,
        SourceImagePath = c.SourceImagePath,
        Notes = c.Notes,
        Tags = c.Tags,
        IsGraded = c.IsGraded,
        IsUnassigned = c.IsUnassigned,
        GradingService = c.GradingService,
        GradeValue = c.GradeValue,
        CreatedAt = c.CreatedAt,
        UpdatedAt = c.UpdatedAt
    };

    private static Dictionary<string, int> GetConditionOrder() => new()
    {
        ["PR"] = 0, ["FR"] = 1, ["GD"] = 2, ["VG"] = 3,
        ["VGEX"] = 4, ["EX"] = 5, ["EXMT"] = 6,
        ["NM"] = 7, ["NMMT"] = 8, ["MT"] = 9, ["GEM"] = 10, ["UNKNOWN"] = -1
    };

    public async Task<ConflictCheckResult> CheckPageConflictsAsync(int binderNumber, int[] pageNumbers)
    {
        var existing = await _db.Cards
            .Where(c => c.BinderNumber == binderNumber
                        && pageNumbers.Contains(c.PageNumber)
                        && !c.IsUnassigned)
            .OrderBy(c => c.PageNumber).ThenBy(c => c.Row).ThenBy(c => c.Column)
            .Select(c => MapToDto(c))
            .ToListAsync();

        var result = new ConflictCheckResult
        {
            HasConflicts = existing.Count > 0,
            ConflictingCards = existing
        };

        if (existing.Count > 0)
        {
            var nextPage = await FindNextAvailablePageAsync(binderNumber, pageNumbers.Min());
            result.Suggestion = new NextAvailableSuggestion
            {
                BinderNumber = binderNumber,
                PageNumber = nextPage
            };
        }

        return result;
    }

    public async Task<ConflictCheckResult> CheckSlotConflictAsync(int binderNumber, int pageNumber, int row, int column)
    {
        var existing = await _db.Cards
            .Where(c => c.BinderNumber == binderNumber
                        && c.PageNumber == pageNumber
                        && c.Row == row
                        && c.Column == column
                        && !c.IsUnassigned)
            .Select(c => MapToDto(c))
            .ToListAsync();

        var result = new ConflictCheckResult
        {
            HasConflicts = existing.Count > 0,
            ConflictingCards = existing
        };

        if (existing.Count > 0)
        {
            var (nextRow, nextCol, nextPageNum) = await FindNextAvailableSlotAsync(binderNumber, pageNumber);
            result.Suggestion = new NextAvailableSuggestion
            {
                BinderNumber = binderNumber,
                PageNumber = nextPageNum,
                Row = nextRow,
                Column = nextCol
            };
        }

        return result;
    }

    public async Task<List<CardDto>> UnassignCardsAsync(List<int> cardIds)
    {
        var cards = await _db.Cards
            .Where(c => cardIds.Contains(c.Id) && !c.IsUnassigned)
            .ToListAsync();

        foreach (var card in cards)
        {
            card.IsUnassigned = true;
            card.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return cards.Select(MapToDto).ToList();
    }

    private async Task<int> FindNextAvailablePageAsync(int binderNumber, int startPage)
    {
        var usedPages = await _db.Cards
            .Where(c => c.BinderNumber == binderNumber
                        && c.PageNumber >= startPage
                        && !c.IsUnassigned)
            .Select(c => c.PageNumber)
            .Distinct()
            .OrderBy(p => p)
            .ToListAsync();

        var candidate = startPage;
        foreach (var used in usedPages)
        {
            if (used != candidate) break;
            candidate++;
        }
        return candidate;
    }

    private async Task<(int Row, int Column, int PageNumber)> FindNextAvailableSlotAsync(int binderNumber, int pageNumber)
    {
        var occupied = await _db.Cards
            .Where(c => c.BinderNumber == binderNumber
                        && c.PageNumber == pageNumber
                        && !c.IsUnassigned)
            .Select(c => new { c.Row, c.Column })
            .ToListAsync();

        var occupiedSet = new HashSet<(int, int)>(occupied.Select(o => (o.Row, o.Column)));

        for (int r = 1; r <= 3; r++)
        {
            for (int col = 1; col <= 3; col++)
            {
                if (!occupiedSet.Contains((r, col)))
                    return (r, col, pageNumber);
            }
        }

        // Page is full, find next available page
        var nextPage = await FindNextAvailablePageAsync(binderNumber, pageNumber + 1);
        return (1, 1, nextPage);
    }
}
