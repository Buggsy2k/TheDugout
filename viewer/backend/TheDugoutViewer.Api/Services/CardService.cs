using Microsoft.EntityFrameworkCore;
using TheDugoutViewer.Api.Data;
using TheDugoutViewer.Api.DTOs;
using TheDugoutViewer.Api.Models;

namespace TheDugoutViewer.Api.Services;

public class CardService
{
    private readonly ViewerDbContext _db;

    public CardService(ViewerDbContext db)
    {
        _db = db;
    }

    public async Task<PaginatedResult<CardDto>> GetCardsAsync(CardQueryParams query)
    {
        var q = _db.Cards.Where(c => !c.IsUnassigned).AsQueryable();

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

        var totalCount = await q.CountAsync();

        q = query.SortBy?.ToLower() switch
        {
            "playername" => query.SortDir == "desc" ? q.OrderByDescending(c => c.PlayerName) : q.OrderBy(c => c.PlayerName),
            "year" => query.SortDir == "desc" ? q.OrderByDescending(c => c.Year) : q.OrderBy(c => c.Year),
            "set" or "setname" => query.SortDir == "desc" ? q.OrderByDescending(c => c.SetName) : q.OrderBy(c => c.SetName),
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
        if (card == null) return null;
        return MapToDto(card);
    }

    public async Task<CollectionStats> GetStatsAsync()
    {
        var cards = _db.Cards.Where(c => !c.IsUnassigned);
        var totalCards = await cards.CountAsync();
        var totalBinders = await cards.Select(c => c.BinderNumber).Distinct().CountAsync();

        return new CollectionStats
        {
            TotalCards = totalCards,
            TotalBinders = totalBinders,
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
    }

    public async Task<List<CardDto>> GetPageCardsAsync(int binderNumber, int pageNumber)
    {
        return await _db.Cards
            .Where(c => c.BinderNumber == binderNumber && c.PageNumber == pageNumber && !c.IsUnassigned)
            .OrderBy(c => c.Row).ThenBy(c => c.Column)
            .Select(c => MapToDto(c))
            .ToListAsync();
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
        ImagePath = c.ImagePath,
        BackImagePath = c.BackImagePath,
        Notes = c.Notes,
        Tags = c.Tags,
        IsGraded = c.IsGraded,
        GradingService = c.GradingService,
        GradeValue = c.GradeValue,
        CreatedAt = c.CreatedAt,
        UpdatedAt = c.UpdatedAt
    };
}
