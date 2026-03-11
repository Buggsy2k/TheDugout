---
name: ai-scan
description: 'Work with the Claude Vision AI card scanning integration. Use when modifying AI prompts, changing card identification logic, updating page scan behavior, adjusting token limits, adding new AI features, or debugging AI response parsing. Covers ClaudeVisionService, AiController, and frontend AI integration in BulkEntry and CardDetail.'
argument-hint: 'Describe the AI change, e.g. "Improve accuracy for vintage cards" or "Add error set detection"'
---

# AI Card Scanning Integration

## When to Use
- Modifying Claude Vision prompts for card/page identification
- Changing AI response parsing or JSON extraction
- Adjusting token limits or temperature settings
- Adding new AI-powered features
- Debugging AI scan results

## Architecture

### Backend Components
- **`Services/ClaudeVisionService.cs`** — Core AI logic
  - `IdentifySingleCardAsync(bytes, mediaType)` — Single card identification
  - `IdentifyPageAsync(bytes, mediaType, layout)` — Full page scan (3x3 or 6x3)
  - Prompts defined as string constants: `PageScanPrompt3x3`, `PageScanPrompt6x3`
  - Model: `AnthropicModels.Claude4Sonnet`
  - Temperature: 0.1 (near-deterministic)
  - Max tokens: 1024 (single card), 4096 (3x3 page), 8192 (6x3 page)

- **`Controllers/AiController.cs`** — API endpoints
  - `POST /api/ai/identify-card` — Single card (multipart file, 20MB max)
  - `POST /api/ai/identify-page?layout=3x3|6x3` — Page scan

- **`DTOs/AiDtos.cs`** — Response types
  - `TokenUsageInfo` — Input/output/cache token counts
  - `AiResponse<T>` — Wraps result + token usage + model info
  - `CardIdentificationResult` — Single card fields + confidence
  - `PageIdentificationResult` — Grid of `PageCardResult` entries
  - `PageCardResult` — Row, column, isEmpty flag, card data

### Frontend Components
- **`services/api.ts`** → `aiApi.identifyCard()`, `aiApi.identifyPage()`
- **`pages/BulkEntry.tsx`** — Page scan UI with layout toggle, grid population from AI
- **`pages/CardDetail.tsx`** — Single card AI identify button
- **`contexts/TokenUsageContext.tsx`** — Global token usage tracking
- **`components/Layout.tsx`** — Token meter in header (Cpu icon + progress bar)

## Prompt Modification Guide

### Single Card Prompt
Located in `ClaudeVisionService.cs` as the system message in `IdentifySingleCardAsync`.
Returns JSON with: playerName, year, setName, cardNumber, team, manufacturer, estimatedCondition, conditionNotes, valueRangeLow, valueRangeHigh, confidence.

### Page Scan Prompts
Located as `PageScanPrompt3x3` and `PageScanPrompt6x3` constants.
- 3x3: Single binder page, rows 1-3, columns 1-3
- 6x3: Double spread, rows 1-3, columns 1-6 (left page cols 1-3, right page cols 4-6)
- Returns JSON with `cards[]` array of `{row, column, isEmpty, ...cardFields}` and `pageNotes`

### Key Prompt Patterns
- Condition uses abbreviations: PR, FR, GD, VG, VGEX, EX, EXMT, NM, NMMT, MT, GEM
- Value estimates in USD ranges
- Confidence score 0.0 to 1.0
- Empty slots must still be reported with `isEmpty: true`

## Response Parsing
- Claude response text may be wrapped in markdown code fences
- `ExtractJson()` strips fences before `JsonSerializer.Deserialize`
- Uses `JsonSerializerOptions { PropertyNameCaseInsensitive = true }`

## Token Usage Flow
1. Backend extracts token counts from Anthropic SDK response (`Usage` property)
2. Wrapped in `TokenUsageInfo` DTO and returned with AI response
3. Frontend `TokenUsageContext` accumulates totals across session
4. Header displays progress bar against configurable limit

## Adding New AI Features
1. Add prompt + method to `ClaudeVisionService.cs`
2. Add DTO types to `AiDtos.cs`
3. Add endpoint to `AiController.cs`
4. Add API method to `frontend/src/services/api.ts` in `aiApi`
5. Add TypeScript types to `frontend/src/types/index.ts`
6. Build UI component and integrate token tracking
