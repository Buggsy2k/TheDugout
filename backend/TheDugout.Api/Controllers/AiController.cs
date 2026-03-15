using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TheDugout.Api.Data;
using TheDugout.Api.DTOs;
using TheDugout.Api.Services;

namespace TheDugout.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AiController : ControllerBase
{
    private readonly ClaudeVisionService _visionService;
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
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

    public AiController(ClaudeVisionService visionService, AppDbContext db, IConfiguration config, ILogger<AiController> logger)
    {
        _visionService = visionService;
        _db = db;
        _config = config;
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
    public async Task<ActionResult<AiResponse<CardIdentificationResult>>> IdentifyCard(IFormFile file, IFormFile? backFile = null, [FromQuery] int? cardId = null)
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

        // Read back image if provided
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

        try
        {
            var response = await _visionService.IdentifySingleCardAsync(imageBytes, mediaType, backBytes, backMediaType);
            if (response == null)
                return StatusCode(500, "Failed to identify card");

            // Update LastAuditedAt if a card ID was provided
            if (cardId.HasValue)
            {
                var card = await _db.Cards.FindAsync(cardId.Value);
                if (card != null)
                {
                    card.LastAuditedAt = DateTime.UtcNow;
                    card.UpdatedAt = DateTime.UtcNow;
                    await _db.SaveChangesAsync();
                }
            }

            return Ok(response);
        }
        catch (Exception ex) when (ex.Message.Contains("credit balance", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Anthropic API credit balance too low");
            return StatusCode(402, "Anthropic API credits exhausted. Please add credits at console.anthropic.com.");
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
        catch (Exception ex) when (ex.Message.Contains("credit balance", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Anthropic API credit balance too low");
            return StatusCode(402, "Anthropic API credits exhausted. Please add credits at console.anthropic.com.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI page identification failed");
            return StatusCode(500, $"AI scan failed: {ex.Message}");
        }
    }

    [HttpPost("bulk-rescan")]
    public async Task<ActionResult<BulkRescanResult>> BulkRescan([FromBody] BulkRescanRequest request)
    {
        if (request.CardIds == null || request.CardIds.Count == 0)
            return BadRequest("No card IDs provided");

        if (request.CardIds.Count > 50)
            return BadRequest("Maximum 50 cards per bulk rescan");

        var uploadsPath = _config["UploadsPath"] ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
        var cards = await _db.Cards.Where(c => request.CardIds.Contains(c.Id)).ToListAsync();

        if (cards.Count == 0)
            return NotFound("No cards found");

        var result = new BulkRescanResult();

        foreach (var card in cards)
        {
            try
            {
                if (string.IsNullOrEmpty(card.ImagePath))
                {
                    result.Skipped++;
                    result.Details.Add(new BulkRescanDetail { CardId = card.Id, Status = "skipped", Message = "No image" });
                    continue;
                }

                // Read front image from disk
                var frontRelPath = card.ImagePath.TrimStart('/');
                var frontAbsPath = Path.Combine(uploadsPath, "..", frontRelPath);
                if (!System.IO.File.Exists(frontAbsPath))
                {
                    // Try direct path under uploads
                    var fileName = Path.GetFileName(card.ImagePath);
                    frontAbsPath = Path.Combine(uploadsPath, "cards", fileName);
                }
                if (!System.IO.File.Exists(frontAbsPath))
                {
                    result.Skipped++;
                    result.Details.Add(new BulkRescanDetail { CardId = card.Id, Status = "skipped", Message = "Image file not found" });
                    continue;
                }

                var frontBytes = await System.IO.File.ReadAllBytesAsync(frontAbsPath);
                var (preparedFront, frontMediaType) = PrepareForAi(frontBytes);

                // Read back image if available
                byte[]? backBytes = null;
                string? backMediaType = null;
                if (!string.IsNullOrEmpty(card.BackImagePath))
                {
                    var backFileName = Path.GetFileName(card.BackImagePath);
                    var backAbsPath = Path.Combine(uploadsPath, "cards", backFileName);
                    if (System.IO.File.Exists(backAbsPath))
                    {
                        var rawBack = await System.IO.File.ReadAllBytesAsync(backAbsPath);
                        (backBytes, backMediaType) = PrepareForAi(rawBack);
                    }
                }

                var response = await _visionService.IdentifySingleCardAsync(preparedFront, frontMediaType, backBytes, backMediaType);
                if (response?.Result == null)
                {
                    result.Failed++;
                    result.Details.Add(new BulkRescanDetail { CardId = card.Id, Status = "failed", Message = "AI returned no result" });
                    continue;
                }

                var aiResult = response.Result;
                card.PlayerName = aiResult.PlayerName ?? card.PlayerName;
                card.Year = aiResult.Year ?? card.Year;
                card.SetName = aiResult.SetName ?? card.SetName;
                card.CardNumber = aiResult.CardNumber ?? card.CardNumber;
                card.Team = aiResult.Team ?? card.Team;
                card.Manufacturer = aiResult.Manufacturer ?? card.Manufacturer;
                card.EstimatedCondition = aiResult.EstimatedCondition ?? card.EstimatedCondition;
                card.ConditionNotes = aiResult.ConditionNotes ?? card.ConditionNotes;
                card.ValueRangeLow = aiResult.ValueRangeLow ?? card.ValueRangeLow;
                card.ValueRangeHigh = aiResult.ValueRangeHigh ?? card.ValueRangeHigh;
                card.Notes = aiResult.Notes ?? card.Notes;
                card.Tags = aiResult.Tags ?? card.Tags;
                card.LastAuditedAt = DateTime.UtcNow;
                card.UpdatedAt = DateTime.UtcNow;

                result.Updated++;
                if (response.TokenUsage != null)
                    result.TotalTokensUsed += response.TokenUsage.TotalTokens;
                result.Details.Add(new BulkRescanDetail { CardId = card.Id, Status = "updated", Message = $"{aiResult.PlayerName} ({Math.Round(aiResult.Confidence * 100)}%)" });
            }
            catch (Exception ex) when (ex.Message.Contains("credit balance", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Anthropic API credit balance too low during bulk rescan");
                result.Failed++;
                result.Details.Add(new BulkRescanDetail { CardId = card.Id, Status = "failed", Message = "API credits exhausted" });
                break; // No point continuing if billing is the issue
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Bulk rescan failed for card {CardId}", card.Id);
                result.Failed++;
                result.Details.Add(new BulkRescanDetail { CardId = card.Id, Status = "failed", Message = ex.Message });
            }
        }

        await _db.SaveChangesAsync();
        return Ok(result);
    }

}
