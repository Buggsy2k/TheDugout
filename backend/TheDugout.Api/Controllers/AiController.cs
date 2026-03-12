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
    public async Task<ActionResult<AiResponse<PageIdentificationResult>>> IdentifyPage(IFormFile file, IFormFile? backFile = null, [FromQuery] string layout = "3x3")
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

        // If a back image is provided, scan it for card numbers and merge
        if (backFile != null && backFile.Length > 0)
        {
            var backExt = Path.GetExtension(backFile.FileName).ToLowerInvariant();
            if (allowedTypes.TryGetValue(backExt, out var backMediaType) && backFile.Length <= 20 * 1024 * 1024)
            {
                using var backMs = new MemoryStream();
                await backFile.CopyToAsync(backMs);
                var backBytes = backMs.ToArray();

                var backResponse = await _visionService.IdentifyPageBackAsync(backBytes, backMediaType, layout);
                if (backResponse != null)
                {
                    MergeBackScanResults(response.Result, backResponse.Result);
                    // Combine token usage
                    response.TokenUsage.InputTokens += backResponse.TokenUsage.InputTokens;
                    response.TokenUsage.OutputTokens += backResponse.TokenUsage.OutputTokens;
                    response.TokenUsage.TotalTokens += backResponse.TokenUsage.TotalTokens;
                }
            }
        }

        return Ok(response);
    }

    /// <summary>
    /// Merges data from back scan into front scan results.
    /// Only fills in fields that are null/empty in the front scan.
    /// </summary>
    private static void MergeBackScanResults(PageIdentificationResult front, PageIdentificationResult back)
    {
        var backLookup = back.Cards
            .Where(c => !c.IsEmpty && c.Card != null)
            .ToDictionary(c => (c.Row, c.Column), c => c.Card!);

        foreach (var frontCard in front.Cards)
        {
            if (frontCard.IsEmpty || frontCard.Card == null) continue;
            if (!backLookup.TryGetValue((frontCard.Row, frontCard.Column), out var backCard)) continue;

            if (string.IsNullOrEmpty(frontCard.Card.CardNumber))
                frontCard.Card.CardNumber = backCard.CardNumber;
            if (string.IsNullOrEmpty(frontCard.Card.Manufacturer))
                frontCard.Card.Manufacturer = backCard.Manufacturer;
            if (string.IsNullOrEmpty(frontCard.Card.Team))
                frontCard.Card.Team = backCard.Team;
            if (string.IsNullOrEmpty(frontCard.Card.Notes))
                frontCard.Card.Notes = backCard.Notes;
            else if (!string.IsNullOrEmpty(backCard.Notes))
                frontCard.Card.Notes += " | Back: " + backCard.Notes;
        }
    }
}
