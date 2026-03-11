---
name: add-migration
description: 'Create and apply Entity Framework Core database migrations. Use when adding new model properties, changing database schema, adding indexes, modifying relationships, or altering column types. Covers migration creation, review, application, and rollback for PostgreSQL with Npgsql.'
argument-hint: 'Describe the schema change, e.g. "Add IsActive boolean to Card model"'
---

# Add EF Core Migration

## When to Use
- Adding or removing properties on Card, Binder, or new entities
- Changing column types, precision, or nullability
- Adding or modifying indexes or constraints
- Adding new DbSet entries to AppDbContext

## Procedure

### 1. Make Model Changes
Edit entity files in `backend/TheDugout.Api/Models/`:
- `Card.cs` — 42+ properties including location, identity, condition, value, metadata
- `Binder.cs` — Name, Description, TotalPages, Cards navigation
- `CardCondition.cs` — Condition enum

### 2. Update AppDbContext (if needed)
Edit `backend/TheDugout.Api/Data/AppDbContext.cs`:
- Add new `DbSet<T>` properties
- Configure fluent API in `OnModelCreating` (indexes, constraints, precision, default values)
- The app uses filtered unique indexes and PostgreSQL-specific features (tsvector, GIN)

### 3. Update DTOs
Edit `backend/TheDugout.Api/DTOs/`:
- Add corresponding properties to DTOs (never expose entities directly)
- Update `CardDtos.cs`, `BinderDtos.cs`, or `AiDtos.cs` as appropriate
- Update mapping logic in the relevant Service class

### 4. Create the Migration
Run from the backend project directory:
```powershell
cd backend/TheDugout.Api
dotnet ef migrations add <MigrationName>
```

Naming convention: descriptive PascalCase (e.g., `AddIsUnassigned`, `AddCardTags`, `ChangeValuePrecision`)

### 5. Review the Migration
- Open the generated file in `backend/TheDugout.Api/Migrations/`
- Verify the `Up()` and `Down()` methods are correct
- Check for unintended changes (EF sometimes detects phantom diffs)
- Pay attention to PostgreSQL-specific syntax in the migration

### 6. Apply the Migration
The app auto-applies migrations on startup (`Program.cs` calls `Database.Migrate()`).
To apply manually:
```powershell
cd backend/TheDugout.Api
dotnet ef database update
```

### 7. Verify
```powershell
cd backend/TheDugout.Api
dotnet build
```

## Rollback
```powershell
# Revert to a specific migration
dotnet ef database update <PreviousMigrationName>

# Remove the last migration (if not applied)
dotnet ef migrations remove
```

## Key Constraints
- Connection string: `Host=localhost;Port=5432;Database=thedugout` (see `appsettings.json`)
- Docker must be running: `docker-compose up -d`
- File lock errors: run `Stop-Process -Name "TheDugout.Api"` before building
- Existing migrations: `InitialCreate`, `AddIsUnassigned`
