> **For Claude:** REQUIRED SKILL: Use gaspol-execute to implement this plan.
> **CRITICAL:** This plan specifies real integrations. During execution,
> NEVER substitute placeholders for real data sources without explicit
> user approval. If a data source doesn't exist yet, STOP and ask.

## Goal

Build a self-updating OTA (Over-The-Air) system for the INDUSIA HMI that detects new versions from GitHub, notifies superadmin users, executes updates (git pull + npm install + SQL migrations + build), and auto-restarts the service. This eliminates the need for manual SSH + git pull on production machines.

Design doc: `docs/plans/2026-02-15-ota-update-system-design.md`

## Architecture Context

From CLAUDE.md:
- **Auth**: `withAuth()` middleware in `lib/auth/apiAuth.js`, role check via `request.user.role`
- **Response format**: `{ success: true, data }` / `{ success: false, error }`
- **Repo pattern**: `lib/repos/systemHealthRepo.js` — returns `{ success, data/error }`
- **Supabase client**: `lib/supabaseClient.js` → local PostgREST (port 3001)
- **SSE pattern**: `ReadableStream` + `TextEncoder` in existing API routes
- **Hook pattern**: `hooks/useSync.js` — polling + state + ref-based cleanup
- **TopNav**: Already has sync indicator via `useSystemHealthContext()`, add version badge beside it
- **Super admin pages**: `app/super-admin/permissions/page.js` — role guard + `useAuth()` pattern
- **Design system**: Phosphor/Terminal aesthetic, amber primary, CRT effects, monospace fonts
- **Line State API**: In-memory Map at `app/api/inspection/line-state/[lineId]/route.js`
- **Validation**: Zod schemas in `lib/validations/schemas.js`
- **i18n**: `i18n/en.json` + `i18n/id.json`, use `useI18n()` hook
- **DB**: Local PostgreSQL via PostgREST on port 3001. DDL requires direct pg connection.

## Tech Stack

- **Next.js 13.5 App Router** — API routes + pages
- **PostgREST** — REST API for DML (SELECT/INSERT/UPDATE)
- **pg npm package** — Direct PostgreSQL connection for DDL migrations only
- **child_process** — `execSync`/`spawn` for git, npm, build commands
- **PowerShell** — Restart watcher script for Windows production
- **Git tags** — Semantic versioning on `production` branch
- **SSE (Server-Sent Events)** — Real-time update progress stream

## Data Integration Map

| Feature | Data Source | Hook/API | Exists? | Action |
|---------|-----------|----------|---------|--------|
| Current version | `package.json` version field | `GET /api/system/version` | No | Create route, read pkg |
| Remote version check | `git fetch --tags` + `git describe` | `GET /api/system/check-update` | No | Create route, exec git |
| Update trigger | `child_process.spawn()` pipeline | `POST /api/system/update` | No | Create route + pipeline |
| Update progress | SSE stream from spawn stdout | `GET /api/system/update/progress` | No | Create SSE route |
| Update history | `update_log` DB table | `GET /api/system/update/history` | No | Create table + route |
| Pending migrations | `migrations/` folder scan vs `schema_migrations` | `GET /api/system/migrations/pending` | No | Create table + route |
| Production safety | Line State in-memory Map | `/api/inspection/line-state/*/` | **Yes** | Import `lineStateStore` |
| Auth gate | `useAuth().isSuperAdmin` | `withAuth()` | **Yes** | Use existing |
| Toast notifications | `useToast()` hook | `hooks/useToast.js` | **Yes** | Use existing |
| TopNav badge | `useSystemUpdate()` hook | New hook | No | Create hook |
| i18n strings | `i18n/en.json` + `i18n/id.json` | `useI18n()` | **Yes** | Add new keys |
| DB migrations | Direct PostgreSQL via `pg` package | `scripts/run-migrations.js` | No | Create script |
| Restart signal | `.restart-trigger` file | PowerShell watcher | No | Create scripts |

## Dependency Graph

```
Phase 1 (DB + Migration Runner)
  ↓
Phase 2 (Version + Check-Update APIs)
  ↓
  ├─→ Phase 3 (Hook + TopNav Badge)     ← can parallel with Phase 4
  ├─→ Phase 4 (Update Pipeline + SSE)   ← can parallel with Phase 3
  ↓
Phase 5 (System Update Page UI)
  ↓
Phase 6 (Restart Mechanism)   ← can parallel with Phase 5
  ↓
Phase 7 (Polish: i18n, login check, CLAUDE.md)
```

---

## Phase 1: Database Foundation + Migration Runner

**Estimated time:** 20 minutes

**Files:**
- Create: `migrations/001_create_schema_migrations.sql`
- Create: `migrations/002_create_update_log.sql`
- Create: `scripts/run-migrations.js`
- Create: `lib/repos/updateRepo.js`
- Modify: `package.json` (add `pg` dependency, version field, migration script)

### Step 1.1: Set package.json version to 1.0.0

1. Open `package.json`, change `"version": "0.1.0"` to `"version": "1.0.0"`
2. Add script: `"migrate": "node scripts/run-migrations.js"`
3. Verify: `node -e "console.log(require('./package.json').version)"` outputs `1.0.0`

### Step 1.2: Install pg package

1. Run `npm install pg`
2. Verify: `node -e "require('pg')"` exits cleanly

### Step 1.3: Create bootstrap migration SQL

Create `migrations/001_create_schema_migrations.sql`:
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  filename TEXT NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  applied_by TEXT
);
```

### Step 1.4: Create update_log migration SQL

Create `migrations/002_create_update_log.sql`:
```sql
CREATE TABLE IF NOT EXISTS update_log (
  id SERIAL PRIMARY KEY,
  from_version TEXT NOT NULL,
  to_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  triggered_by TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  migrations_applied INTEGER DEFAULT 0,
  commits_pulled INTEGER DEFAULT 0,
  error_message TEXT,
  log_output TEXT
);
```

### Step 1.5: Create migration runner script

Create `scripts/run-migrations.js`:
1. Connect to PostgreSQL using `pg.Client` with `DATABASE_URL` env var
2. Check if `schema_migrations` table exists (`SELECT to_regclass('schema_migrations')`)
3. If not: execute `001_create_schema_migrations.sql` to bootstrap
4. Query `schema_migrations` for applied versions
5. Scan `migrations/` folder for `*.sql` files, sort numerically
6. For each pending migration: execute SQL, INSERT into `schema_migrations`
7. On error: log which migration failed, exit with error code
8. Print summary: "X migrations applied, Y already up to date"

**Important:** The script must work both standalone (`node scripts/run-migrations.js`) and as an importable module (for use by the update API). Export a `runMigrations(appliedBy)` function that returns `{ applied: number, errors: [] }`.

### Step 1.6: Add DATABASE_URL to .env.local

Add `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/indusia` (adjust credentials to match local PostgreSQL setup). This is server-only — no `NEXT_PUBLIC_` prefix.

### Step 1.7: Create updateRepo.js

Create `lib/repos/updateRepo.js` following the `systemHealthRepo.js` pattern:
- `getUpdateHistory(limit = 20)` — SELECT from `update_log` ORDER BY started_at DESC
- `createUpdateLog(fromVersion, toVersion, triggeredBy)` — INSERT, return row
- `completeUpdateLog(id, status, migrationsApplied, commitsPulled, errorMessage, logOutput)` — UPDATE
- `getPendingMigrations()` — call migration runner in dry-run mode (scan only, don't execute)

Use `supabase` client from `lib/supabaseClient.js` for DML operations (PostgREST handles SELECT/INSERT/UPDATE fine). Only the migration runner itself needs direct `pg` connection for DDL.

### Step 1.8: Test migration runner

1. Run `node scripts/run-migrations.js`
2. Verify: both tables created in PostgreSQL
3. Verify: `schema_migrations` has 2 rows (001 + 002)
4. Run again — should output "0 migrations applied, 2 already up to date"
5. Restart PostgREST so it picks up new tables

**Verification:**
- [ ] `package.json` version is `1.0.0`
- [ ] `pg` package installed
- [ ] `node scripts/run-migrations.js` creates both tables
- [ ] Re-running is idempotent (0 migrations applied)
- [ ] `updateRepo.getUpdateHistory()` returns empty array (no errors)
- [ ] PostgREST serves `schema_migrations` and `update_log` tables

---

## Phase 2: Version & Check-Update API Routes

**Estimated time:** 15 minutes

**Files:**
- Create: `app/api/system/version/route.js`
- Create: `app/api/system/check-update/route.js`
- Create: `lib/utils/version.js` (shared version utilities)

### Step 2.1: Create version utility

Create `lib/utils/version.js`:
- `getCurrentVersion()` — reads `package.json` version field using `require()` or `fs.readFileSync`
- `getBuildInfo()` — returns `{ version, branch, commitHash, buildDate }` using `execSync('git rev-parse --short HEAD')` and `execSync('git branch --show-current')`
- `compareVersions(a, b)` — semver comparison, returns -1/0/1 (simple string split on `.`, compare each part numerically)

### Step 2.2: Create GET /api/system/version

Create `app/api/system/version/route.js`:
1. No auth required (public endpoint — all roles can see version)
2. Call `getCurrentVersion()` and `getBuildInfo()`
3. Return: `{ success: true, data: { version, branch, commitHash, buildDate } }`
4. Wrap in try-catch, return 500 on error

### Step 2.3: Create GET /api/system/check-update

Create `app/api/system/check-update/route.js`:
1. Protect with `withAuth()` — superadmin only (use role check, not permission string since `system:update` permission doesn't exist yet)
2. Execute `git fetch origin production --tags` via `execSync`
3. Get current version: `git describe --tags --abbrev=0` (local)
4. Get latest remote version: `git describe --tags --abbrev=0 origin/production`
5. Count commits behind: `git rev-list HEAD..origin/production --count`
6. Get changelog: `git log ${currentTag}..origin/production --oneline --format=%s`
7. Return:
```json
{
  "success": true,
  "data": {
    "currentVersion": "v1.0.0",
    "latestVersion": "v1.1.0",
    "isUpdateAvailable": true,
    "commitsBehind": 7,
    "changelog": ["feat: add board frame counts", "fix: NG counting issue"]
  }
}
```
8. If git commands fail (no remote, no tags): return graceful error, not 500

### Step 2.4: Test both endpoints

1. `curl http://localhost:3000/api/system/version` — should return version + build info
2. `curl -H "x-user-id: 1" http://localhost:3000/api/system/check-update` — should work (superadmin user ID)
3. Verify git fetch doesn't fail when `production` branch doesn't exist yet (graceful error)

**Verification:**
- [ ] `GET /api/system/version` returns `{ version: "1.0.0", ... }`
- [ ] `GET /api/system/check-update` with superadmin auth returns version comparison
- [ ] Non-superadmin gets 403 on check-update
- [ ] Graceful error when `production` branch/remote not configured
- [ ] No `NEXT_PUBLIC_` env vars used (all server-side)

---

## Phase 3: useSystemUpdate Hook + TopNav Version Badge

**Estimated time:** 15 minutes

**Files:**
- Create: `hooks/useSystemUpdate.js`
- Create: `components/system-update/VersionBadge.jsx`
- Modify: `components/layout/TopNav.jsx`

### Step 3.1: Create useSystemUpdate hook

Create `hooks/useSystemUpdate.js` following `hooks/useSync.js` pattern:

**State:**
- `currentVersion` (string) — from `/api/system/version`
- `latestVersion` (string | null)
- `isUpdateAvailable` (boolean)
- `commitsBehind` (number)
- `changelog` (string[])
- `loading` (boolean)
- `error` (string | null)

**Methods:**
- `checkForUpdate()` — calls `GET /api/system/check-update`, updates state
- `fetchCurrentVersion()` — calls `GET /api/system/version`

**Behavior:**
- On mount: fetch current version immediately
- `checkForUpdate()` is NOT called automatically — only triggered by:
  1. Explicit call from caller (TopNav badge click, login check, page mount)
  2. Hourly interval IF `isSuperAdmin` is true (pass as param or option)
- Use `useRef` for interval cleanup
- Use `useCallback` for stable function references

### Step 3.2: Create VersionBadge component

Create `components/system-update/VersionBadge.jsx`:
- Props: none (uses `useSystemUpdate` hook internally)
- Reads `isSuperAdmin` from `useAuth()`
- On mount: calls `fetchCurrentVersion()`, if superadmin also `checkForUpdate()`
- Sets up hourly interval for superadmin: `setInterval(checkForUpdate, 3600000)`
- Display:
  - Monospace text: `v1.0.0`
  - If `isUpdateAvailable`: amber pulsing dot (use `animate-pulse-glow` + `bg-phosphor-amber`)
  - Click: `router.push('/super-admin/system-update')` if superadmin, else no-op
  - Tooltip: "Update available: v1.1.0" or "System up to date"
- Styling: `font-mono text-xs text-text-secondary` with `hover:text-text-primary` transition

### Step 3.3: Add VersionBadge to TopNav

Modify `components/layout/TopNav.jsx`:
1. Import `VersionBadge` from `@/components/system-update/VersionBadge`
2. Add `<VersionBadge />` next to the existing sync status button (before or after)
3. No other TopNav changes needed — the badge is self-contained

### Step 3.4: Test version badge

1. Start dev server, login as superadmin
2. Verify version badge shows `v1.0.0` in TopNav
3. Verify amber dot does NOT show (no production branch yet = no update available)
4. Verify non-superadmin users see version but no amber dot
5. Verify clicking badge navigates to `/super-admin/system-update` (will 404 for now — ok)

**Verification:**
- [ ] Version badge renders in TopNav for all roles
- [ ] Superadmin sees version + triggers update check (hourly)
- [ ] Non-superadmin sees version only (no update check)
- [ ] Amber pulsing dot appears when `isUpdateAvailable === true`
- [ ] Click navigates to `/super-admin/system-update` for superadmin
- [ ] Hook cleans up interval on unmount

---

## Phase 4: Update Pipeline + SSE Progress Stream

**Estimated time:** 25 minutes

**Files:**
- Create: `app/api/system/update/route.js`
- Create: `app/api/system/update/progress/route.js`
- Create: `app/api/system/update/history/route.js`
- Create: `app/api/system/migrations/pending/route.js`
- Create: `lib/services/updatePipeline.js`

### Step 4.1: Create the update pipeline service

Create `lib/services/updatePipeline.js`:

This is the core orchestrator. It runs the update steps sequentially and emits progress events.

```js
// Event emitter pattern for progress reporting
// Uses a simple callback: onProgress(step, status, message)

export async function runUpdatePipeline({ fromVersion, toVersion, onProgress, userId }) {
  // Returns { success, migrationsApplied, commitsPulled, error }
}
```

**Pipeline steps:**

1. **SAFETY_CHECK**: Import the line-state store (the in-memory Map from `app/api/inspection/line-state/[lineId]/route.js`). Iterate all entries, check `processStatus`. If any === `'RUNNING'`, throw error with line names.

   **Important**: The line-state Map is in the same Node.js process. Import it directly — don't make an HTTP call. Check how the Map is exported from the route file. If it's not exported, create a shared module `lib/services/lineStateStore.js` that both the route and the pipeline can import.

2. **GIT_PULL**: `execSync('git fetch origin production --tags')`, then `execSync('git pull origin production')`. Parse stdout for commit count.

3. **NPM_INSTALL**: Hash `package-lock.json` before and after pull. If changed: `spawn('npm', ['install', '--production'])` and stream stdout to `onProgress`. If unchanged: skip with message.

4. **RUN_MIGRATIONS**: Import and call `runMigrations(userId)` from `scripts/run-migrations.js`. Pass results to `onProgress`.

5. **BUILD**: `spawn('npm', ['run', 'build'])`. Stream stdout/stderr line-by-line to `onProgress`. This is the longest step.

6. **COMPLETE**: Return results.

Use `child_process.spawn` (not `execSync`) for npm install and build so we can stream output. Use `execSync` for git commands (fast, need result immediately).

### Step 4.2: Extract lineStateStore to shared module

The line-state in-memory Map currently lives inside the route file. Extract it:
1. Read `app/api/inspection/line-state/[lineId]/route.js` to understand the Map structure
2. Create `lib/services/lineStateStore.js` — exports `getLineState(lineId)`, `getAllLineStates()`, `setLineState(lineId, data)`
3. Update the route file to import from the shared module instead of using a local Map
4. The update pipeline can now import `getAllLineStates()` for safety check

**Note:** If the route already exports the Map or uses a module-level variable, just import it directly. Don't over-engineer.

### Step 4.3: Create POST /api/system/update

Create `app/api/system/update/route.js`:
1. Auth: superadmin only (check `request.user.role === 'superadmin'`)
2. Read `targetVersion` from request body (optional — if not provided, update to latest)
3. Get current version from `package.json`
4. Create `update_log` entry via `updateRepo.createUpdateLog()`
5. Run `runUpdatePipeline()` — pass `onProgress` that appends to a log buffer
6. On success: update log entry with `status: 'success'`
7. On failure: update log entry with `status: 'failed'`, `error_message`
8. Return: `{ success: true, data: { updateLogId, status, ... } }`

**Important:** The update runs synchronously in the request handler. This is intentional — the SSE progress endpoint is a separate connection that reads from a shared progress buffer. OR, simpler: the POST triggers the update and streams progress directly as SSE response (combined endpoint).

**Decision: Use combined POST that returns SSE stream.** This is simpler — one endpoint, one connection. The client POSTs to trigger and receives SSE events in the response. After completion, the stream ends.

Update the route: `POST /api/system/update` returns a `ReadableStream` response with `Content-Type: text/event-stream`.

### Step 4.4: Create GET /api/system/update/progress (alternative read-only)

Create `app/api/system/update/progress/route.js`:
- This is a fallback SSE endpoint that reads the latest update log's `log_output` field
- Useful if the browser disconnects during update and reconnects
- Polls `update_log` every 2 seconds for the latest in-progress entry
- When status changes to `success` or `failed`, sends final event and closes

### Step 4.5: Create GET /api/system/update/history

Create `app/api/system/update/history/route.js`:
1. Auth: superadmin only
2. Call `updateRepo.getUpdateHistory(20)`
3. Return: `{ success: true, data: [...] }`

### Step 4.6: Create GET /api/system/migrations/pending

Create `app/api/system/migrations/pending/route.js`:
1. Auth: superadmin only
2. Call `updateRepo.getPendingMigrations()` (scans migrations/ folder, checks schema_migrations table)
3. Return: `{ success: true, data: { pending: [...filenames], applied: number } }`

### Step 4.7: Test update pipeline

1. **Safety check test**: Set a line to `RUNNING` via line-state API, try POST /api/system/update → should get 403 with active line info
2. **Dry run test**: With no production branch, POST /api/system/update → should fail gracefully at git pull step with clear error
3. **History test**: GET /api/system/update/history → should return the failed attempt(s)

**Verification:**
- [ ] POST `/api/system/update` returns SSE stream with progress events
- [ ] Safety check blocks update when any line is RUNNING
- [ ] Git pull, npm install, migrations, build steps execute in order
- [ ] Each step sends progress events to SSE stream
- [ ] `update_log` entry created at start, updated at end
- [ ] GET `/api/system/update/history` returns past updates
- [ ] GET `/api/system/migrations/pending` lists pending SQL files
- [ ] Pipeline errors are caught and reported (not 500 crash)

---

## Phase 5: System Update Page UI

**Estimated time:** 25 minutes

**Files:**
- Create: `app/super-admin/system-update/page.js`
- Create: `app/super-admin/system-update/loading.js`
- Create: `components/system-update/UpdateTerminal.jsx`
- Create: `components/system-update/PreflightCheck.jsx`
- Create: `components/system-update/UpdateHistory.jsx`

### Step 5.1: Create loading.js

Create `app/super-admin/system-update/loading.js`:
```js
import PageLoading from '@/components/common/PageLoading';
export default function Loading() { return <PageLoading />; }
```

### Step 5.2: Create UpdateTerminal component

Create `components/system-update/UpdateTerminal.jsx`:

**Props:**
- `isActive` (boolean) — whether an update is in progress
- `logLines` (array of `{ timestamp, level, message }`) — terminal output lines
- `onComplete` (callback) — called when stream ends

**UI:**
- Full-width container with `bg-void rounded-lg border border-surface-border`
- Monospace font (`font-mono`), small text (`text-xs`)
- Each line: `[HH:MM:SS] ▶/✓/✗ message`
  - `▶` (amber) for in-progress steps
  - `✓` (green) for completed steps
  - `✗` (red) for failed steps
- Auto-scroll to bottom on new lines
- Typing animation on the latest line: show characters one-by-one (use `animate-typing-cursor` after last character)
- Scanline overlay: `before:` pseudo-element with `animate-scan` from existing CSS
- Max height with overflow scroll: `max-h-[500px] overflow-y-auto`
- Progress bar at bottom: simple `div` with width percentage based on step count (8 steps total)

**SSE Consumer:**
- When `isActive`, connect to `POST /api/system/update` using `fetch()` with `body` and read from `response.body.getReader()`
- Parse SSE events: split on `\n\n`, extract `data:` lines
- Each event: `{ step, status, message, progress }` — append to `logLines`
- On stream end: call `onComplete(finalStatus)`

### Step 5.3: Create PreflightCheck component

Create `components/system-update/PreflightCheck.jsx`:

**Props:**
- `checks` (array of `{ name, status, message }`) — e.g., Database, Migrations, Dependencies, Production Lines

**UI:**
- Compact list with status icons: `✓` (green), `⚠` (amber), `✗` (red), `...` (gray spinner)
- Each row: icon + name + status message
- Styling: `text-xs font-mono`, rows separated by `border-b border-surface-border`

### Step 5.4: Create UpdateHistory component

Create `components/system-update/UpdateHistory.jsx`:

**Props:**
- `history` (array from `GET /api/system/update/history`)

**UI:**
- Table with columns: Version (from → to), Date, Triggered By, Status, Migrations
- Status badges: `success` (green), `failed` (red), `in_progress` (amber pulse)
- If empty: "No update history" message
- Max 10 rows with "View all" link if more

### Step 5.5: Create System Update page

Create `app/super-admin/system-update/page.js`:

**Three states:**

**State 1 — Up to Date (`!isUpdateAvailable && !isUpdating`):**
- Current version card: version, branch, commit hash, build date
- "CHECK NOW" button → calls `checkForUpdate()`
- Update history table

**State 2 — Update Available (`isUpdateAvailable && !isUpdating`):**
- Version comparison: `v1.0.0 → v1.1.0` with arrow
- Changelog list (from `checkForUpdate` response)
- Preflight checks panel (auto-run on mount):
  - Database: ping `/api/system-health`
  - Migrations: `GET /api/system/migrations/pending`
  - Production: check line states via existing API
- "UPDATE TO v1.x.0" button (amber glow, disabled if preflight fails)
- Confirmation dialog before triggering: "This will update the system. Are you sure?"

**State 3 — Updating (`isUpdating`):**
- UpdateTerminal component (full width, prominent)
- No other actions available during update
- On complete: show result (success/failure), refresh version badge

**Auth guard:**
- Use pattern from `app/super-admin/permissions/page.js`
- If not superadmin: show "Access Denied" with back button

**Data fetching:**
- Use `useSystemUpdate` hook for version + update check
- Fetch update history on mount via `fetch('/api/system/update/history')`
- Fetch pending migrations on mount via `fetch('/api/system/migrations/pending')`

### Step 5.6: Test the full UI flow

1. Login as superadmin → navigate to `/super-admin/system-update`
2. Verify: shows current version, "up to date" state
3. Click "CHECK NOW" → verifies against remote (may show error if no production branch — ok)
4. Verify: update history table renders (empty initially)
5. Verify: non-superadmin gets access denied screen

**Verification:**
- [ ] Page renders three states correctly based on update availability
- [ ] Superadmin role guard works (non-superadmin sees access denied)
- [ ] UpdateTerminal renders log lines with correct styling (monospace, colors, auto-scroll)
- [ ] PreflightCheck shows status for all 4 checks
- [ ] UpdateHistory renders table from API data
- [ ] "UPDATE" button triggers SSE connection and shows terminal output
- [ ] Confirmation dialog appears before triggering update
- [ ] Error states handled gracefully (network errors, git errors, build failures)

---

## Phase 6: Restart Mechanism

**Estimated time:** 10 minutes

**Files:**
- Create: `scripts/start-hmi.ps1`
- Create: `scripts/restart-watcher.ps1`
- Modify: `lib/services/updatePipeline.js` (add restart trigger step)
- Modify: `package.json` (add `start:production` script)

### Step 6.1: Create restart-watcher.ps1

Create `scripts/restart-watcher.ps1`:
```powershell
# Watches for .restart-trigger file in project root
# When detected: kill Node, wait, restart Next.js production server
$projectRoot = Split-Path -Parent $PSScriptRoot
$triggerFile = Join-Path $projectRoot ".restart-trigger"

Write-Host "[restart-watcher] Monitoring for restart trigger at: $triggerFile"

while ($true) {
    if (Test-Path $triggerFile) {
        Write-Host "[restart-watcher] Restart trigger detected!"
        Remove-Item $triggerFile -Force

        # Kill Node.js processes
        Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
        Write-Host "[restart-watcher] Node processes stopped"

        Start-Sleep -Seconds 3

        # Restart Next.js production
        Set-Location $projectRoot
        Write-Host "[restart-watcher] Starting Next.js production server..."
        Start-Process -FilePath "npm" -ArgumentList "run", "start" -WorkingDirectory $projectRoot -NoNewWindow
        Write-Host "[restart-watcher] Server restarted"
    }
    Start-Sleep -Seconds 5
}
```

### Step 6.2: Create start-hmi.ps1

Create `scripts/start-hmi.ps1`:
```powershell
# Production startup script for INDUSIA HMI
# Starts restart-watcher as background job, then Next.js
$projectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "=== INDUSIA HMI Production Startup ==="

# Start restart watcher in background
$watcherPath = Join-Path $PSScriptRoot "restart-watcher.ps1"
Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$watcherPath`"" -WindowStyle Hidden
Write-Host "[startup] Restart watcher started (background)"

# Start Next.js production server
Set-Location $projectRoot
Write-Host "[startup] Starting Next.js on port 3000..."
npm run start
```

### Step 6.3: Wire restart trigger into update pipeline

Modify `lib/services/updatePipeline.js`:
- After BUILD step succeeds, add RESTART step
- Write `.restart-trigger` file to project root: `fs.writeFileSync('.restart-trigger', new Date().toISOString())`
- Send SSE event: `{ step: 'RESTART', status: 'pending', message: 'Restart signal sent. Server will restart in ~5 seconds.' }`
- The stream will close when the Node process is killed by the watcher

### Step 6.4: Add production script to package.json

Add to `package.json` scripts:
```json
"start:production": "powershell -ExecutionPolicy Bypass -File scripts/start-hmi.ps1"
```

### Step 6.5: Add .restart-trigger to .gitignore

Add `.restart-trigger` to `.gitignore` (it's a runtime file, not source code).

**Verification:**
- [ ] `scripts/restart-watcher.ps1` runs without errors
- [ ] Creating `.restart-trigger` file causes watcher to kill and restart Node
- [ ] `scripts/start-hmi.ps1` starts both watcher and Next.js
- [ ] `.restart-trigger` is in `.gitignore`
- [ ] Update pipeline writes trigger file after successful build

---

## Phase 7: Polish — i18n, Login Check, SideNav, CLAUDE.md

**Estimated time:** 15 minutes

**Files:**
- Modify: `i18n/en.json`
- Modify: `i18n/id.json`
- Modify: `context/AuthContext.jsx` (version check on superadmin login)
- Modify: `components/layout/SideNav.jsx` (add System Update menu item)
- Modify: `CLAUDE.md` (document OTA system)

### Step 7.1: Add i18n translation keys

Add to both `i18n/en.json` and `i18n/id.json` under new `systemUpdate` section:

**English:**
```json
"systemUpdate": {
  "title": "System Update",
  "description": "Manage system version and updates",
  "currentVersion": "Current Version",
  "latestVersion": "Latest Version",
  "branch": "Branch",
  "buildDate": "Build Date",
  "upToDate": "System is up to date",
  "updateAvailable": "Update available",
  "updateTo": "Update to {version}",
  "checkNow": "Check Now",
  "checking": "Checking for updates...",
  "changelog": "Changelog",
  "preflight": "Pre-Update Checks",
  "preflightDatabase": "Database Connection",
  "preflightMigrations": "Pending Migrations",
  "preflightDependencies": "Dependencies",
  "preflightProduction": "Production Lines",
  "allLinesIdle": "All lines idle",
  "linesRunning": "{count} line(s) running - stop before updating",
  "migrationsCount": "{count} migration(s) pending",
  "noMigrations": "No migrations needed",
  "updating": "Updating system...",
  "updateSuccess": "Update successful! Restart required.",
  "updateFailed": "Update failed",
  "restartNow": "Restart Now",
  "restartLater": "Later",
  "confirmUpdate": "This will update the system to {version}. Continue?",
  "stopProductionFirst": "Stop all production lines before updating",
  "history": "Update History",
  "noHistory": "No update history",
  "triggeredBy": "Triggered by",
  "migrations": "Migrations",
  "commits": "Commits",
  "toastUpdateAvailable": "Update available: {version} ({commits} commits)"
}
```

**Indonesian:** Translate all keys to Bahasa Indonesia.

### Step 7.2: Add version check on superadmin login

Modify `context/AuthContext.jsx`:
1. After successful login, if user role is `superadmin`:
2. Call `fetch('/api/system/check-update')` in background (non-blocking)
3. If update available: show toast using `showToast(t('systemUpdate.toastUpdateAvailable', { version, commits }))`
4. Don't block login flow — this is fire-and-forget

### Step 7.3: Add System Update to SideNav

Modify `components/layout/SideNav.jsx`:
1. Add "System Update" menu item under the super-admin section
2. Icon: `Download` or `RefreshCw` from lucide-react
3. Path: `/super-admin/system-update`
4. Visible only to superadmin
5. If update available (read from `useSystemUpdate` hook or a simpler context): show amber dot badge

### Step 7.4: Update CLAUDE.md

Add new section under Architecture:

```markdown
### OTA Update System

Self-updating mechanism for production deployments. Only superadmin can trigger.

**Branch Strategy:** `main` (UAT) → `production` (factory). Version tags on production branch.

**Update Flow:**
1. HMI checks for new tags on `production` branch via `GET /api/system/check-update`
2. Superadmin sees notification in TopNav + toast on login
3. Update page at `/super-admin/system-update` shows preflight checks
4. POST `/api/system/update` runs: safety check → git pull → npm install → migrations → build → restart signal
5. Progress streamed via SSE to UpdateTerminal component
6. `restart-watcher.ps1` detects `.restart-trigger` file and restarts Node

**Key Files:**
- `scripts/run-migrations.js` — SQL migration runner (direct pg connection)
- `scripts/restart-watcher.ps1` — PowerShell file watcher for auto-restart
- `scripts/start-hmi.ps1` — Production startup (starts watcher + Next.js)
- `lib/services/updatePipeline.js` — Orchestrates update steps
- `lib/repos/updateRepo.js` — update_log + schema_migrations queries
- `migrations/` — Numbered SQL files (001_xxx.sql, 002_xxx.sql)

**DB Tables:** `schema_migrations`, `update_log`
```

Also add `update_log` and `schema_migrations` to the Database Schema Notes section.

**Verification:**
- [ ] All i18n keys present in both `en.json` and `id.json`
- [ ] Superadmin login shows toast when update available
- [ ] SideNav shows "System Update" for superadmin only
- [ ] CLAUDE.md documents the OTA system accurately
- [ ] No missing translations (check `t()` calls match i18n keys)

---

## Git Branch Setup (One-Time, Before Phase 2 Testing)

Before Phase 2 can be fully tested, create the production branch:

```bash
# Create production branch from current state
git checkout -b production
git tag -a v1.0.0 -m "Initial production release"
git push origin production --tags

# Switch back to main for development
git checkout main
```

This only needs to happen once. Phase 2's `check-update` API will work after this.

---

## Summary

| Phase | Est. Time | Files Created | Files Modified | Can Parallel With |
|-------|-----------|---------------|----------------|-------------------|
| 1. DB Foundation | 20 min | 5 | 1 (package.json) | — |
| 2. Version APIs | 15 min | 3 | 0 | — |
| 3. Hook + Badge | 15 min | 2 | 1 (TopNav) | Phase 4 |
| 4. Update Pipeline | 25 min | 5 | 1 (line-state) | Phase 3 |
| 5. Update Page UI | 25 min | 5 | 0 | Phase 6 |
| 6. Restart Scripts | 10 min | 2 | 2 (pipeline, pkg) | Phase 5 |
| 7. Polish | 15 min | 0 | 5 | — |
| **Total** | **~125 min** | **22 files** | **10 files** | |
