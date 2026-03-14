using System.Text.Json;
using Anthropic.SDK;
using Anthropic.SDK.Messaging;
using TheDugout.Api.DTOs;

namespace TheDugout.Api.Services;

public class ClaudeVisionService
{
    private readonly AnthropicClient _client;
    private readonly ILogger<ClaudeVisionService> _logger;

    private const string SingleCardPrompt = @"You are a world-class baseball card expert with encyclopedic knowledge of every major card set from 1948 to present. Analyze this card image with extreme precision.

IDENTIFICATION STEPS — follow in order:
1. READ all visible text on the card: player name, team name, card number, set logo, copyright line, manufacturer name
2. IDENTIFY the exact set by design elements:
   - Border color/style, photo type (action vs posed), logo placement
   - Topps (flagship, Chrome, Heritage, Stadium Club, Allen & Ginter, Gypsy Queen)
   - Donruss (Diamond Kings, Rated Rookie), Fleer (Ultra, Tradition), Upper Deck
   - Bowman (Chrome, Draft, 1st), Panini (Prizm, Select, Mosaic)
   - Score, Leaf, Pacific, Pinnacle, Skybox, etc.
3. DETERMINE the exact year from copyright text, design era, and uniform/stadium details
4. NOTE card number exactly as printed (include any prefix like #, T, RC)
5. CHECK for special designations: Rookie Card (RC), All-Star, League Leader, Record Breaker, Error, Variation, Insert, Parallel (refractor, gold, foil)

CONDITION GRADING — judge what is visible:
- Centering: Are borders even on all sides? Slight off-center = EX, noticeably off = VG
- Corners: Sharp and pointed = NM+, slight rounding = EX, visible wear = VG or below
- Edges: Clean = NM+, slight roughness = EX, chipping/fuzzing = VG or below
- Surface: Clean and glossy = NM+, minor scratches = EX, creases/stains = lower
- Note: Cards in sleeves look better than raw — be conservative

VALUE GUIDELINES — provide realistic market values in USD:
- Common base cards (1980s-2000s): $0.10-$1.00
- Common base cards (1950s-1970s): $1.00-$20.00 depending on condition
- Star players: 2x-10x base value
- Hall of Famers: 5x-50x base value
- Rookie cards of stars: significantly higher
- Error cards, short prints: premium over base
- If uncertain, provide a wider range rather than guessing wrong

Return ONLY valid JSON (no markdown fences, no extra text):
{
  ""playerName"": ""EXACT name as printed on card"",
  ""year"": 1987,
  ""setName"": ""exact set name e.g. Topps, 1987 Fleer, 1993 Upper Deck"",
  ""cardNumber"": ""exact number as printed including any prefix"",
  ""team"": ""team as shown on card"",
  ""manufacturer"": ""Topps, Fleer, Donruss, Upper Deck, Bowman, Panini, etc."",
  ""estimatedCondition"": ""one of: PR, FR, GD, VG, VGEX, EX, EXMT, NM, NMMT, MT, GEM, UNKNOWN"",
  ""conditionNotes"": ""specific observations about centering, corners, edges, surface"",
  ""valueRangeLow"": 0.50,
  ""valueRangeHigh"": 2.00,
  ""notes"": ""rookie card, error, subset, parallel, insert, or other notable features"",
  ""tags"": ""comma-separated: rookie,hall-of-fame,error,all-star,insert,parallel,etc."",
  ""confidence"": 0.85
}

IMPORTANT: Read the actual text on the card. Do not guess if you can read it. If text is partially obscured, note what you can read and estimate the rest with lower confidence.";

    private const string PageScanPrompt3x3 = @"You are a world-class baseball card expert with encyclopedic knowledge of every major card set from 1948 to present. This image shows a binder page with baseball cards in a 3-row × 3-column grid (standard 9-pocket page).

For EACH card, follow these identification steps:
1. READ all visible text: player name, team, card number, copyright, set logo/branding
2. IDENTIFY the exact set by design elements (border style, photo type, logo placement, color scheme)
3. DETERMINE the exact year from copyright text, design era, uniforms
4. NOTE the card number exactly as printed
5. CHECK for special designations: RC (Rookie Card), All-Star, Error, Insert, Parallel

COMMON SET IDENTIFICATION:
- Topps flagship: most common, look for Topps logo and year-specific border design
- Donruss: distinctive border patterns, Diamond Kings subset
- Fleer: clean designs, often with team logo
- Upper Deck: hologram on front, premium feel
- Bowman: prospect-focused, Chrome variants
- Score: bold colorful designs

CONDITION — judge conservatively (cards in sleeves appear better than they are):
- NM/NMMT: Sharp corners, centered, clean surface
- EX/EXMT: Very slight corner wear or minor centering issue
- VG/VGEX: Noticeable wear but still presentable
- Lower: Significant creases, stains, or damage visible

VALUE — realistic USD ranges:
- Common 1980s-2000s base cards: $0.05-$0.50
- Common 1960s-1970s: $1-$15 depending on condition
- Star players: 2x-10x common value
- Hall of Famers / Rookies of stars: significantly more

Return ONLY valid JSON (no markdown fences, no extra text):
{
  ""cards"": [
    {
      ""row"": 1,
      ""column"": 1,
      ""isEmpty"": false,
      ""card"": {
        ""playerName"": ""EXACT name as printed"",
        ""year"": 1987,
        ""setName"": ""exact set name"",
        ""cardNumber"": ""number as printed"",
        ""team"": ""team as shown"",
        ""manufacturer"": ""manufacturer"",
        ""estimatedCondition"": ""PR/FR/GD/VG/VGEX/EX/EXMT/NM/NMMT/MT/GEM/UNKNOWN"",
        ""conditionNotes"": ""specific observations"",
        ""valueRangeLow"": 0.25,
        ""valueRangeHigh"": 1.00,
        ""notes"": ""RC, error, subset, parallel, or other notable features"",
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
  ""pageNotes"": ""observations about the page — are all cards from the same set/year?""
}

Grid: Row 1=top, Row 3=bottom. Column 1=left, Column 3=right.
Include ALL 9 positions (rows 1-3, columns 1-3) even if empty.
IMPORTANT: Read the actual text on each card. Do not guess names or numbers if you can read them.";

    private const string PageScanPrompt6x3 = @"You are a world-class baseball card expert with encyclopedic knowledge of every major card set from 1948 to present. This image shows TWO binder pages side by side (open album spread), each with 3 rows × 3 columns. Together: 3 rows × 6 columns = 18 positions.

The LEFT page has columns 1-3. The RIGHT page has columns 4-6.

For EACH card, follow these identification steps:
1. READ all visible text: player name, team, card number, copyright, set logo/branding
2. IDENTIFY the exact set by design elements (border style, photo type, logo placement, color scheme)
3. DETERMINE the exact year from copyright text, design era, uniforms
4. NOTE the card number exactly as printed
5. CHECK for special designations: RC (Rookie Card), All-Star, Error, Insert, Parallel

COMMON SET IDENTIFICATION:
- Topps flagship: most common, look for Topps logo and year-specific border design
- Donruss: distinctive border patterns, Diamond Kings subset
- Fleer: clean designs, often with team logo
- Upper Deck: hologram on front, premium feel
- Bowman: prospect-focused, Chrome variants
- Score: bold colorful designs

CONDITION — judge conservatively (cards in sleeves appear better than they are):
- NM/NMMT: Sharp corners, centered, clean surface
- EX/EXMT: Very slight corner wear or minor centering issue
- VG/VGEX: Noticeable wear but still presentable
- Lower: Significant creases, stains, or damage visible

VALUE — realistic USD ranges:
- Common 1980s-2000s base cards: $0.05-$0.50
- Common 1960s-1970s: $1-$15 depending on condition
- Star players: 2x-10x common value
- Hall of Famers / Rookies of stars: significantly more

Return ONLY valid JSON (no markdown fences, no extra text):
{
  ""cards"": [
    {
      ""row"": 1,
      ""column"": 1,
      ""isEmpty"": false,
      ""card"": {
        ""playerName"": ""EXACT name as printed"",
        ""year"": 1987,
        ""setName"": ""exact set name"",
        ""cardNumber"": ""number as printed"",
        ""team"": ""team as shown"",
        ""manufacturer"": ""manufacturer"",
        ""estimatedCondition"": ""PR/FR/GD/VG/VGEX/EX/EXMT/NM/NMMT/MT/GEM/UNKNOWN"",
        ""conditionNotes"": ""specific observations"",
        ""valueRangeLow"": 0.25,
        ""valueRangeHigh"": 1.00,
        ""notes"": ""RC, error, subset, parallel, or other notable features"",
        ""tags"": ""comma-separated tags"",
        ""confidence"": 0.85
      }
    }
  ],
  ""pageNotes"": ""observations about the pages — same set/year? any patterns?""
}

Grid: Row 1=top, Row 3=bottom. Left page: Col 1-3. Right page: Col 4-6.
Include ALL 18 positions (rows 1-3, columns 1-6) even if empty.
IMPORTANT: Read the actual text on each card. Do not guess names or numbers if you can read them.";

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

    public async Task<AiResponse<CardIdentificationResult>?> IdentifySingleCardAsync(byte[] imageBytes, string mediaType, byte[]? backImageBytes = null, string? backMediaType = null)
    {
        try
        {
            var base64Image = Convert.ToBase64String(imageBytes);

            var contentList = new List<ContentBase>
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

            if (backImageBytes != null && !string.IsNullOrEmpty(backMediaType))
            {
                var base64Back = Convert.ToBase64String(backImageBytes);
                contentList.Add(new ImageContent
                {
                    Source = new ImageSource
                    {
                        MediaType = backMediaType,
                        Data = base64Back
                    }
                });
                contentList.Add(new TextContent { Text = "Identify this baseball card. The first image is the front and the second image is the back. Use both images for identification — the back often has card number, copyright year, manufacturer, and player stats." });
            }
            else
            {
                contentList.Add(new TextContent { Text = "Identify this baseball card." });
            }

            var messages = new List<Message>
            {
                new Message
                {
                    Role = RoleType.User,
                    Content = contentList
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
