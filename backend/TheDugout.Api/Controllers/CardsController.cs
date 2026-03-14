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

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff" };
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(ext))
            return BadRequest("Invalid file type. Allowed: jpg, jpeg, png, webp, gif, tif, tiff");

        if (file.Length > 50 * 1024 * 1024)
            return BadRequest("File size exceeds 50MB limit");

        var uploadsPath = _config["UploadsPath"] ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
        var imagePath = await _cardService.UploadImageAsync(id, file, uploadsPath);
        if (imagePath == null) return NotFound();

        return Ok(new { imagePath });
    }

    [HttpPost("upload-back-image/{id}")]
    public async Task<IActionResult> UploadBackImage(int id, IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file uploaded");

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff" };
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(ext))
            return BadRequest("Invalid file type. Allowed: jpg, jpeg, png, webp, gif, tif, tiff");

        if (file.Length > 50 * 1024 * 1024)
            return BadRequest("File size exceeds 50MB limit");

        var uploadsPath = _config["UploadsPath"] ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
        var imagePath = await _cardService.UploadBackImageAsync(id, file, uploadsPath);
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

    [HttpGet("check-page-conflicts")]
    public async Task<ActionResult<ConflictCheckResult>> CheckPageConflicts(
        [FromQuery] int binderNumber, [FromQuery] string pageNumbers)
    {
        if (string.IsNullOrWhiteSpace(pageNumbers))
            return BadRequest("pageNumbers is required");

        var pages = pageNumbers.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(p => int.TryParse(p, out var v) ? v : -1)
            .Where(v => v > 0)
            .ToArray();

        if (pages.Length == 0)
            return BadRequest("No valid page numbers provided");

        var result = await _cardService.CheckPageConflictsAsync(binderNumber, pages);
        return Ok(result);
    }

    [HttpGet("check-slot-conflict")]
    public async Task<ActionResult<ConflictCheckResult>> CheckSlotConflict(
        [FromQuery] int binderNumber, [FromQuery] int pageNumber,
        [FromQuery] int row, [FromQuery] int column)
    {
        var result = await _cardService.CheckSlotConflictAsync(binderNumber, pageNumber, row, column);
        return Ok(result);
    }

    [HttpPost("unassign")]
    public async Task<ActionResult<List<CardDto>>> UnassignCards([FromBody] UnassignRequest request)
    {
        if (request.CardIds == null || request.CardIds.Count == 0)
            return BadRequest("No card IDs provided");

        var unassigned = await _cardService.UnassignCardsAsync(request.CardIds);
        return Ok(unassigned);
    }

    [HttpPost("bulk-delete")]
    public async Task<ActionResult<BulkDeleteResult>> BulkDeleteCards([FromBody] BulkDeleteRequest request)
    {
        if (request.CardIds == null || request.CardIds.Count == 0)
            return BadRequest("No card IDs provided");

        if (request.CardIds.Count > 100)
            return BadRequest("Maximum 100 cards per bulk delete");

        var deletedCount = await _cardService.BulkDeleteCardsAsync(request.CardIds);
        return Ok(new BulkDeleteResult { DeletedCount = deletedCount });
    }
}
