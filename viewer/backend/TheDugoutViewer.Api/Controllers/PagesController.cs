using Microsoft.AspNetCore.Mvc;
using TheDugoutViewer.Api.DTOs;
using TheDugoutViewer.Api.Services;

namespace TheDugoutViewer.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PagesController : ControllerBase
{
    private readonly CardService _cardService;

    public PagesController(CardService cardService)
    {
        _cardService = cardService;
    }

    [HttpGet("{binderNumber}/{pageNumber}")]
    public async Task<ActionResult<List<CardDto>>> GetPageCards(int binderNumber, int pageNumber)
    {
        var cards = await _cardService.GetPageCardsAsync(binderNumber, pageNumber);
        return Ok(cards);
    }
}
