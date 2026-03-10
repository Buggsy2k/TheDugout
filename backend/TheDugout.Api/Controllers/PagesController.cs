using Microsoft.AspNetCore.Mvc;
using TheDugout.Api.DTOs;
using TheDugout.Api.Services;

namespace TheDugout.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PagesController : ControllerBase
{
    private readonly CardService _cardService;
    private readonly IConfiguration _config;

    public PagesController(CardService cardService, IConfiguration config)
    {
        _cardService = cardService;
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
}
