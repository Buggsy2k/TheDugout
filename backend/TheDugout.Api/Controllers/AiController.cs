using Microsoft.AspNetCore.Mvc;
using TheDugout.Api.DTOs;
using TheDugout.Api.Services;

namespace TheDugout.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AiController : ControllerBase
{
    private readonly ClaudeVisionService _visionService;
    private readonly ILogger<AiController> _logger;

    private static readonly Dictionary<string, string> AllowedImageTypes = new()
    {
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".png"] = "image/png",
        [".webp"] = "image/webp",
        [".gif"] = "image/gif",
        [".tif"] = "image/tiff",
        [".tiff"] = "image/tiff"
    };

    public AiController(ClaudeVisionService visionService, ILogger<AiController> logger)
    {
        _visionService = visionService;
        _logger = logger;
    }

    private static (byte[] bytes, string mediaType) ConvertTiffIfNeeded(byte[] imageBytes, string mediaType)
    {
        if (mediaType != "image/tiff") return (imageBytes, mediaType);
        return (ImageConversionHelper.ConvertTiffToPng(imageBytes), "image/png");
    }

    /// <summary>
    /// Prepares image for Claude API: resizes large images and compresses as JPEG.
    /// </summary>
    private static (byte[] bytes, string mediaType) PrepareForAi(byte[] imageBytes)
    {
        return ImageConversionHelper.PrepareForAi(imageBytes);
    }

    [HttpPost("identify-card")]
    public async Task<ActionResult<AiResponse<CardIdentificationResult>>> IdentifyCard(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No image uploaded");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedImageTypes.TryGetValue(ext, out var mediaType))
            return BadRequest("Invalid file type. Allowed: jpg, jpeg, png, webp, gif, tif, tiff");

        if (file.Length > 50 * 1024 * 1024)
            return BadRequest("File size exceeds 50MB limit");

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        var imageBytes = ms.ToArray();

        (imageBytes, mediaType) = PrepareForAi(imageBytes);

        try
        {
            var response = await _visionService.IdentifySingleCardAsync(imageBytes, mediaType);
            if (response == null)
                return StatusCode(500, "Failed to identify card");

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI card identification failed");
            return StatusCode(500, $"AI identification failed: {ex.Message}");
        }
    }

    [HttpPost("identify-page")]
    public async Task<ActionResult<AiResponse<PageIdentificationResult>>> IdentifyPage(IFormFile file, IFormFile? backFile = null, [FromQuery] string layout = "3x3")
    {
        if (file == null || file.Length == 0)
            return BadRequest("No image uploaded");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedImageTypes.TryGetValue(ext, out var mediaType))
            return BadRequest("Invalid file type. Allowed: jpg, jpeg, png, webp, gif, tif, tiff");

        if (file.Length > 50 * 1024 * 1024)
            return BadRequest("File size exceeds 50MB limit");

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        var imageBytes = ms.ToArray();

        (imageBytes, mediaType) = PrepareForAi(imageBytes);

        try
        {
            // Read back image bytes if provided
            byte[]? backBytes = null;
            string? backMediaType = null;
            if (backFile != null && backFile.Length > 0)
            {
                var backExt = Path.GetExtension(backFile.FileName).ToLowerInvariant();
                if (AllowedImageTypes.TryGetValue(backExt, out backMediaType) && backFile.Length <= 50 * 1024 * 1024)
                {
                    using var backMs = new MemoryStream();
                    await backFile.CopyToAsync(backMs);
                    backBytes = backMs.ToArray();
                    (backBytes, backMediaType) = PrepareForAi(backBytes);
                }
            }

            var response = await _visionService.IdentifyPageAsync(imageBytes, mediaType, layout, backBytes, backMediaType);
            if (response == null)
                return StatusCode(500, "Failed to identify page");

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI page identification failed");
            return StatusCode(500, $"AI scan failed: {ex.Message}");
        }
    }

}
