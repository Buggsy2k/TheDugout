using Microsoft.EntityFrameworkCore;
using TheDugout.Api.Data;
using TheDugout.Api.DTOs;
using TheDugout.Api.Models;

namespace TheDugout.Api.Services;

public class BinderService
{
    private readonly AppDbContext _db;

    public BinderService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<BinderDto>> GetAllBindersAsync()
    {
        var binders = await _db.Binders.OrderBy(b => b.Id).ToListAsync();
        var result = new List<BinderDto>();

        foreach (var b in binders)
        {
            var cards = _db.Cards.Where(c => c.BinderNumber == b.Id && !c.IsUnassigned);
            result.Add(new BinderDto
            {
                Id = b.Id,
                Name = b.Name,
                Description = b.Description,
                TotalPages = b.TotalPages,
                CreatedAt = b.CreatedAt,
                CardCount = await cards.CountAsync(),
                TotalValueLow = await cards.SumAsync(c => c.ValueRangeLow ?? 0),
                TotalValueHigh = await cards.SumAsync(c => c.ValueRangeHigh ?? 0)
            });
        }

        return result;
    }

    public async Task<BinderDetailDto?> GetBinderByIdAsync(int id)
    {
        var binder = await _db.Binders.FirstOrDefaultAsync(b => b.Id == id);
        if (binder == null) return null;

        var cards = await _db.Cards
            .Where(c => c.BinderNumber == binder.Id && !c.IsUnassigned)
            .OrderBy(c => c.PageNumber).ThenBy(c => c.Row).ThenBy(c => c.Column)
            .ToListAsync();

        return new BinderDetailDto
        {
            Id = binder.Id,
            Name = binder.Name,
            Description = binder.Description,
            TotalPages = binder.TotalPages,
            CreatedAt = binder.CreatedAt,
            CardCount = cards.Count,
            TotalValueLow = cards.Sum(c => c.ValueRangeLow ?? 0),
            TotalValueHigh = cards.Sum(c => c.ValueRangeHigh ?? 0),
            Cards = cards.Select(c => new CardDto
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
                    BackImagePath = c.BackImagePath,
                    SourceImagePath = c.SourceImagePath,
                    Notes = c.Notes,
                    Tags = c.Tags,
                    IsGraded = c.IsGraded,
                    GradingService = c.GradingService,
                    GradeValue = c.GradeValue,
                    CreatedAt = c.CreatedAt,
                    UpdatedAt = c.UpdatedAt
                }).ToList()
        };
    }

    public async Task<BinderDto> CreateBinderAsync(CreateBinderDto dto)
    {
        var binder = new Binder
        {
            Name = dto.Name,
            Description = dto.Description,
            TotalPages = dto.TotalPages,
            CreatedAt = DateTime.UtcNow
        };

        _db.Binders.Add(binder);
        await _db.SaveChangesAsync();

        return new BinderDto
        {
            Id = binder.Id,
            Name = binder.Name,
            Description = binder.Description,
            TotalPages = binder.TotalPages,
            CreatedAt = binder.CreatedAt,
            CardCount = 0,
            TotalValueLow = 0,
            TotalValueHigh = 0
        };
    }

    public async Task<BinderDto?> UpdateBinderAsync(int id, UpdateBinderDto dto)
    {
        var binder = await _db.Binders.FirstOrDefaultAsync(b => b.Id == id);
        if (binder == null) return null;

        binder.Name = dto.Name;
        binder.Description = dto.Description;
        binder.TotalPages = dto.TotalPages;

        await _db.SaveChangesAsync();

        var cards = _db.Cards.Where(c => c.BinderNumber == binder.Id && !c.IsUnassigned);
        return new BinderDto
        {
            Id = binder.Id,
            Name = binder.Name,
            Description = binder.Description,
            TotalPages = binder.TotalPages,
            CreatedAt = binder.CreatedAt,
            CardCount = await cards.CountAsync(),
            TotalValueLow = await cards.SumAsync(c => c.ValueRangeLow ?? 0),
            TotalValueHigh = await cards.SumAsync(c => c.ValueRangeHigh ?? 0)
        };
    }

    public async Task<bool> DeleteBinderAsync(int id, bool cascade = false)
    {
        var binder = await _db.Binders.FirstOrDefaultAsync(b => b.Id == id);
        if (binder == null) return false;

        if (cascade)
        {
            var cards = await _db.Cards.Where(c => c.BinderNumber == binder.Id).ToListAsync();
            _db.Cards.RemoveRange(cards);
        }

        _db.Binders.Remove(binder);
        await _db.SaveChangesAsync();
        return true;
    }
}
