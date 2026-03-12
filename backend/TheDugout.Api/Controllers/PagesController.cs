using Microsoft.AspNetCore.Mvc;
using TheDugout.Api.DTOs;
using TheDugout.Api.Services;

namespace TheDugout.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PagesController : ControllerBase
{
    private readonly CardService _cardService;
    private readonly CardImageExtractionService _extractionService;
    private readonly IConfiguration _config;

    public PagesController(CardService cardService, CardImageExtractionService extractionService, IConfiguration config)
    {
        _cardService = cardService;
        _extractionService = extractionService;
        _config = config;
    }

    [HttpPost("upload")]
    public async Task<IActionResult> UploadPageImage(
        [FromQuery] int binderNumber,
        [FromQuery] int pageNumber,
        IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file uploaded");

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp", ".gif" };
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(ext))
            return BadRequest("Invalid file type. Allowed: jpg, jpeg, png, webp, gif");

        if (file.Length > 20 * 1024 * 1024)
            return BadRequest("File size exceeds 20MB limit");

        var uploadsPath = _config["UploadsPath"] ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
        var imagePath = await _cardService.UploadPageImageAsync(binderNumber, pageNumber, file, uploadsPath);

        return Ok(new { imagePath });
    }

    [HttpGet("{binderNumber}/{pageNumber}")]
    public async Task<ActionResult<List<CardDto>>> GetPageCards(int binderNumber, int pageNumber)
    {
        var cards = await _cardService.GetPageCardsAsync(binderNumber, pageNumber);
        return Ok(cards);
    }

    [HttpPost("extract-cards")]
    public async Task<IActionResult> ExtractCardImages(
        IFormFile file,
        [FromQuery] string layout = "3x3",
        [FromQuery] int binderNumber = 1,
        [FromQuery] int pageNumber = 1,
        [FromQuery] string side = "front")
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file uploaded");

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp", ".gif" };
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(ext))
            return BadRequest("Invalid file type. Allowed: jpg, jpeg, png, webp, gif");

        if (file.Length > 20 * 1024 * 1024)
            return BadRequest("File size exceeds 20MB limit");

        if (side != "front" && side != "back")
            return BadRequest("Side must be 'front' or 'back'");

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        var imageBytes = ms.ToArray();

        var uploadsPath = _config["UploadsPath"] ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
        var extracted = await _extractionService.ExtractCardsFromPageAsync(
            imageBytes, layout, uploadsPath, binderNumber, pageNumber, side);

        // Map row/col keys to serializable format
        var result = extracted.Select(kvp => new
        {
            row = kvp.Key.row,
            column = kvp.Key.col,
            imagePath = kvp.Value,
            side
        });

        return Ok(result);
    }

    [HttpPost("assign-extracted-images")]
    public async Task<IActionResult> AssignExtractedImages([FromBody] AssignExtractedImagesRequest request)
    {
        if (request.Assignments == null || request.Assignments.Count == 0)
            return BadRequest("No assignments provided");

        await _cardService.AssignExtractedImagesAsync(request.Assignments);
        return Ok();
    }
}
