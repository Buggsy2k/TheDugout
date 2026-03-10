using Microsoft.AspNetCore.Mvc;
using TheDugout.Api.DTOs;
using TheDugout.Api.Services;

namespace TheDugout.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CardsController : ControllerBase
{
    private readonly CardService _cardService;
    private readonly IConfiguration _config;

    public CardsController(CardService cardService, IConfiguration config)
    {
        _cardService = cardService;
        _config = config;
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

    [HttpPost]
    public async Task<ActionResult<CardDto>> CreateCard([FromBody] CreateCardDto dto)
    {
        var card = await _cardService.CreateCardAsync(dto);
        return CreatedAtAction(nameof(GetCard), new { id = card.Id }, card);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<CardDto>> UpdateCard(int id, [FromBody] UpdateCardDto dto)
    {
        var card = await _cardService.UpdateCardAsync(id, dto);
        if (card == null) return NotFound();
        return Ok(card);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteCard(int id)
    {
        var deleted = await _cardService.DeleteCardAsync(id);
        if (!deleted) return NotFound();
        return NoContent();
    }

    [HttpPost("upload-image/{id}")]
    public async Task<IActionResult> UploadImage(int id, IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file uploaded");

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp", ".gif" };
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(ext))
            return BadRequest("Invalid file type. Allowed: jpg, jpeg, png, webp, gif");

        if (file.Length > 10 * 1024 * 1024)
            return BadRequest("File size exceeds 10MB limit");

        var uploadsPath = _config["UploadsPath"] ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
        var imagePath = await _cardService.UploadImageAsync(id, file, uploadsPath);
        if (imagePath == null) return NotFound();

        return Ok(new { imagePath });
    }

    [HttpPost("bulk")]
    public async Task<ActionResult<List<CardDto>>> BulkCreate([FromBody] List<CreateCardDto> dtos)
    {
        if (dtos == null || dtos.Count == 0)
            return BadRequest("No cards provided");

        if (dtos.Count > 50)
            return BadRequest("Maximum 50 cards per bulk operation");

        var cards = await _cardService.BulkCreateAsync(dtos);
        return Ok(cards);
    }

    [HttpGet("stats")]
    public async Task<ActionResult<CollectionStats>> GetStats()
    {
        var stats = await _cardService.GetStatsAsync();
        return Ok(stats);
    }
}
