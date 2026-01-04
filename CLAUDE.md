# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

INDUSIA AI HMI is a visual inspection manufacturing system built with Next.js and Supabase. It provides an end-to-end platform for managing AI-powered PCB inspections across operator HMI, manager console, engineering tools, and admin panels.

## Development Commands

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Lint code
npm run lint

# Type checking
npm run typecheck

# Unit tests (Jest)
npm test                  # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report

# E2E tests (Playwright)
npm run test:e2e          # Headless
npm run test:e2e:headed   # With browser
npm run test:e2e:ui       # Interactive UI mode
```

## Architecture

### Next.js App Router Structure

The app uses Next.js 13.5 with App Router. Pages are in `app/` with the following main routes:
- `/inspection/operator` - Fullscreen operator HMI with board selector
- `/inspection/result/[id]` - Operator HMI for inspection results
- `/inspection/overrides` - Manager review queue for false call overrides
- `/engineering/master-data` - Engineering console for dataset/model management
- `/super-admin/*` - Admin panel for users, roles, permissions
- `/event-log` - System event tracking
- `/settings/sync` - Sync configuration

### Context Architecture

The app uses a nested context provider pattern in `app/layout-client.jsx`:

```
AuthProvider (outermost)
  └─ I18nProvider
      └─ HelpOverlayProvider
          └─ NotificationProvider
              └─ SystemHealthProvider (innermost)
```

All contexts are client-side only. The root layout (`app/layout.js`) wraps everything in `ToastProvider` and `LayoutClient`.

**Authentication Flow**: `AuthContext` stores user in localStorage as `indusia_user`. The `LayoutClient` redirects unauthenticated users to `/login`. Auth is currently mock-based and will be migrated to Supabase Auth.

### Role-Based Access Control (RBAC)

User roles are: `operator`, `manager`, `engineer`, `superadmin`

Navigation items in `SideNav.jsx` are filtered by role. Each route should check `user.role` for authorization. Use the `useAuth()` hook which provides:
- `user` - Current user object
- `isSuperAdmin` - Boolean helper
- `loginWithProfile()`, `logout()`, `updateSelections()`, `updateSelectedBoard()`

### Component Organization

- `components/ui/` - shadcn/ui primitives (Radix UI + Tailwind)
- `components/common/` - Reusable UI components (Card, Badge, StatusBadge, EmptyState, etc.)
- `components/layout/` - SideNav, TopNav
- `components/system/` - SystemHealthBar, SystemStatusChip, SystemStatusDetailsModal
- `components/notifications/` - NotificationBell, NotificationDrawer, NotificationFilters
- `components/inspection/` - FalseCallOverrideModal, OverrideReviewModal, HMIOperatorView, HMIActionPanel, HMITimer, DetectionOverlay, LiveView, LiveViewV3, InspectionStage, InspectionResult, SidePanel, AIDecisionPanel
- `components/sync/` - Sync progress and queue components
- `components/event-log/` - Event log table and filters
- `components/help/` - HelpOverlay system with context-aware shortcuts

### Styling System

Uses Tailwind CSS with custom INDUSIA design tokens in `tailwind.config.js`:

```js
indusia: {
  bg: '#0A1628',           // Main background
  surface: '#1A2942',      // Card/panel background
  surfaceMuted: '#152033', // Subtle backgrounds
  primary: '#0FB5BA',      // Primary actions/highlights
  text: '#E8EDF2',         // Main text
  textMuted: '#8A95A8',    // Secondary text
  pass: '#10B981',         // Success/pass status
  fail: '#EF4444',         // Error/fail status
  warning: '#F59E0B',      // Warning status
  border: '#2D3E56',       // Borders
}
```

Use these color tokens instead of arbitrary colors to maintain design consistency.

### Data Layer Architecture

The app uses a three-tier data architecture:

```
Hooks (hooks/) → API Routes (app/api/) → Repositories (lib/repos/) → Supabase
```

**Repository Layer** (`lib/repos/`):
- Direct Supabase queries with error handling
- Case conversion utilities: `toCamelCase()`, `toSnakeCase()` in `lib/repos/index.js`
- Key repos: `overridesRepo`, `usersRepo`, `rolesRepo`, `masterDataRepo`, `notificationsRepo`, `modelsRepo`, `eventLogRepo`, `dashboardRepo`, `inspectionFramesRepo`

**API Routes** (`app/api/`):
- RESTful endpoints with authentication/authorization via `withAuth()` middleware
- Input validation using Zod schemas from `lib/validations/schemas.js`
- Section-based access control via `lib/auth/sectionAccess.js`
- Input sanitization via `lib/utils/sanitize.js`

**Mock Data** (`data/`):
- `data/masterData.js` - Customers, sections, lines, boards (fallback/seed data)
- `data/mockEvents.js` - Event log samples
- `data/mockNotifications.js` - Notification samples

### System Health Monitoring

`SystemHealthContext` provides real-time system status monitoring with these components:
- `aiModel` - AI model status and performance
- `camera` - Camera connectivity
- `cloud` - Cloud service connectivity
- `lineRuntime` - Production line status
- `lastSync` - Last sync operation status

States: `ok`, `warning`, `error`, `offline`, `degraded`, `unknown`, `in-progress`

The context auto-refreshes every 15 seconds and simulates random state changes for demo purposes. Remove the simulation logic when integrating with real system health APIs.

### Event Log System

Event logs track all system activities. Use the `useEventLog` hook which provides filtering, pagination, and CSV export. Event types include: `login`, `logout`, `override_submit`, `override_review`, `sync_start`, `sync_complete`, `training_start`, etc.

### Notifications System

`NotificationContext` manages in-app notifications. Notifications have:
- `type`: system, workflow, or alert
- `severity`: info, warning, error, success
- `category`: override, sync, training, system, etc.

Use `addNotification()` to create new notifications. The NotificationBell shows unread count and opens NotificationDrawer.

### Help Overlay System

`HelpOverlayContext` provides context-aware help overlays. Contexts are: `Global`, `HMI`, `Manager`, `Engineer`, `SuperAdmin`. The system automatically determines context from pathname in `layout-client.jsx`.

Press `?` to toggle help overlay on any page.

### Internationalization (i18n)

Use the `useI18n` hook for translations:

```jsx
const { t, language, setLanguage } = useI18n();
<h1>{t('nav.dashboard')}</h1>
```

Translation files are in `i18n/en.json` and `i18n/id.json`. Always add keys to both files when adding new translatable strings.

### Import Aliases

The project uses `@/` as a path alias mapping to the project root:

```js
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/button';
import { cn } from '@/lib/utils';
```

## Working with shadcn/ui Components

The project uses shadcn/ui built on Radix UI primitives. Components are in `components/ui/`. Configuration is in `components.json`.

To add new shadcn/ui components, they should be manually copied to `components/ui/` or use the shadcn CLI if available.

Always use the `cn()` utility from `@/lib/utils` for conditional className merging.

## TypeScript and JavaScript Mix

The codebase mixes TypeScript (.ts, .tsx) and JavaScript (.js, .jsx):
- UI components in `components/ui/` are TypeScript
- Most app pages and contexts are JavaScript
- Hooks are JavaScript

TypeScript errors are currently ignored during builds (`ignoreBuildErrors: true` in `next.config.js`). When adding new TypeScript files, ensure proper typing even though errors won't block builds.

## Testing

**Unit Tests (Jest)**:
- Tests in `__tests__/` directories or `*.test.js` files
- Setup in `jest.setup.js`, config in `jest.config.js`
- Run single test: `npm test -- path/to/test.test.js`
- Coverage collected from: `lib/`, `hooks/`, `components/`, `context/`, `app/api/`

**E2E Tests (Playwright)**:
- Tests in `e2e/` directory
- Config in `playwright.config.js`
- Auto-starts dev server before tests
- Reports generated in `playwright-report/`

## Environment Setup

Required environment variables (create `.env`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Key Implementation Patterns

### Override Workflow

False call overrides follow this flow:
1. Operator submits override via `FalseCallOverrideModal` (status: `pending`)
2. Manager reviews in `/inspection/overrides` using `OverrideReviewModal`
3. Manager approves or rejects (status: `approved` or `rejected`)
4. System creates event log entry and notification

### Modal Patterns

Modals use shadcn/ui Dialog component. Common pattern:

```jsx
const [isOpen, setIsOpen] = useState(false);

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    {/* Modal content */}
  </DialogContent>
</Dialog>
```

### Toast Notifications

Use the custom `useToast` hook:

```jsx
const { showToast } = useToast();
showToast('Operation completed successfully');
```

### API Route Patterns

API routes use a consistent pattern with auth middleware and Zod validation:

```js
import { withAuth } from '@/lib/auth/apiAuth'
import { validate, validationErrorResponse } from '@/lib/validations/validate'
import { createOverrideSchema } from '@/lib/validations/schemas'
import { sanitizeRequestBody } from '@/lib/utils/sanitize'

async function handlePOST(request) {
  const body = await request.json()
  const sanitizedBody = sanitizeRequestBody(body)

  const validation = validate(createOverrideSchema, sanitizedBody)
  if (!validation.success) {
    return validationErrorResponse(validation.errors)
  }

  // request.user is attached by withAuth middleware
  const result = await someRepo.create(validation.data)
  return NextResponse.json({ success: true, data: result.data })
}

// Wrap handler with auth + permission check
export const POST = withAuth('overrides:create')(handlePOST)
```

Permission strings follow the format `resource:action` (e.g., `users:read`, `overrides:create`).

## Database Schema Notes

The full schema is in `indusia_schema_v1.md`. Key tables:
- `users`, `roles`, `role_menu_permissions` - RBAC
- `customers`, `sections`, `lines`, `boards` - Master data hierarchy
- `overrides` - False call override submissions
- `notifications`, `event_log` - Activity tracking
- `system_events` - System health events

When implementing Supabase queries, use Row Level Security (RLS) policies based on user roles.

## Phase Execution Workflow

### Implementation Prompts

Detailed implementation prompts are stored in `.claude/prompts/` directory:

| Phase | File | Description |
|-------|------|-------------|
| 1 | `phase-1-dashboard-backend.md` | Dashboard KPIs backend (repos + APIs) |
| 2 | `phase-2-dashboard-frontend.md` | Dashboard frontend (charts + components) |
| 3 | `phase-3-override-annotation.md` | Override annotation canvas |
| 4 | `phase-4-live-inspection.md` | Live inspection SSE + overlay |
| 5 | `phase-5-operator-page.md` | HMI Operator page route + board selector |
| 6 | `phase-6-inspection-api.md` | Inspection action API + DB schema |
| 7 | `phase-7-ai-backend-auth.md` | AI Backend auth & API structure |
| 8 | `phase-8-training-repos.md` | Training pipeline repositories |
| 9 | `phase-9-ai-api-core.md` | Core AI API endpoints |
| 11 | `phase-11-ai-api-training.md` | Training pipeline API endpoints |
| 12 | `phase-12-sse-consumer.md` | SSE consumer & AI Backend client |
| 13 | `phase-13-wo-hardening.md` | Work Order flow hardening |
| 14 | `phase-14-validation-db.md` | Zod validation schemas & DB migrations |

### Post-Phase Checklist

**IMPORTANT:** After completing each phase, ALWAYS perform these steps:

1. **Update README.md** — Add/update relevant sections:
   - New features implemented
   - New API endpoints
   - New components created
   - Database changes
   - Configuration changes

2. **Update this section** — Mark phase as completed:
   ```
   | Phase | Status | Completed Date |
   |-------|--------|----------------|
   | 1 | ✅ Done | 2025-01-XX |
   ```

3. **Commit changes** — Include both code and documentation:
   ```bash
   git add .
   git commit -m "feat: complete phase-X - [brief description]"
   ```

### Phase Completion Status

| Phase | Status | Completed | Notes |
|-------|--------|-----------|-------|
| 1 | ✅ Done | - | Dashboard backend |
| 2 | ✅ Done | - | Dashboard frontend |
| 3 | ✅ Done | - | Override annotation |
| 4 | ✅ Done | - | Live inspection |
| 5 | ✅ Done | 2026-01-01 | Operator page route |
| 6 | ✅ Done | 2026-01-01 | Inspection API |
| 7 | ✅ Done | 2026-01-04 | AI Backend auth |
| 8 | ✅ Done | 2026-01-04 | Training repos |
| 9 | ✅ Done | 2026-01-04 | Core AI APIs |
| 11 | ✅ Done | 2026-01-04 | Training pipeline APIs |
| 12 | ✅ Done | 2026-01-04 | SSE consumer & client |
| 13 | ✅ Done | 2026-01-04 | Work Order flow hardening |
| 14 | ✅ Done | 2026-01-04 | Zod validation schemas & DB migrations |
| 15 | ✅ Done | 2026-01-04 | HMI LiveView rework (dual view) |

### Codebase Cleanup (2026-01-04)

Major cleanup performed to improve code quality:

**Files Deleted:**
- Unused hooks: `useMockSyncJob.jsx`, `useRealtime.js`, `use-toast.ts`
- Unused utilities: `apiErrorHandler.js`, `edgeSync.js`, `rateLimit.js`
- Unused repos: `shiftConfigRepo.js`
- Legacy: `LiveViewV2.jsx`, `README-NEW.md`, `.bolt/` directory
- Duplicate APIs: `/api/defect-classes`, `/api/models` (keeping `/api/ai/*` versions)
- Archive: `.claude/prompts/archive-training-platform/`
- Test endpoint: `/api/test`

**New Utilities Created:**
- `lib/utils/roleUtils.js` - Centralized role normalization
- `data/mockUsers.js` - Shared mock user data

**Codebase Quality Score: 7.2/10**

### README Update Template

When updating README.md after a phase, include:

```markdown
## Recent Updates

### Phase X: [Phase Name] (YYYY-MM-DD)

**New Features:**
- Feature 1
- Feature 2

**New API Endpoints:**
- `POST /api/xxx` - Description
- `GET /api/xxx` - Description

**New Components:**
- `ComponentName.jsx` - Description

**Database Changes:**
- New table: `table_name`
- New column: `table.column`
```

---

## Future Integrations

Completed:
- ✅ Repository layer (`lib/repos/`)
- ✅ API routes (`app/api/`)
- ✅ Zod validation layer (`lib/validations/`)
- ✅ API authentication/authorization (`lib/auth/`)
- ✅ Input sanitization (`lib/utils/sanitize.js`)

In progress:
- Supabase Auth migration (currently using mock auth with x-user-id header)
- Dashboard analytics and live inspection views

Planned:
- FastAPI microservice for AI training (separate repo)
- Modal.com integration for ML workflows
- Semantic search with pgvector for override embeddings
- AI Assistant with RAG using `kb_articles` table
