---
description: "Use when writing or modifying React/TypeScript frontend code for The Dugout. Covers component patterns, API integration, routing, state management, and UI library usage."
applyTo: "frontend/src/**/*.{ts,tsx}"
---

# React/TypeScript Frontend Conventions

## Component Pattern
- Functional components with hooks (`useState`, `useEffect`, `useCallback`)
- Pages in `src/pages/`, shared UI in `src/components/`
- Loading states via `LoadingSkeleton` component
- Error handling with `react-hot-toast`: `toast.success()`, `toast.error()`

## API Integration
- All API calls through `src/services/api.ts` namespaces
- Namespaces: `cardApi`, `binderApi`, `pageApi`, `aiApi`
- Base URL: `http://localhost:5137/api` (Axios instance)
- Response types defined in `src/types/index.ts`

## State & Types
- All interfaces in `src/types/index.ts` (single source of truth)
- Match backend DTO shapes with camelCase property names
- Helper functions in types file: `getConditionInfo()`, `formatCurrency()`, `formatValueRange()`

## Routing
- `react-router-dom` v7 configured in `src/main.tsx`
- Use `useParams()`, `useNavigate()`, `useSearchParams()` hooks
- Add new routes inside the `<Layout>` wrapper route

## UI Libraries
- Icons: `lucide-react` (import specific icons)
- Toasts: `react-hot-toast`
- No CSS framework — custom styles in `src/style.css`

## Card Data Patterns
- Location: `binderNumber`, `pageNumber`, `row`, `column` (1-based)
- Condition codes: PR, FR, GD, VG, VGEX, EX, EXMT, NM, NMMT, MT, GEM
- Values: `valueRangeLow` / `valueRangeHigh` (USD decimals)
- AI results populate forms via `CardIdentificationResult` / `PageIdentificationResult`
