# The Dugout — Baseball Card Collection Manager

A full-stack baseball card collection management application built with ASP.NET Core and React.

## Tech Stack

- **Backend:** C# / ASP.NET Core 8 Web API
- **Frontend:** React + TypeScript (Vite)
- **Database:** PostgreSQL 16
- **ORM:** Entity Framework Core with Npgsql

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js 18+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for PostgreSQL)

## Getting Started

### 1. Start PostgreSQL

```bash
docker-compose up -d
```

### 2. Run the Backend

```bash
cd backend/TheDugout.Api
dotnet run
```

The API will be available at `http://localhost:5137` with Swagger at `http://localhost:5137/swagger`.

### 3. Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

## Project Structure

```
TheDugout/
├── docker-compose.yml              # PostgreSQL container
├── backend/
│   ├── TheDugout.sln
│   └── TheDugout.Api/
│       ├── Controllers/             # API endpoints
│       ├── Models/                  # Entity models
│       ├── Data/                    # DbContext & migrations
│       ├── DTOs/                    # Data transfer objects
│       ├── Services/                # Business logic
│       └── Program.cs               # App configuration
├── frontend/
│   ├── src/
│   │   ├── components/              # Reusable UI components
│   │   ├── pages/                   # Page components
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── services/                # API client
│   │   ├── types/                   # TypeScript types
│   │   └── main.tsx                 # App entry point
│   └── package.json
└── uploads/                         # Card images (created at runtime)
```

## Features

- **Dashboard** — Collection stats, value summaries, cards by decade/condition
- **Collection Browser** — Search, filter, sort, and browse cards in grid or list view
- **Binder View** — Visual 3×3 grid representation of binder pages
- **Card Detail** — Full card information with image upload
- **Bulk Entry** — Enter up to 9 cards at once from a binder page
- **Binder Management** — Create and organize binders

## API Endpoints

### Cards
- `GET /api/cards` — Search/list with pagination and filters
- `GET /api/cards/{id}` — Get card details
- `POST /api/cards` — Create card
- `PUT /api/cards/{id}` — Update card
- `DELETE /api/cards/{id}` — Delete card
- `POST /api/cards/upload-image/{id}` — Upload card image
- `POST /api/cards/bulk` — Bulk create cards
- `GET /api/cards/stats` — Collection statistics

### Binders
- `GET /api/binders` — List binders
- `GET /api/binders/{id}` — Get binder with cards
- `POST /api/binders` — Create binder
- `PUT /api/binders/{id}` — Update binder
- `DELETE /api/binders/{id}` — Delete binder

### Pages
- `GET /api/pages/{binderNumber}/{pageNumber}` — Get cards on a page
- `POST /api/pages/upload` — Upload page image
