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
        return await _db.Binders
            .Include(b => b.Cards)
            .Select(b => new BinderDto
            {
                Id = b.Id,
                Name = b.Name,
                Description = b.Description,
                TotalPages = b.TotalPages,
                CreatedAt = b.CreatedAt,
                CardCount = b.Cards.Count,
                TotalValueLow = b.Cards.Sum(c => c.ValueRangeLow ?? 0),
                TotalValueHigh = b.Cards.Sum(c => c.ValueRangeHigh ?? 0)
            })
            .OrderBy(b => b.Id)
            .ToListAsync();
    }

    public async Task<BinderDetailDto?> GetBinderByIdAsync(int id)
    {
        var binder = await _db.Binders
            .Include(b => b.Cards)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (binder == null) return null;

        return new BinderDetailDto
        {
            Id = binder.Id,
            Name = binder.Name,
            Description = binder.Description,
            TotalPages = binder.TotalPages,
            CreatedAt = binder.CreatedAt,
            CardCount = binder.Cards.Count,
            TotalValueLow = binder.Cards.Sum(c => c.ValueRangeLow ?? 0),
            TotalValueHigh = binder.Cards.Sum(c => c.ValueRangeHigh ?? 0),
            Cards = binder.Cards.OrderBy(c => c.PageNumber).ThenBy(c => c.Row).ThenBy(c => c.Column)
                .Select(c => new CardDto
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
        var binder = await _db.Binders.Include(b => b.Cards).FirstOrDefaultAsync(b => b.Id == id);
        if (binder == null) return null;

        binder.Name = dto.Name;
        binder.Description = dto.Description;
        binder.TotalPages = dto.TotalPages;

        await _db.SaveChangesAsync();

        return new BinderDto
        {
            Id = binder.Id,
            Name = binder.Name,
            Description = binder.Description,
            TotalPages = binder.TotalPages,
            CreatedAt = binder.CreatedAt,
            CardCount = binder.Cards.Count,
            TotalValueLow = binder.Cards.Sum(c => c.ValueRangeLow ?? 0),
            TotalValueHigh = binder.Cards.Sum(c => c.ValueRangeHigh ?? 0)
        };
    }

    public async Task<bool> DeleteBinderAsync(int id, bool cascade = false)
    {
        var binder = await _db.Binders.Include(b => b.Cards).FirstOrDefaultAsync(b => b.Id == id);
        if (binder == null) return false;

        if (cascade)
        {
            _db.Cards.RemoveRange(binder.Cards);
        }

        _db.Binders.Remove(binder);
        await _db.SaveChangesAsync();
        return true;
    }
}
