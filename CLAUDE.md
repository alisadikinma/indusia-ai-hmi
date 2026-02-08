# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

INDUSIA AI HMI is a visual inspection manufacturing system built with Next.js and Supabase. It provides an end-to-end platform for managing AI-powered PCB inspections across operator HMI, manager console, engineering tools, and admin panels.

## Development Commands

```bash
# Development server
npm run dev                   # Next.js dev server on port 3000

# Setup Swagger UI (run once after npm install)
npm run setup:swagger         # Copies swagger-ui-dist files to public/docs
                              # Enables /docs API documentation endpoint

# Full stack development (requires PostgREST)
npm run dev:all               # Runs PostgreSQL + PostgREST + Next.js concurrently
                              # Requires: postgrest.exe and postgrest.conf configured
                              # See scripts in package.json for paths

# Build for production
npm run build                 # Creates optimized production build
                              # Note: TypeScript/ESLint errors won't block build

# Start production server
npm run start                 # Runs production build (requires npm run build first)

# Code quality
npm run lint                  # ESLint check for code quality issues
npm run typecheck             # TypeScript validation (errors won't block build)

# Unit tests (Jest)
npm test                      # Run all tests once
npm run test:watch            # Watch mode for test-driven development
npm run test:coverage         # Generate coverage report in coverage/

# E2E tests (Playwright)
npm run test:e2e              # Headless browser tests (CI mode)
npm run test:e2e:headed       # Run with visible browser for debugging
npm run test:e2e:ui           # Interactive Playwright UI mode
```

## Quick Start

### Test Credentials

```
Email: operator@indusia.com
Password: operator123

Other accounts: manager@indusia.com, engineer@indusia.com, admin@indusia.com
All passwords: {role}123
```

### Multi-Service Startup & Shutdown

The HMI requires three services. Start them in this order (dependencies first):

#### Starting Services

```bash
# Terminal 1 - PostgREST (Database API) - MUST start first
cd "D:/Projects/Tools/postgrest"
postgrest.exe postgrest.conf
# Runs on port 3001 - provides REST API over local PostgreSQL

# Terminal 2 - Auto Inspect Edge (AI Backend)
cd "D:/Projects/indusia-ai-backend"
python -m auto_inspect_edge.main
# Runs on port 8002 - AI inference, camera, PLC, SSE streams

# Terminal 3 - Next.js HMI (Frontend) - MUST start last
cd "D:/Projects/indusia-ai-hmi"
npm run dev
# Runs on port 3000 - web UI for operator/manager/engineer
```

#### Stopping Services

```bash
# Stop in reverse order (frontend first, database last)

# Terminal 3 - Next.js: Press Ctrl+C in the terminal
# Terminal 2 - Auto Inspect Edge: Press Ctrl+C in the terminal
# Terminal 1 - PostgREST: Press Ctrl+C in the terminal

# If a port is stuck (process didn't exit cleanly):
npx kill-port 3000          # Kill Next.js
npx kill-port 8002          # Kill AI Backend
npx kill-port 3001          # Kill PostgREST

# Windows: Find and kill by port
netstat -ano | findstr ":3000"    # Find PID
taskkill /PID <pid> /F            # Force kill
```

#### Health Checks

```bash
curl http://localhost:3001/           # PostgREST - should return JSON schema
curl http://localhost:8002/health     # Auto Inspect Edge - should return {"status":"ok"}
curl http://localhost:3000            # Next.js HMI - should return HTML
```

#### Quick Restart (All Services)

```bash
# Kill all three ports and restart
npx kill-port 3000 3001 8002

# Then start again in order: PostgREST → AI Backend → Next.js
```

**Access:** http://localhost:3000/login

## Architecture

### Next.js App Router Structure

The app uses Next.js 13.5 with App Router. Pages are in `app/` with the following main routes:
- `/dashboard` - Dashboard with KPIs and analytics
- `/inspection/select-line` - Line and model selection before inspection
- `/inspection/live/[lineId]` - Live inspection view (operator + manager)
- `/inspection/result/[id]` - Inspection result details
- `/inspection/overrides` - Manager review queue for false call overrides
- `/engineering/master-data` - Engineering console for dataset/model management
- `/engineering/work-orders` - Work order management
- `/super-admin/*` - Admin panel for users, roles, permissions
- `/event-log` - System event tracking
- `/settings/sync` - Sync configuration
- `/settings/false-call-reasons` - False call reason configuration

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
- `components/dashboard/` - Dashboard KPI widgets and charts
- `components/override/` - Override-specific components
- `components/work-orders/` - Work order management components
- `components/sync/` - Sync progress and queue components
- `components/event-log/` - Event log table and filters
- `components/help/` - HelpOverlay system with context-aware shortcuts

### Styling System

Uses Tailwind CSS with a **Phosphor/Terminal** design system in `tailwind.config.js`.

**Fonts:** Barlow (sans), Barlow Condensed (display), JetBrains Mono (mono)

**Primary color systems** (prefer these for new code):

```js
// Phosphor accents
phosphor: {
  amber: '#FFAA00',         // Primary actions, highlights, warnings
  'amber-bright': '#FFD93D', 'amber-dim': '#CC8800',
  green: '#00FF66',          // Success/pass
  'green-bright': '#66FFAA', 'green-dim': '#00CC52',
  red: '#FF4444',            // Error/fail
  'red-bright': '#FF6B6B',
  cyan: '#00DDFF',           // Info/links
  'cyan-dim': '#0099BB',
}

// Backgrounds (dark-to-light)
void: '#050608',             // Deepest background
terminal: '#0A0E14',        // Main app background
panel: '#0D1117',           // Card/panel background
elevated: '#161B22',        // Elevated surfaces
'surface-border': '#21262D', // Borders

// Text hierarchy
'text-primary': '#E6EDF3',  // Main text
'text-secondary': '#8B949E', // Secondary text
'text-tertiary': '#484F58',  // Muted text
```

**Legacy `indusia.*` tokens** exist for backwards compatibility but map to the new Phosphor values. Use the Phosphor system for new code.

**Glow effects:** `shadow-glow-amber`, `shadow-glow-green`, `shadow-glow-red`, `shadow-glow-cyan`

**Animations:** `animate-pulse-glow`, `animate-flicker`, `animate-scan`, `animate-typing-cursor`, `animate-fade-in`, `animate-slide-up`

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

### AI Backend Communication Architecture

**Integration Status (2026-02-04):** Fully migrated to Auto Inspect Edge API. Mock Server is deprecated and no longer used.

The system uses Auto Inspect Edge as the primary AI Backend. AI Engine (port 8001) is available as an additional service:

#### 1. Auto Inspect Edge (Production API - Port 8002)

**Python-based AI inference server:**
- Deep learning models for PCB defect detection
- 4 separate SSE streams for real-time updates:
  - `/api/model/events/inspection` - Final inspection results
  - `/api/model/events/motion_stages` - Conveyor movement stages
  - `/api/model/events/vision_stages` - Camera capture & AI processing
  - `/api/model/events/device_status` - Hardware status (cameras, PLCs)
- Model management: `/api/model/list`, `/api/model/select/{model_name}`
- Stages endpoint: `/api/model/stages`
- Runs on port 8002

**Dummy Camera for Testing:**
- Auto Inspect Edge can run without physical Hikrobot cameras using dummy camera mode
- Set `AI_EDGE_DEBUG_CAMERA=true` in `D:/Projects/indusia-ai-backend/.env`
- Creates virtual camera with generated test images
- Patched files: `auto_inspect_edge/core/hardware_manager.py`, `auto_inspect_edge/services/camera/dummy_camera.py`

#### 2. AI Engine (Port 8001)

**FastAPI AI Engine server:**
- Simpler API format for rapid prototyping
- Single SSE endpoint: `/sse/{line_id}`
- Events: `inspection`, `hardware_status`, `running_status`, `session_update`
- Session-based control: `/session/start`, `/session/run`
- Runs on port 8001

**Next.js HMI (this repository):**
- Frontend UI (React components)
- API routes (`app/api/`) for auth, CRUD operations, business logic
- SSE consumer in `lib/services/aiBackendService.js` (Auto Inspect Edge format)
- Legacy backup: `lib/services/aiBackendService.js.backup-mock` (deprecated Mock Server format)
- Proxy endpoints in `/app/api/ai/*` that forward to AI Backend

**Communication Flow:**
```
[Browser Client]
    ↕ React Components
[Next.js Frontend]
    ↕ API Routes (/app/api/)
[Supabase Edge DB] ←→ [Repository Layer]

[Next.js API Routes] (/api/ai/*)
    ↕ HTTP + API Key Auth
[Auto Inspect Edge] :8002
    ↕ 4 SSE Streams
[Live Inspection Updates]
    ↓
[AI Models / Training Pipeline]
```

**Key Integration Points:**
- Authentication: Next.js API routes use `AI_BACKEND_API_KEY` to authenticate with AI Backend
- Live inspection: Auto Inspect Edge publishes 4 SSE streams, Next.js consumes in real-time
- Model training: False call overrides are synced to cloud, AI Backend retrains models
- API proxy: `/app/api/ai/*` routes forward requests to AI Backend with authentication

**Environment Configuration:**
- `NEXT_PUBLIC_AI_BACKEND_URL` - AI Backend base URL (http://localhost:8002 for Auto Inspect Edge)
- `NEXT_PUBLIC_AI_BACKEND_SSE_URL` - SSE endpoint URL (http://localhost:8002)
- `AI_BACKEND_API_KEY` - Server-side API key for authenticating with AI Backend

### Live Inspection Architecture

The live inspection view (`LiveViewV3.jsx`) uses different data flow patterns for operator vs manager:

**Operator (real-time via SSE):**
```
AI Backend → 4 SSE streams → useLiveInspection hook → LiveViewV3 (operator)
                                                         ↓
                                              PUT /api/inspection/line-state/{lineId}
                                              (pushes state on every change)
```

**Manager (polling via API):**
```
GET /api/inspection/line-state/{lineId} ← Manager polls every 500ms
GET /api/work-orders/active/{lineId}    ← Manager polls every 5s (slow, DB query)
```

**Line State API** (`app/api/inspection/line-state/[lineId]/route.js`):
- In-memory `Map` cache for fast reads (loaded from `.line-state.json` once on startup)
- `PUT` writes to memory + async file backup (non-blocking)
- `GET` reads from memory only (no file I/O)
- Stores: processStatus, stage, hardware, currentInspection, autoNgEnabled

**Stage Definitions:**
- Fetched from AI Backend via `GET /api/model/stages` (returns 20 stages)
- `useLiveInspection` hook fetches stages on mount for ALL roles (operator + manager)
- `InspectionStage.jsx` groups 20 stages into 5 phases: TOP, FLIP, BTM, AI TOP, AI BTM
- Grouping logic in `groupStagesByPhase()` uses the `type` field from stage definitions

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

### Cloud Sync System

The cloud sync system enables uploading inspection data from edge PostgreSQL to Supabase Cloud. Key components:

**Sync Module** (`lib/sync/`):
- `supabaseAdmin.js` - Admin client for cloud operations
- `syncLock.js` - Lock management to prevent concurrent syncs
- `onlineCheck.js` - Cloud connectivity checks
- `syncToCloud.js` - Main sync logic with batch processing + image upload
- `cloudImageUpload.js` - Upload override images to Supabase Storage
- `index.js` - Module exports

**Sync Repository** (`lib/repos/syncRepo.js`):
- Fetches pending records (sync_status: pending/failed)
- Marks records as synced/failed
- Tracks sync state per table
- Logs sync sessions

**Sync API Endpoints** (`app/api/sync/`):
- `GET /api/sync/status` - Full sync status
- `GET /api/sync/check-online` - Quick connectivity check
- `POST /api/sync/trigger` - Start sync (background)
- `GET /api/sync/progress` - Real-time progress
- `POST /api/sync/force-release` - Admin: release stuck lock
- `GET /api/sync/history` - Recent sync sessions

**Sync Flow (executed in `syncToCloud.js`):**
1. Acquire sync lock
2. Sync DB table records (inspection_results → inspection_defects → overrides → inspection_stats)
3. Sync work order qty updates
4. Upload override images to Supabase Storage (approved overrides only)
5. Log sync session
6. Release lock

**Synced Tables**: inspection_results, inspection_defects, overrides, inspection_stats, work_orders (qty updates only)
- `event_log` is temporarily excluded due to schema mismatch with cloud

**Override Image Upload:**
- Images are uploaded during the sync process, NOT during manager approval
- Manager approval (`PATCH /api/overrides/:id`) only updates local DB status
- `syncOverrideImages()` in `syncToCloud.js` finds approved overrides with empty `cloud_image_paths`, reads local files from `storage/false-calls/`, and uploads to Supabase Storage bucket `inspection-images`
- Both local DB and cloud DB are updated with the resulting cloud URLs

**Timezone Handling:**
- Local PostgREST returns timestamps with timezone offset (e.g., `+07:00`)
- `stripTimezoneOffsets()` in `syncToCloud.js` removes the offset before uploading to cloud
- This ensures cloud stores the same wall-clock time as local (important for single-timezone factory)

**Configuration**: Set `SUPABASE_CLOUD_URL` and `SUPABASE_SERVICE_KEY` in `.env.local`. Lock expires after 10 minutes, processes 100 records per batch by default.

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

## Troubleshooting

### Common Issues

**"Module not found" errors**
```bash
rm -rf node_modules package-lock.json
npm install
```

**"Port 3000 already in use"**
```bash
# Find and kill the process
npx kill-port 3000
# Or use a different port
PORT=3001 npm run dev
```

**"PostgREST vs Next.js port confusion"**

If Next.js API routes return 500 errors after login:
```bash
# Check what's on each port
netstat -ano | findstr ":3000"  # Should be Next.js
netstat -ano | findstr ":3001"  # Should be PostgREST

# If mixed up, kill all and restart in correct order:
# 1. Start PostgREST first (port 3001)
# 2. Then start Next.js (port 3000)
```

**Symptom:** Login works but master-data API calls fail with 500 errors.
**Cause:** Next.js started on port 3001 (PostgREST's port), so API routes connect to themselves.
**Fix:** Always start PostgREST before Next.js.

**"Supabase connection failed"**
- Check `.env.local` exists with correct `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Verify Supabase project is running
- Check network connectivity to Supabase URL

**"CSRF token validation failed"**
- Ensure `X-CSRF-Token` header is included in POST/PUT/DELETE requests
- Token is generated by `GET /api/auth/csrf` endpoint
- Check `lib/utils/csrf.js` for implementation details
- CSRF validation is skipped in development mode

**"AI Backend connection refused"**
- Verify AI Backend is running: `curl http://localhost:8002/health`
- Check `NEXT_PUBLIC_AI_BACKEND_URL` in `.env.local`
- Ensure API key is configured: `AI_BACKEND_API_KEY`
- AI Backend is a separate FastAPI service, must be started independently

**"Unauthorized" errors on API routes**
- In development: Check x-user-id header is being sent
- In production: Verify authentication token is valid
- Check user has required role/permissions for the endpoint
- Review `withAuth()` middleware configuration in API route

**TypeScript errors during development**
- TypeScript errors won't block builds (`ignoreBuildErrors: true` in next.config.js)
- Run `npm run typecheck` to see all type errors
- Fix incrementally - type safety improves code quality and catches bugs

**Build fails with memory error**
- Increase Node.js memory: `NODE_OPTIONS="--max-old-space-size=4096" npm run build`
- Check for circular dependencies or large bundle sizes

**Tests failing locally but passing in CI**
- Clear Jest cache: `npm test -- --clearCache`
- Check for timezone-dependent test logic
- Verify mock data matches test expectations

## Environment Setup

Required environment variables (create `.env.local`):

```env
# Primary Database - Local PostgREST
NEXT_PUBLIC_SUPABASE_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# AI Backend - Auto Inspect Edge (Production API)
NEXT_PUBLIC_AI_BACKEND_URL=http://localhost:8002
NEXT_PUBLIC_AI_BACKEND_SSE_URL=http://localhost:8002

# AI Backend - AI Engine (uncomment to use)
# NEXT_PUBLIC_AI_BACKEND_URL=http://localhost:8001
# NEXT_PUBLIC_AI_BACKEND_SSE_URL=http://localhost:8001

# Supabase - Server (NEVER use NEXT_PUBLIC_ prefix!)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Backend Integration
AI_BACKEND_API_KEY=your-secure-api-key-here
```

**⚠️ Security Warning:** Service role keys (`SUPABASE_SERVICE_ROLE_KEY`) have full database access. NEVER expose them to client-side code by using `NEXT_PUBLIC_` prefix. Only use `NEXT_PUBLIC_` for non-sensitive configuration like URLs and anonymous keys.

## Security & Known Issues

### Critical Security Fixes Required

⚠️ **Before production deployment**, address these critical vulnerabilities identified in security review (2026-02-03):

1. **Upgrade Next.js** - Version 13.5.1 has 15+ critical CVEs including SSRF, DoS, and authorization bypass
   ```bash
   npm install next@latest
   npm audit fix
   ```

2. **Development Auth Bypasses** - Production safeguards needed:
   - `lib/auth/apiAuth.js:16-58` - x-user-id header authentication bypass in dev mode
   - `lib/auth/apiKeyAuth.js:19-29` - AI Backend API key validation disabled in dev
   - Risk: If NODE_ENV misconfigured, attackers can impersonate any user
   - Fix: Add explicit production checks that block dev auth paths

3. **Environment Variable Security**
   - ⚠️ **NEVER** use `NEXT_PUBLIC_` prefix for service role keys or API keys
   - ✅ Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `AI_BACKEND_API_KEY`
   - ✅ Client-safe: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Any `NEXT_PUBLIC_` variable is exposed to browser JavaScript

4. **Path Traversal Protection** - `app/api/storage/false-calls/[...path]/route.js`:
   - Add strict path validation to prevent directory traversal attacks
   - Verify resolved paths stay within intended storage directory

5. **CSRF Protection in Development**
   - `lib/utils/csrf.js:117-125` - CSRF validation completely skipped in dev mode
   - Developers may not test CSRF protection, breaking production deployments
   - Keep validation enabled in dev with clear error messages

6. **Vulnerable Dependencies**
   - Run `npm audit fix` to patch known vulnerabilities
   - Critical issues in cross-spawn, glob, lodash

7. **Missing Row Level Security (RLS) Policies**
   - Verify Supabase RLS policies are enabled for all tables
   - Even with application-level auth, direct database access bypasses security

### Known Gotchas

- **TypeScript errors ignored** - `ignoreBuildErrors: true` in next.config.js means type errors won't block builds. Run `npm run typecheck` to see all type errors.
- **Mock auth in development** - x-user-id header allows user impersonation in dev mode only. This is intentional for testing but dangerous if NODE_ENV is misconfigured.
- **CSRF protection required** - All state-changing API calls (POST/PUT/DELETE) need X-CSRF-Token header. Get token from `GET /api/auth/csrf`.
- **localStorage for auth** - Current implementation stores user in localStorage. Will migrate to httpOnly cookies when moving to Supabase Auth.
- **Service role key naming** - Documentation previously showed incorrect `NEXT_PUBLIC_` prefix pattern. Always use server-only env vars for secrets.
- **Security headers configured** - `next.config.js` includes comprehensive security headers (CSP, HSTS, X-Frame-Options, etc.). Don't disable these in production.

### Security Architecture

The app implements defense-in-depth with multiple security layers:

**Input Validation & Sanitization:**
- Zod schemas validate all API inputs (`lib/validations/schemas.js`)
- Sanitization utilities prevent XSS, SQL injection, prototype pollution (`lib/utils/sanitize.js`)
- Magic bytes validation for file uploads prevents MIME spoofing

**Authentication & Authorization:**
- `withAuth()` middleware protects API routes (`lib/auth/apiAuth.js`)
- Role-Based Access Control (RBAC) with permission system (`lib/auth/rbac.js`)
- Section-based access control for data isolation (`lib/auth/sectionAccess.js`)
- API key authentication for AI Backend services (`lib/auth/apiKeyAuth.js`)

**Security Headers:**
- Content Security Policy (CSP) configured in `next.config.js`
- HSTS, X-Frame-Options, X-Content-Type-Options enabled
- Referrer Policy and Permissions Policy configured

**Rate Limiting & CSRF:**
- Rate limiting on sensitive endpoints (login: 5 req/min)
- Double-submit cookie CSRF protection with constant-time comparison (`lib/utils/csrf.js`)

**Security Score: 6.5/10** (per security review) - Good architecture but critical dependency updates needed.

## Key Implementation Patterns

### Override Workflow

False call overrides follow this flow:
1. Operator submits override via `FalseCallOverrideModal` (status: `pending`, images saved to local `storage/false-calls/`)
2. Manager reviews in `/inspection/overrides` using `OverrideReviewModal`
3. Manager approves or rejects (status: `approved` or `rejected`) - **local DB only, no image upload**
4. System creates event log entry and notification
5. During cloud sync: approved overrides with local images are uploaded to Supabase Storage
6. Both approved and rejected overrides are synced as DB records, but only approved ones get images uploaded

**Important:** Image upload intentionally does NOT happen during approval. The approval PATCH handler only updates status in the local database. Images are uploaded during `syncToCloud()` which runs in the background with no API timeout constraints.

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

All 18 implementation phases are complete (Phases 1-16d). Implementation prompts are archived in `.claude/prompts/` directory for reference.

### Codebase Cleanup (2026-01-04)

Major cleanup removed unused hooks, utilities, repos, legacy components, and duplicate APIs. Created `lib/utils/roleUtils.js` (role normalization) and `data/mockUsers.js` (shared mock users).

---

## Future Integrations

Planned:
- Supabase Auth migration (currently using mock auth with x-user-id header)
- FastAPI microservice for AI training (separate repo)
- Semantic search with pgvector for override embeddings
