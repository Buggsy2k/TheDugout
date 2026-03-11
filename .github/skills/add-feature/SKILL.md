---
name: add-feature
description: 'Add a new full-stack feature to The Dugout. Use when implementing new API endpoints, new React pages, new UI components, new service methods, or extending existing CRUD operations. Covers the backend-to-frontend workflow including model, DTO, service, controller, API client, types, and React component creation.'
argument-hint: 'Describe the feature, e.g. "Add wishlist tracking for cards"'
---

# Add Full-Stack Feature

## When to Use
- Adding new API endpoints with corresponding frontend pages
- Extending existing entities with new behavior
- Adding new React pages or components with API integration
- Creating new service layer logic

## Procedure

### 1. Backend: Model (if needed)
Add or modify entities in `backend/TheDugout.Api/Models/`:
- Follow existing patterns in `Card.cs` and `Binder.cs`
- Add navigation properties for relationships
- Add to `AppDbContext.cs` DbSet and configure in `OnModelCreating`
- Create a migration (see `/add-migration` skill)

### 2. Backend: DTOs
Create or update DTOs in `backend/TheDugout.Api/DTOs/`:
- Request DTOs: `Create<Entity>Dto`, `Update<Entity>Dto`
- Response DTOs: `<Entity>Dto`, `<Entity>DetailDto`
- Query DTOs: `<Entity>QueryParams` (for filtering/pagination)
- Never expose EF entities directly in API responses

### 3. Backend: Service
Create or update service in `backend/TheDugout.Api/Services/`:
- Constructor-inject `AppDbContext`
- Use `async/await` throughout
- Map between entities and DTOs within service methods
- Follow patterns in `CardService.cs` (query building, pagination, full-text search)
- Register in `Program.cs`: `builder.Services.AddScoped<NewService>()`

### 4. Backend: Controller
Create or update controller in `backend/TheDugout.Api/Controllers/`:
- `[ApiController]` + `[Route("api/[controller]")]`
- Constructor-inject the service
- Return `ActionResult<T>` from all methods
- Delegate all logic to services — no business logic in controllers
- Follow patterns in `CardsController.cs`

### 5. Frontend: Types
Add interfaces to `frontend/src/types/index.ts`:
- Match DTO shapes from the backend (camelCase)
- Include all request/response types

### 6. Frontend: API Client
Add API methods to `frontend/src/services/api.ts`:
- Create a new namespace object (e.g., `export const newFeatureApi = { ... }`)
- Use the shared `api` Axios instance (base URL: `http://localhost:5137/api`)
- Follow existing patterns: `cardApi`, `binderApi`, `pageApi`, `aiApi`

### 7. Frontend: React Component
Create page in `frontend/src/pages/` or component in `frontend/src/components/`:
- Functional component with hooks (`useState`, `useEffect`, `useCallback`)
- Call API via the service namespace from `api.ts`
- Toast notifications via `react-hot-toast` (`toast.success()`, `toast.error()`)
- Icons from `lucide-react`
- Loading states with `LoadingSkeleton` component

### 8. Frontend: Routing (if new page)
Add route in `frontend/src/main.tsx`:
```tsx
<Route path="/new-path" element={<NewPage />} />
```
Add navigation link in `frontend/src/components/Layout.tsx` if needed.

### 9. Verify
```powershell
# Backend
cd backend/TheDugout.Api
dotnet build

# Frontend
cd frontend
npx tsc --noEmit
```

## Architecture Reminders
- Backend port: 5137, Frontend port: 5173
- CORS configured for localhost:5173, localhost:3000, localhost:5137
- Image uploads go to `backend/TheDugout.Api/uploads/`
- PostgreSQL full-text search via tsvector + GIN index
- Card location: (BinderNumber, PageNumber, Row, Column), 1-based
