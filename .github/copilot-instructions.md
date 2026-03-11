# The Dugout — Project Guidelines

## Overview
Baseball card collection manager: ASP.NET Core 8 backend + React/TypeScript/Vite frontend + PostgreSQL via Docker Compose. Claude Vision API for AI card identification.

## Architecture
- **Backend**: `backend/TheDugout.Api/` — ASP.NET Core 8 Web API (port 5137)
- **Frontend**: `frontend/` — React 19 + TypeScript + Vite 7 (port 5173)
- **Database**: PostgreSQL 16 via Docker Compose (port 5432, db=thedugout)
- **AI**: Anthropic Claude 4 Sonnet via Anthropic.SDK 5.10.0

## Project Structure
```
backend/TheDugout.Api/
  Controllers/    — API endpoints (Cards, Binders, Pages, Ai)
  Models/         — EF Core entities (Card, Binder, CardCondition enum)
  DTOs/           — Request/response objects
  Services/       — Business logic (CardService, BinderService, ClaudeVisionService)
  Data/           — AppDbContext with fluent config
  Migrations/     — EF Core migrations
frontend/src/
  pages/          — Route components (Dashboard, CollectionBrowser, BinderView, CardDetail, BulkEntry)
  components/     — Shared UI (Layout, CardTile, ConflictOverwriteDialog, Pagination)
  services/api.ts — Axios API client (cardApi, binderApi, pageApi, aiApi)
  types/index.ts  — All TypeScript interfaces
  contexts/       — React contexts (TokenUsageContext)
```

## Code Conventions

### Backend (C#)
- Controllers delegate to services; no business logic in controllers
- Services receive `AppDbContext` via constructor injection
- DTOs separate from models — never expose EF entities directly
- Use `async/await` throughout; return `ActionResult<T>`
- Full-text search uses PostgreSQL `tsvector` with GIN index
- Filtered unique index on Card location: `(BinderNumber, PageNumber, Row, Column) WHERE IsUnassigned = false`

### Frontend (TypeScript/React)
- Functional components with hooks
- API calls via `api.ts` service namespaces (e.g., `cardApi.getCards()`)
- Toast notifications via `react-hot-toast`
- Icons from `lucide-react`
- Routing via `react-router-dom` v7 in `main.tsx`
- State interfaces in `types/index.ts`

## Build & Run
- **Database**: `docker-compose up -d`
- **Backend**: `cd backend/TheDugout.Api && dotnet run`
- **Frontend**: `cd frontend && npm run dev`
- **Full restart**: `.\restart-dev.ps1` (stops all, builds, relaunches)
- **Known issue**: File lock build errors (MSB3027) → `Stop-Process -Name "TheDugout.Api"` first

## Key Patterns
- Card location is (BinderNumber, PageNumber, Row, Column); Row/Column are 1-based
- Binder pages support 3x3 (single page) and 6x3 (double spread) layouts
- AI scan returns JSON grid of cards; BulkEntry populates from AI results
- Conflict detection checks slot occupancy before save; offers unassign + overwrite flow
- Token usage tracked globally via React Context and displayed in header progress bar
