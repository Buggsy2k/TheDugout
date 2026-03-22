# The Dugout — Viewer

Read-only viewer for The Dugout baseball card collection, designed to run on a Synology NAS via Docker.

## Features
- **Dashboard**: Collection stats (card count, sets, decades, conditions)
- **Collection Browser**: Search, filter, sort cards (grid or list view)
- **Binder View**: Browse binder pages with 3×3 card grid, flip to back images
- **Card Detail**: View card info, images (front/back), condition, tags

No editing, no card values, no AI features — purely a read-only viewer.

## Architecture
- **Frontend**: React 19 + TypeScript + Vite → served by Nginx
- **Backend**: ASP.NET Core 8 (read-only API, GET endpoints only)
- **Database**: PostgreSQL 16 (synced from the main development database)

## Deployment (Docker Compose)

```bash
# On the Synology, clone/copy the viewer/ directory, then:
docker compose up -d --build
```

The app will be available on port 80. Configure your reverse proxy (Synology's built-in or Nginx Proxy Manager) to point `thedugout.once-a-knight.com` to this container.

## Data Sync

Run from your development machine to push database + images to the Synology:

```powershell
cd viewer
.\sync-data.ps1 -SynologyHost "your-synology-ip" -SynologyUser "brian"
```

### What it syncs:
1. **Database**: `pg_dump` from local → `psql` restore on Synology's PostgreSQL container
2. **Images**: `rsync` (or `scp` fallback) of the `uploads/` directory

### Prerequisites:
- Local PostgreSQL running (via main project's `docker-compose up -d`)
- SSH access to Synology configured (key-based auth recommended)
- `pg_dump` available locally (comes with PostgreSQL)

## Configuration

### Environment Variables (docker-compose.yml)
| Variable | Default | Description |
|----------|---------|-------------|
| `ConnectionStrings__DefaultConnection` | See compose file | PostgreSQL connection string |
| `UploadsPath` | `/app/uploads` | Path to card/page images inside container |

### Frontend API Base
In Docker, the Nginx config proxies `/api/` and `/uploads/` to the backend container, so no explicit API base URL is needed.

For local development: `VITE_API_BASE=http://localhost:8080`

## Local Development

```bash
# Terminal 1: Database
docker compose up db -d

# Terminal 2: Backend
cd backend/TheDugoutViewer.Api
# Update appsettings.json to use Host=localhost;Port=5433
dotnet run

# Terminal 3: Frontend
cd frontend
npm install
npm run dev
```
