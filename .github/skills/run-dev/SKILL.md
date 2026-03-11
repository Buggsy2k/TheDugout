---
name: run-dev
description: 'Start, stop, or restart The Dugout development environment. Use when launching the app, restarting after changes, fixing build errors, starting Docker database, or checking service status. Covers PostgreSQL Docker container, ASP.NET Core backend, and Vite frontend.'
argument-hint: 'Action to perform, e.g. "start all", "restart backend", "fix build error"'
---

# Development Environment Management

## When to Use
- Starting the full development stack
- Restarting after code changes
- Fixing build or process errors
- Checking if services are running

## Quick Start (All Services)
```powershell
# From project root
.\restart-dev.ps1
```
This script stops all node/dotnet processes, builds both projects, and relaunches in new terminal windows.

## Individual Services

### Database (PostgreSQL)
```powershell
# Start
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs postgres

# Stop
docker-compose down

# Reset (destroys data)
docker-compose down -v
docker-compose up -d
```
- Port: 5432
- Database: thedugout
- Credentials: thedugout / DugoutDev2024!

### Backend (ASP.NET Core)
```powershell
cd backend/TheDugout.Api
dotnet run
```
- Port: 5137 (HTTP), 7175 (HTTPS)
- Swagger UI: http://localhost:5137/swagger
- Auto-applies pending EF migrations on startup

### Frontend (Vite + React)
```powershell
cd frontend
npm run dev
```
- Port: 5173
- URL: http://localhost:5173

## Common Build Fixes

### File Lock Error (MSB3027/MSB3021)
```powershell
Stop-Process -Name "TheDugout.Api" -ErrorAction SilentlyContinue
cd backend/TheDugout.Api
dotnet build
```

### Frontend Dependencies Missing
```powershell
cd frontend
npm install
```

### Database Connection Refused
```powershell
# Ensure Docker is running, then:
docker-compose up -d
# Wait for health check, then retry backend
```

### Port Already in Use
```powershell
# Find and kill process on port
Get-NetTCPConnection -LocalPort 5137 | Select-Object OwningProcess
Stop-Process -Id <PID>
```

## Service Health Check
```powershell
# Backend
Invoke-RestMethod http://localhost:5137/api/cards/stats

# Frontend (should return HTML)
Invoke-WebRequest http://localhost:5173 -UseBasicParsing | Select-Object StatusCode

# Database
docker-compose exec postgres pg_isready -U thedugout
```
