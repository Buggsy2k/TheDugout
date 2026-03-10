# Baseball Card Collection Manager — Application Specification

## Project Overview

Build a full-stack baseball card collection management application that allows a collector to photograph pages of cards (typically 3x3 grids in binder pages), catalog them with location metadata (binder, page, row, column), and track estimated values and conditions. The system should support searching, filtering, and browsing the collection with a clean, modern UI.

## Technology Stack

- **Backend:** C# / ASP.NET Core Web API (.NET 8+)
- **Frontend:** React (Vite + TypeScript)
- **Database:** PostgreSQL
- **ORM:** Entity Framework Core with Npgsql provider
- **Image Storage:** Local filesystem with paths stored in the database
- **Containerization:** Docker Compose for PostgreSQL (and optionally the full stack)

---

## Data Model

### Card Entity

| Column | Type | Description |
|--------|------|-------------|
| Id | int (PK, auto) | Unique card identifier |
| BinderNumber | int | Which binder the card is stored in |
| PageNumber | int | Page number within the binder |
| Row | int | Row position on the page (1-3 for a standard 9-pocket page) |
| Column | int | Column position on the page (1-3) |
| PlayerName | string | Full name of the player on the card |
| Year | int | Year the card was produced |
| SetName | string | Card set name (e.g., "Topps", "Fleer", "Golden Press Hall of Fame") |
| CardNumber | string? | Card number within the set (nullable — some sets don't have numbers, or it may be unknown) |
| Team | string? | Team shown on the card |
| Manufacturer | string? | Card manufacturer (e.g., Topps, Fleer, Bowman, Rembrandt) |
| EstimatedCondition | string | Estimated condition (see Condition enum below) |
| ConditionNotes | string? | Free-text notes about condition (e.g., "visible crease across center", "soft corners") |
| ValueRangeLow | decimal? | Low end of estimated value range in USD |
| ValueRangeHigh | decimal? | High end of estimated value range in USD |
| ImagePath | string? | Path to the uploaded photo of the card (or cropped image from grid) |
| SourceImagePath | string? | Path to the original full-page photo this card was extracted from |
| Notes | string? | General notes (e.g., "NL All-Stars subset", "double printed", "Rookie of the Year") |
| Tags | string? | Comma-separated tags for flexible categorization (e.g., "rookie,hall-of-fame,error") |
| IsGraded | bool | Whether the card has been professionally graded |
| GradingService | string? | PSA, SGC, BGS, CGC, etc. |
| GradeValue | string? | The numeric or alphanumeric grade (e.g., "8", "NM-MT") |
| CreatedAt | DateTime | Record creation timestamp |
| UpdatedAt | DateTime | Last modified timestamp |

### Condition Enum Values

Use these standard hobby condition abbreviations as a string enum:

- `PR` — Poor (PSA 1)
- `FR` — Fair (PSA 1.5)
- `GD` — Good (PSA 2-2.5)
- `VG` — Very Good (PSA 3-3.5)
- `VGEX` — VG-EX (PSA 4-4.5)
- `EX` — Excellent (PSA 5-5.5)
- `EXMT` — EX-MT (PSA 6-6.5)
- `NM` — Near Mint (PSA 7-7.5)
- `NMMT` — NM-MT (PSA 8-8.5)
- `MT` — Mint (PSA 9-9.5)
- `GEM` — Gem Mint (PSA 10)
- `UNKNOWN` — Not yet assessed

### Binder Entity (Optional but Recommended)

| Column | Type | Description |
|--------|------|-------------|
| Id | int (PK) | Binder number |
| Name | string | Descriptive name (e.g., "Vintage Pre-1970", "1992 Topps Complete Set") |
| Description | string? | Notes about the binder contents |
| TotalPages | int? | Number of pages in this binder |
| CreatedAt | DateTime | Record creation timestamp |

---

## API Endpoints

### Cards

- `GET /api/cards` — List/search cards with pagination, sorting, and filtering
  - Query params: `search`, `binderNumber`, `page`, `year`, `setName`, `team`, `manufacturer`, `conditionMin`, `conditionMax`, `valueLow`, `valueHigh`, `tags`, `isGraded`, `sortBy`, `sortDir`, `pageNum`, `pageSize`
  - The `search` param should search across: playerName, setName, team, manufacturer, notes, and tags
- `GET /api/cards/{id}` — Get single card with full details
- `POST /api/cards` — Create a new card entry
- `PUT /api/cards/{id}` — Update a card entry
- `DELETE /api/cards/{id}` — Delete a card entry
- `POST /api/cards/upload-image/{id}` — Upload/replace the image for a card
- `POST /api/cards/bulk` — Bulk create cards (for batch entry from a photographed page)
- `GET /api/cards/stats` — Collection statistics (total cards, total estimated value range, breakdown by set/year/condition)

### Binders

- `GET /api/binders` — List all binders with card counts and value summaries
- `GET /api/binders/{id}` — Get binder details including page-by-page grid view data
- `POST /api/binders` — Create a binder
- `PUT /api/binders/{id}` — Update a binder
- `DELETE /api/binders/{id}` — Delete a binder (with option to cascade or orphan cards)

### Page Images

- `POST /api/pages/upload` — Upload a full binder page image (the 3x3 grid photo)
- `GET /api/pages/{binderNumber}/{pageNumber}` — Get all cards for a specific binder page

---

## Frontend Pages & Components

### 1. Dashboard / Home

- Collection summary stats: total cards, estimated total value range, cards by era/decade, top 10 most valuable cards
- Quick search bar (always visible in the nav bar)
- Recent additions

### 2. Collection Browser

- Card grid/list view with toggle
- Left sidebar with filters:
  - Binder number (dropdown)
  - Year range (slider or min/max inputs)
  - Set name (searchable dropdown, populated from existing data)
  - Team (searchable dropdown)
  - Condition range
  - Value range (slider)
  - Graded only toggle
  - Tags
- Sort by: player name, year, set, value (high/low), condition, date added, binder location
- Pagination
- Each card tile shows: thumbnail image (if available), player name, year + set, condition badge, value range, binder location (e.g., "B2 / P5 / R1-C3")

### 3. Binder View

- Visual representation of a binder page as a 3x3 grid
- Navigate between pages with prev/next arrows
- Click any cell to view/edit the card in that position
- Empty cells show "Add Card" placeholder
- Page-level stats: total page value, card count

### 4. Card Detail / Edit

- Full card information form
- Image upload with preview
- Condition selector with visual guide (show what each condition looks like)
- Value range inputs with currency formatting
- Binder location selector (binder → page → row → column)
- Validation: prevent duplicate binder locations (same binder + page + row + column)
- Save / Cancel / Delete actions

### 5. Bulk Entry Page

- Upload a binder page photo
- Set the binder number and page number
- Display a 3x3 grid form where each cell maps to a row/column position
- For each cell: player name, year, set name, card number, team, estimated condition, value range low, value range high, and notes
- "Save All" to bulk create all 9 cards at once
- Pre-populate binder, page, row, and column automatically based on grid position

### 6. Search Results

- Full-text search results with highlighted matching terms
- Same filtering and sorting as Collection Browser
- Group-by option (by set, by year, by binder)

---

## Search Implementation

Use PostgreSQL full-text search for the primary search functionality:

- Create a `tsvector` generated column combining: `PlayerName`, `SetName`, `Team`, `Manufacturer`, `Notes`, `Tags`
- Create a GIN index on the tsvector column
- Support both full-text search (for broad queries) and ILIKE patterns (for partial matching on specific fields)
- The search bar should use debounced input (300ms) and show results as the user types

---

## Key Business Rules

1. **Unique location constraint:** A database unique constraint on (BinderNumber, PageNumber, Row, Column) — no two cards can occupy the same physical slot
2. **Value ranges:** Always store as a range (low/high) since ungraded card values are inherently approximate
3. **Condition is an estimate:** Make it clear in the UI that condition is the owner's estimate unless IsGraded is true
4. **Images are optional:** Cards can be entered without photos
5. **Binder pages default to 3x3:** Standard 9-pocket pages, but the system should not hard-code this — Row and Column are just integers

---

## UI/UX Guidelines

- Clean, modern design — dark mode support preferred
- Use a card-collecting aesthetic but keep it professional (not cartoony)
- Responsive layout that works on desktop and tablet (photographing cards is often done on a phone, but management is typically desktop)
- Use toast notifications for save/delete confirmations
- Loading skeletons for image-heavy views
- Card thumbnails should lazy-load
- Use a consistent color scheme for condition badges:
  - Poor/Fair/Good: Red tones
  - VG/VGEX: Orange/Yellow tones
  - EX/EXMT: Yellow/Green tones
  - NM/NMMT: Green tones
  - Mint/Gem: Blue/Purple tones (premium feel)

---

## Project Structure Suggestion

```
baseball-card-manager/
├── docker-compose.yml          # PostgreSQL + optional app containers
├── backend/
│   ├── BaseballCards.Api/       # ASP.NET Core Web API project
│   │   ├── Controllers/
│   │   ├── Models/
│   │   ├── Data/                # DbContext, Migrations, Seed
│   │   ├── Services/
│   │   ├── DTOs/
│   │   └── Program.cs
│   └── BaseballCards.Api.sln
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/            # API client
│   │   ├── types/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
└── uploads/                     # Card images directory (volume-mounted)
```

---

## Getting Started Priorities

Build in this order:

1. **Database + EF Core migrations** — Get the schema created with the unique constraint and full-text search index
2. **CRUD API endpoints** — Cards and Binders with full search/filter support
3. **Collection Browser page** — Card list with search, filters, and sorting
4. **Card Detail / Edit page** — Full form with image upload
5. **Binder View page** — 3x3 grid visualization
6. **Bulk Entry page** — Multi-card entry from a page photo
7. **Dashboard** — Stats and summaries
8. **Polish** — Dark mode, responsive tweaks, loading states, error handling