using Microsoft.EntityFrameworkCore;
using TheDugoutViewer.Api.Data;
using TheDugoutViewer.Api.DTOs;

namespace TheDugoutViewer.Api.Services;

public class BinderService
{
    private readonly ViewerDbContext _db;

    public BinderService(ViewerDbContext db)
    {
        _db = db;
    }

    public async Task<List<BinderDto>> GetAllBindersAsync()
    {
        var binders = await _db.Binders.OrderBy(b => b.Id).ToListAsync();
        var result = new List<BinderDto>();

        foreach (var b in binders)
        {
            var cardCount = await _db.Cards
                .Where(c => c.BinderNumber == b.Id && !c.IsUnassigned)
                .CountAsync();

            result.Add(new BinderDto
            {
                Id = b.Id,
                Name = b.Name,
                Description = b.Description,
                TotalPages = b.TotalPages,
                CreatedAt = b.CreatedAt,
                CardCount = cardCount
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
                ImagePath = c.ImagePath,
                BackImagePath = c.BackImagePath,
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
}
