---
name: troubleshoot
description: 'Diagnose and fix common issues in The Dugout. Use when encountering build errors, runtime exceptions, database connection failures, API errors, frontend crashes, CORS issues, EF Core query translation errors, file lock errors, or Docker problems. Covers known issues and debugging strategies.'
argument-hint: 'Describe the error or symptom, e.g. "MSB3027 build error" or "CORS blocked"'
---

# Troubleshoot Common Issues

## When to Use
- Build fails with errors
- Runtime exceptions in backend or frontend
- Database connection or migration issues
- API calls failing or returning unexpected results
- UI not displaying correctly

## Known Issues & Fixes

### MSB3027 / MSB3021 File Lock Build Error
**Symptom**: `Could not copy`, `Could not delete` during `dotnet build`
**Cause**: Previous `dotnet run` process still holds file locks
**Fix**:
```powershell
Stop-Process -Name "TheDugout.Api" -ErrorAction SilentlyContinue
Stop-Process -Name "dotnet" -ErrorAction SilentlyContinue
cd backend/TheDugout.Api
dotnet build
```

### EF Core LINQ Translation Error
**Symptom**: `could not be translated` exception at runtime
**Cause**: Complex expressions in LINQ that PostgreSQL/Npgsql can't translate
**Fix**: Materialize the query with `ToListAsync()` first, then apply client-side logic.
**Example**: `string.Format()` or complex string operations must run after `ToListAsync()`.

### CORS Blocked
**Symptom**: Browser console shows `Access-Control-Allow-Origin` errors
**Cause**: Frontend URL not in CORS policy
**Fix**: Check `Program.cs` CORS configuration. Currently allows: `http://localhost:5173`, `http://localhost:3000`, `http://localhost:5137`

### Database Connection Refused
**Symptom**: `Npgsql.NpgsqlException: Failed to connect`
**Fix**:
```powershell
# 1. Check Docker is running
docker-compose ps
# 2. Start if not running
docker-compose up -d
# 3. Wait for health check
docker-compose logs postgres
# 4. Verify connection string in appsettings.json
```

### Migration Pending / Schema Mismatch
**Symptom**: `42P01: relation "Cards" does not exist` or similar
**Fix**: App auto-migrates on startup. If manual needed:
```powershell
cd backend/TheDugout.Api
dotnet ef database update
```

### Anthropic API Error
**Symptom**: AI scan returns null or 500
**Checks**:
1. Verify `Anthropic:ApiKey` in `appsettings.json` is set (not placeholder)
2. Check model constant is valid (`AnthropicModels.Claude4Sonnet`)
3. Verify image file size under 20MB limit
4. Check Anthropic API status

### Frontend TypeScript Errors
**Symptom**: `tsc --noEmit` fails
**Fix**:
```powershell
cd frontend
npx tsc --noEmit
# Read error output — usually missing type in types/index.ts
# or mismatched API response shape
```

### Image Upload Fails
**Symptom**: 400 or 500 on image upload
**Checks**:
1. File extension must be: .jpg, .jpeg, .png, .gif, .webp
2. File size must be under 10MB (card upload) or 20MB (AI scan)
3. `uploads/` directory must exist in `backend/TheDugout.Api/`

### Unique Constraint Violation on Card Save
**Symptom**: `duplicate key value violates unique constraint "IX_Card_Location"`
**Cause**: Trying to save a card to an already-occupied slot
**Fix**: Use conflict check endpoints before saving:
- `GET /api/cards/check-slot-conflict?binderNumber=X&pageNumber=Y&row=Z&column=W`
- `POST /api/cards/unassign` to free occupied slots
- The `ConflictOverwriteDialog` component handles this flow in the UI

## Debugging Strategy

### Backend
1. Check Swagger UI: http://localhost:5137/swagger
2. Test endpoints directly in Swagger
3. Check `dotnet run` terminal for exception output
4. Add breakpoints in VS Code or Visual Studio

### Frontend
1. Browser DevTools Console for errors
2. Network tab for API call failures
3. React DevTools for component state
4. `npm run dev` terminal for Vite build errors

### Database
```powershell
# Connect to PostgreSQL directly
docker-compose exec postgres psql -U thedugout -d thedugout

# Useful queries
SELECT count(*) FROM "Cards";
SELECT * FROM "Cards" WHERE "IsUnassigned" = true;
SELECT * FROM "__EFMigrationsHistory";
```
