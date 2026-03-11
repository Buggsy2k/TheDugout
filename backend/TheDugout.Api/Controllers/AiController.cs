using Microsoft.AspNetCore.Mvc;
using TheDugout.Api.DTOs;
using TheDugout.Api.Services;

namespace TheDugout.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AiController : ControllerBase
{
    private readonly ClaudeVisionService _visionService;

    public AiController(ClaudeVisionService visionService)
    {
        _visionService = visionService;
    }

    [HttpPost("identify-card")]
    public async Task<ActionResult<AiResponse<CardIdentificationResult>>> IdentifyCard(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No image uploaded");

        var allowedTypes = new Dictionary<string, string>
        {
            [".jpg"] = "image/jpeg",
            [".jpeg"] = "image/jpeg",
            [".png"] = "image/png",
            [".webp"] = "image/webp",
            [".gif"] = "image/gif"
        };

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedTypes.TryGetValue(ext, out var mediaType))
            return BadRequest("Invalid file type. Allowed: jpg, jpeg, png, webp, gif");

        if (file.Length > 20 * 1024 * 1024)
            return BadRequest("File size exceeds 20MB limit");

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        var imageBytes = ms.ToArray();

        var response = await _visionService.IdentifySingleCardAsync(imageBytes, mediaType);
        if (response == null)
            return StatusCode(500, "Failed to identify card");

        return Ok(response);
    }

    [HttpPost("identify-page")]
    public async Task<ActionResult<AiResponse<PageIdentificationResult>>> IdentifyPage(IFormFile file, [FromQuery] string layout = "3x3")
    {
        if (file == null || file.Length == 0)
            return BadRequest("No image uploaded");

        var allowedTypes = new Dictionary<string, string>
        {
            [".jpg"] = "image/jpeg",
            [".jpeg"] = "image/jpeg",
            [".png"] = "image/png",
            [".webp"] = "image/webp",
            [".gif"] = "image/gif"
        };

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedTypes.TryGetValue(ext, out var mediaType))
            return BadRequest("Invalid file type. Allowed: jpg, jpeg, png, webp, gif");

        if (file.Length > 20 * 1024 * 1024)
            return BadRequest("File size exceeds 20MB limit");

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        var imageBytes = ms.ToArray();

        var response = await _visionService.IdentifyPageAsync(imageBytes, mediaType, layout);
        if (response == null)
            return StatusCode(500, "Failed to identify page");

        return Ok(response);
    }
}
