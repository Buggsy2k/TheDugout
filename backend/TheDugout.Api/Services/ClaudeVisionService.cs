using System.Text.Json;
using Anthropic.SDK;
using Anthropic.SDK.Messaging;
using TheDugout.Api.DTOs;

namespace TheDugout.Api.Services;

public class ClaudeVisionService
{
    private readonly AnthropicClient _client;
    private readonly ILogger<ClaudeVisionService> _logger;

    private const string SingleCardPrompt = @"You are an expert baseball card identifier and appraiser. Analyze the image of this baseball card and provide detailed information.

Return ONLY valid JSON (no markdown fences, no extra text) in this exact format:
{
  ""playerName"": ""full player name"",
  ""year"": 1987,
  ""setName"": ""e.g. Topps, Fleer, Upper Deck"",
  ""cardNumber"": ""card number in the set or null"",
  ""team"": ""team name shown on card"",
  ""manufacturer"": ""card manufacturer"",
  ""estimatedCondition"": ""one of: PR, FR, GD, VG, VGEX, EX, EXMT, NM, NMMT, MT, GEM, UNKNOWN"",
  ""conditionNotes"": ""any visible condition issues like creases, corner wear, centering problems"",
  ""valueRangeLow"": 0.50,
  ""valueRangeHigh"": 2.00,
  ""notes"": ""any interesting facts about this card such as rookie card, error card, subset info"",
  ""tags"": ""comma-separated tags like rookie,hall-of-fame,error,all-star"",
  ""confidence"": 0.85
}

For estimatedCondition, judge based on visible centering, corners, edges, and surface condition.
For value estimates, provide a reasonable range in USD based on the card identity and apparent condition.
Set confidence between 0.0 and 1.0 indicating how sure you are of the identification.
If you cannot identify the card at all, set playerName to ""Unknown"" and confidence to 0.0.";

    private const string PageScanPrompt3x3 = @"You are an expert baseball card identifier. This image shows a binder page with baseball cards arranged in a grid (typically 3 rows × 3 columns in standard 9-pocket pages).

Analyze each visible card in the grid. For each pocket/position, identify whether it contains a card or is empty.

Return ONLY valid JSON (no markdown fences, no extra text) in this exact format:
{
  ""cards"": [
    {
      ""row"": 1,
      ""column"": 1,
      ""isEmpty"": false,
      ""card"": {
        ""playerName"": ""full player name"",
        ""year"": 1987,
        ""setName"": ""e.g. Topps"",
        ""cardNumber"": ""card number or null"",
        ""team"": ""team name"",
        ""manufacturer"": ""manufacturer"",
        ""estimatedCondition"": ""one of: PR, FR, GD, VG, VGEX, EX, EXMT, NM, NMMT, MT, GEM, UNKNOWN"",
        ""conditionNotes"": ""visible condition issues"",
        ""valueRangeLow"": 0.50,
        ""valueRangeHigh"": 2.00,
        ""notes"": ""interesting facts"",
        ""tags"": ""comma-separated tags"",
        ""confidence"": 0.85
      }
    },
    {
      ""row"": 1,
      ""column"": 2,
      ""isEmpty"": true,
      ""card"": null
    }
  ],
  ""pageNotes"": ""any observations about the page as a whole""
}

Grid positions: Row 1 is the top row, Row 3 is the bottom. Column 1 is left, Column 3 is right.
Include ALL 9 positions (rows 1-3, columns 1-3) even if some are empty.
Set confidence between 0.0 and 1.0 for each identified card.
If a pocket has a card but you can't identify it, set playerName to ""Unknown"" with low confidence.";

    private const string PageScanPrompt6x3 = @"You are an expert baseball card identifier. This image shows TWO binder pages side by side (an open album spread), each with 3 rows × 3 columns of card pockets. Together they form a 3-row × 6-column grid of 18 card positions.

The LEFT page has columns 1-3. The RIGHT page has columns 4-6.

Analyze each visible card in the grid. For each pocket/position, identify whether it contains a card or is empty.

Return ONLY valid JSON (no markdown fences, no extra text) in this exact format:
{
  ""cards"": [
    {
      ""row"": 1,
      ""column"": 1,
      ""isEmpty"": false,
      ""card"": {
        ""playerName"": ""full player name"",
        ""year"": 1987,
        ""setName"": ""e.g. Topps"",
        ""cardNumber"": ""card number or null"",
        ""team"": ""team name"",
        ""manufacturer"": ""manufacturer"",
        ""estimatedCondition"": ""one of: PR, FR, GD, VG, VGEX, EX, EXMT, NM, NMMT, MT, GEM, UNKNOWN"",
        ""conditionNotes"": ""visible condition issues"",
        ""valueRangeLow"": 0.50,
        ""valueRangeHigh"": 2.00,
        ""notes"": ""interesting facts"",
        ""tags"": ""comma-separated tags"",
        ""confidence"": 0.85
      }
    },
    {
      ""row"": 1,
      ""column"": 4,
      ""isEmpty"": true,
      ""card"": null
    }
  ],
  ""pageNotes"": ""any observations about the pages as a whole""
}

Grid positions: Row 1 is the top row, Row 3 is the bottom.
Left page: Column 1 is far left, Column 3 is center-left.
Right page: Column 4 is center-right, Column 6 is far right.
Include ALL 18 positions (rows 1-3, columns 1-6) even if some are empty.
Set confidence between 0.0 and 1.0 for each identified card.
If a pocket has a card but you can't identify it, set playerName to ""Unknown"" with low confidence.";

    private const string BackScanPrompt3x3 = @"You are an expert baseball card identifier. This image shows the BACK side of a binder page with 3 rows × 3 columns of baseball cards.

IMPORTANT: Because this is the BACK of the page, the columns are MIRRORED compared to the front.
What was column 1 on the front is now column 3 in this image, and vice versa.
Return the positions as they appear on the FRONT (i.e. already un-mirrored):
- Image left column → front column 3
- Image center column → front column 2
- Image right column → front column 1

For each card back, extract the card number, any statistics, biographical info, or other details visible.

Return ONLY valid JSON (no markdown fences) in this format:
{
  ""cards"": [
    {
      ""row"": 1,
      ""column"": 1,
      ""isEmpty"": false,
      ""card"": {
        ""playerName"": ""player name if visible"",
        ""cardNumber"": ""card number from back"",
        ""team"": ""team if visible"",
        ""manufacturer"": ""manufacturer if visible"",
        ""notes"": ""any interesting info from the back (stats, bio, copyright year)"",
        ""year"": null
      }
    }
  ]
}

Include ALL 9 positions (rows 1-3, columns 1-3). Set isEmpty=true for empty pockets.";

    private const string BackScanPrompt6x3 = @"You are an expert baseball card identifier. This image shows the BACK side of TWO binder pages side by side (an open album spread), each with 3 rows × 3 columns. Together they form a 3-row × 6-column grid.

IMPORTANT: Because this is the BACK of the pages, the columns are MIRRORED compared to the front.
The left page in this image was the RIGHT page on the front, and vice versa.
Return positions as they map to the FRONT side:
- Image columns 1-3 (left page backs) → front columns 4-6 (but reversed: img col 1→front col 6, img col 2→front col 5, img col 3→front col 4)
- Image columns 4-6 (right page backs) → front columns 1-3 (but reversed: img col 4→front col 3, img col 5→front col 2, img col 6→front col 1)

For each card back, extract the card number, statistics, biographical info, or other details visible.

Return ONLY valid JSON (no markdown fences) in this format:
{
  ""cards"": [
    {
      ""row"": 1,
      ""column"": 1,
      ""isEmpty"": false,
      ""card"": {
        ""playerName"": ""player name if visible"",
        ""cardNumber"": ""card number from back"",
        ""team"": ""team if visible"",
        ""manufacturer"": ""manufacturer if visible"",
        ""notes"": ""any interesting info from the back (stats, bio, copyright year)"",
        ""year"": null
      }
    }
  ]
}

Include ALL 18 positions (rows 1-3, columns 1-6). Set isEmpty=true for empty pockets.";

    public ClaudeVisionService(AnthropicClient client, ILogger<ClaudeVisionService> logger)
    {
        _client = client;
        _logger = logger;
    }

    public async Task<AiResponse<CardIdentificationResult>?> IdentifySingleCardAsync(byte[] imageBytes, string mediaType)
    {
        try
        {
            var base64Image = Convert.ToBase64String(imageBytes);

            var messages = new List<Message>
            {
                new Message
                {
                    Role = RoleType.User,
                    Content = new List<ContentBase>
                    {
                        new ImageContent
                        {
                            Source = new ImageSource
                            {
                                MediaType = mediaType,
                                Data = base64Image
                            }
                        },
                        new TextContent { Text = "Identify this baseball card." }
                    }
                }
            };

            var parameters = new MessageParameters
            {
                Messages = messages,
                Model = Anthropic.SDK.Constants.AnthropicModels.Claude4Sonnet,
                MaxTokens = 1024,
                System = new List<SystemMessage>
                {
                    new SystemMessage(SingleCardPrompt)
                },
                Temperature = 0.1m
            };

            var response = await _client.Messages.GetClaudeMessageAsync(parameters);
            var responseText = response.Content.OfType<TextContent>().FirstOrDefault()?.Text;

            if (string.IsNullOrWhiteSpace(responseText))
            {
                _logger.LogWarning("Empty response from Claude for single card identification");
                return null;
            }

            var json = ExtractJson(responseText);
            var result = JsonSerializer.Deserialize<CardIdentificationResult>(json, JsonOpts);
            if (result == null) return null;

            return new AiResponse<CardIdentificationResult>
            {
                Result = result,
                TokenUsage = BuildTokenUsage(response)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error identifying single card with Claude Vision");
            throw;
        }
    }

    public async Task<AiResponse<PageIdentificationResult>?> IdentifyPageAsync(byte[] imageBytes, string mediaType, string layout = "3x3", byte[]? backImageBytes = null, string? backMediaType = null)
    {
        try
        {
            var is6x3 = string.Equals(layout, "6x3", StringComparison.OrdinalIgnoreCase);
            var prompt = is6x3 ? PageScanPrompt6x3 : PageScanPrompt3x3;

            var hasBack = backImageBytes != null && backMediaType != null;
            var userText = is6x3
                ? "Identify all baseball cards on these two side-by-side binder pages (6 columns × 3 rows)."
                : "Identify all baseball cards on this binder page.";
            if (hasBack)
                userText += " A second image of the card backs is included — use it only to confirm card numbers. Do not extract other details from the backs.";

            var base64Image = Convert.ToBase64String(imageBytes);

            var contentParts = new List<ContentBase>
            {
                new ImageContent
                {
                    Source = new ImageSource
                    {
                        MediaType = mediaType,
                        Data = base64Image
                    }
                }
            };

            if (hasBack)
            {
                contentParts.Add(new ImageContent
                {
                    Source = new ImageSource
                    {
                        MediaType = backMediaType!,
                        Data = Convert.ToBase64String(backImageBytes!)
                    }
                });
            }

            contentParts.Add(new TextContent { Text = userText });

            var messages = new List<Message>
            {
                new Message
                {
                    Role = RoleType.User,
                    Content = contentParts
                }
            };

            var parameters = new MessageParameters
            {
                Messages = messages,
                Model = Anthropic.SDK.Constants.AnthropicModels.Claude4Sonnet,
                MaxTokens = is6x3 ? 16384 : 12000,
                System = new List<SystemMessage>
                {
                    new SystemMessage(prompt)
                },
                Temperature = 0.1m
            };

            var response = await _client.Messages.GetClaudeMessageAsync(parameters);

            if (string.Equals(response.StopReason, "max_tokens", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Claude response truncated (max_tokens) for page scan. Output tokens used: {Tokens}", response.Usage?.OutputTokens);
                throw new InvalidOperationException("AI response was truncated — the page had too much detail. Try scanning fewer cards or a clearer image.");
            }

            var responseText = response.Content.OfType<TextContent>().FirstOrDefault()?.Text;

            if (string.IsNullOrWhiteSpace(responseText))
            {
                _logger.LogWarning("Empty response from Claude for page identification");
                return null;
            }

            var json = ExtractJson(responseText);
            var result = JsonSerializer.Deserialize<PageIdentificationResult>(json, JsonOpts);
            if (result == null) return null;

            return new AiResponse<PageIdentificationResult>
            {
                Result = result,
                TokenUsage = BuildTokenUsage(response)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error identifying page with Claude Vision");
            throw;
        }
    }

    public async Task<AiResponse<PageIdentificationResult>?> IdentifyPageBackAsync(byte[] imageBytes, string mediaType, string layout = "3x3")
    {
        try
        {
            var is6x3 = string.Equals(layout, "6x3", StringComparison.OrdinalIgnoreCase);
            var prompt = is6x3 ? BackScanPrompt6x3 : BackScanPrompt3x3;
            var userText = is6x3
                ? "Extract card numbers and details from the backs of these two side-by-side binder pages (6 columns × 3 rows)."
                : "Extract card numbers and details from the backs of this binder page.";

            var base64Image = Convert.ToBase64String(imageBytes);

            var messages = new List<Message>
            {
                new Message
                {
                    Role = RoleType.User,
                    Content = new List<ContentBase>
                    {
                        new ImageContent
                        {
                            Source = new ImageSource
                            {
                                MediaType = mediaType,
                                Data = base64Image
                            }
                        },
                        new TextContent { Text = userText }
                    }
                }
            };

            var parameters = new MessageParameters
            {
                Messages = messages,
                Model = Anthropic.SDK.Constants.AnthropicModels.Claude4Sonnet,
                MaxTokens = is6x3 ? 4096 : 2048,
                System = new List<SystemMessage>
                {
                    new SystemMessage(prompt)
                },
                Temperature = 0.1m
            };

            var response = await _client.Messages.GetClaudeMessageAsync(parameters);

            if (string.Equals(response.StopReason, "max_tokens", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Claude response truncated (max_tokens) for back scan. Output tokens used: {Tokens}", response.Usage?.OutputTokens);
                throw new InvalidOperationException("AI response was truncated for back scan — try a clearer image.");
            }

            var responseText = response.Content.OfType<TextContent>().FirstOrDefault()?.Text;

            if (string.IsNullOrWhiteSpace(responseText))
            {
                _logger.LogWarning("Empty response from Claude for page back identification");
                return null;
            }

            var json = ExtractJson(responseText);
            var result = JsonSerializer.Deserialize<PageIdentificationResult>(json, JsonOpts);
            if (result == null) return null;

            return new AiResponse<PageIdentificationResult>
            {
                Result = result,
                TokenUsage = BuildTokenUsage(response)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error identifying page backs with Claude Vision");
            throw;
        }
    }

    private static string ExtractJson(string text)
    {
        // Strip markdown code fences if present
        var trimmed = text.Trim();
        if (trimmed.StartsWith("```"))
        {
            var firstNewline = trimmed.IndexOf('\n');
            if (firstNewline > 0) trimmed = trimmed[(firstNewline + 1)..];
            if (trimmed.EndsWith("```")) trimmed = trimmed[..^3];
            trimmed = trimmed.Trim();
        }
        return trimmed;
    }

    private static TokenUsageInfo BuildTokenUsage(MessageResponse response)
    {
        var usage = response.Usage;
        var limits = response.RateLimits;
        return new TokenUsageInfo
        {
            InputTokens = usage?.InputTokens ?? 0,
            OutputTokens = usage?.OutputTokens ?? 0,
            TotalTokens = (usage?.InputTokens ?? 0) + (usage?.OutputTokens ?? 0),
            TokensRemaining = limits?.TokensRemaining,
            TokensLimit = limits?.TokensLimit,
            InputTokensRemaining = limits?.InputTokensRemaining,
            OutputTokensRemaining = limits?.OutputTokensRemaining
        };
    }

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };
}
