---
description: "Use when writing or modifying C# backend code for The Dugout API. Covers ASP.NET Core 8 patterns, EF Core with PostgreSQL/Npgsql, service layer conventions, and DTO mapping."
applyTo: "backend/**/*.cs"
---

# C# Backend Conventions

## Service Pattern
- Services receive `AppDbContext` via constructor injection
- All data access methods are `async Task<T>` using `await`
- Map between EF entities and DTOs within service methods
- Register services in `Program.cs` with `AddScoped<T>()`

## Controller Pattern
- Attribute routing: `[ApiController]`, `[Route("api/[controller]")]`
- Return `ActionResult<T>` from all actions
- Delegate ALL logic to services — no business logic in controllers
- Validate file uploads (extension whitelist, size limits)

## Entity / DTO Separation
- Never return EF entities from API endpoints
- DTOs in `DTOs/` folder, entities in `Models/` folder
- Create separate Create/Update/Response DTOs

## EF Core / PostgreSQL
- Full-text search via `NpgsqlTsVector` + GIN index on Card
- Decimal precision: `HasPrecision(10, 2)` for monetary values
- Filtered unique index: WHERE clause to exclude soft-deleted/unassigned records
- Complex string operations must run client-side after `ToListAsync()`

## Naming
- PascalCase for all public members
- DTOs: `CreateXDto`, `UpdateXDto`, `XDto`, `XDetailDto`, `XQueryParams`
- Services: `XService` with interface-free DI (concrete registration)
