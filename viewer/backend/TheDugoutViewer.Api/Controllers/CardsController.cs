using Microsoft.AspNetCore.Mvc;
using TheDugoutViewer.Api.DTOs;
using TheDugoutViewer.Api.Services;

namespace TheDugoutViewer.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CardsController : ControllerBase
{
    private readonly CardService _cardService;

    public CardsController(CardService cardService)
    {
        _cardService = cardService;
    }

    [HttpGet]
    public async Task<ActionResult<PaginatedResult<CardDto>>> GetCards([FromQuery] CardQueryParams query)
    {
        var result = await _cardService.GetCardsAsync(query);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<CardDto>> GetCard(int id)
    {
        var card = await _cardService.GetCardByIdAsync(id);
        if (card == null) return NotFound();
        return Ok(card);
    }

    [HttpGet("stats")]
    public async Task<ActionResult<CollectionStats>> GetStats()
    {
        var stats = await _cardService.GetStatsAsync();
        return Ok(stats);
    }
}
