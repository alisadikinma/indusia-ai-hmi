# INDUSIA OTA Update System Design

**Date:** 2026-02-15
**Status:** Approved
**Author:** Brainstorm session

## Problem

Updating the HMI requires SSH + manual `git pull` + rebuild. Not professional for production-deployed systems. Need self-updating capability with admin UI, safety checks, and SQL migration support.

## Architecture Overview

```
[Developer] → push to main (UAT)
                  ↓ (tested & approved)
              merge to production + git tag v1.x.0
                  ↓
[Factory HMI] ← checks production branch for new tags
              ← admin clicks "Update" in super-admin panel
              ← runs: git pull → npm install → migrations → build → restart
```

## Branch Strategy

- `main` = UAT (development/testing)
- `production` = stable releases for factory machines
- Version tags: `v1.0.0`, `v1.1.0`, etc. on `production` branch
- HMI checks remote `production` branch for new tags via `git fetch --tags`

## Database Schema

### schema_migrations

```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  filename TEXT NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  applied_by TEXT
);
```

### update_log

```sql
CREATE TABLE update_log (
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

## API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/system/version` | GET | any | Current version + build info from package.json |
| `/api/system/check-update` | GET | superadmin | `git fetch --tags`, compare local vs remote |
| `/api/system/update` | POST | superadmin | Trigger full update pipeline |
| `/api/system/update/progress` | GET | superadmin | SSE stream of update progress |
| `/api/system/update/history` | GET | superadmin | List from `update_log` table |
| `/api/system/migrations/pending` | GET | superadmin | List pending SQL migrations |

## Update Pipeline

```
POST /api/system/update
  │
  ├─ 1. SAFETY CHECK
  │    → Check all line-states from in-memory Map
  │    → Any processStatus === 'RUNNING'? → 403 + list active lines
  │
  ├─ 2. CREATE UPDATE LOG
  │    → INSERT into update_log (status: 'in_progress')
  │
  ├─ 3. GIT PULL
  │    → exec('git fetch origin production --tags')
  │    → exec('git pull origin production')
  │    → Count commits pulled via git log
  │
  ├─ 4. NPM INSTALL (conditional)
  │    → Compare package-lock.json hash before/after pull
  │    → If changed: exec('npm install --production')
  │
  ├─ 5. RUN MIGRATIONS
  │    → Execute scripts/run-migrations.js
  │    → Scans migrations/ folder, compares with schema_migrations table
  │    → Runs pending in numerical order
  │
  ├─ 6. BUILD
  │    → exec('npm run build')
  │    → Stream stdout to SSE
  │
  ├─ 7. UPDATE LOG
  │    → UPDATE update_log SET status='success'
  │
  └─ 8. RESTART SIGNAL
       → Write .restart-trigger file
       → PowerShell watcher detects → kills Node → restarts
```

## Migration System

**Folder:** `migrations/` with numbered SQL files (e.g., `001_initial.sql`)

**Runner:** `scripts/run-migrations.js`
1. Check if `schema_migrations` table exists (bootstrap if not)
2. Scan `migrations/` for `*.sql` files
3. Query `schema_migrations` for applied versions
4. Run pending migrations in numerical order
5. Insert record per applied migration
6. On failure: stop + report error

## Restart Mechanism

**`scripts/restart-watcher.ps1`** — runs alongside Node.js:
- Watches for `.restart-trigger` file every 5 seconds
- When detected: remove file, kill Node, sleep 2s, start Node
- Launched by `scripts/start-hmi.ps1` as background job

**`scripts/start-hmi.ps1`** — production entry point:
- Starts restart-watcher as hidden background process
- Runs `npm run start` (Next.js production)

## Frontend UI

### TopNav Version Badge
- Shows `v1.0.0` in TopNav next to sync indicator
- Amber pulsing dot when update available
- Click navigates to `/super-admin/system-update`

### Toast on Admin Login
- Check for updates on superadmin login
- Show toast: "Update Available: v1.1.0 ready (3 commits)"
- Hourly background check while logged in

### System Update Page (`/super-admin/system-update`)

Three states:
1. **Up to date** — Current version card + update history table
2. **Update available** — Version comparison, changelog (git log), preflight checks (DB, migrations, dependencies, production lines), "UPDATE TO v1.x.0" button
3. **Updating** — Terminal-style output with SSE stream, typing animation, scanline overlay, progress bar. Amber/green monospace text on void background.

## Version Detection Flow

1. `GET /api/system/check-update` runs `git fetch origin production --tags`
2. Compares local tag (from `git describe --tags --abbrev=0`) vs latest remote tag
3. Returns: `{ currentVersion, latestVersion, isUpdateAvailable, commitsBehind, changelog: [...] }`
4. Changelog extracted from `git log v1.0.0..v1.1.0 --oneline`

## Safety Checks (Pre-Update)

1. Query all line-states from in-memory Map
2. If ANY line has `processStatus === 'RUNNING'`:
   - Block update
   - Return list of active lines with operator names
   - Toast: "Stop all production lines before updating"
3. If all lines idle/stopped → proceed

## Data Integration Map

| Component | Data Source | Existing? | Notes |
|---|---|---|---|
| Version badge (TopNav) | `GET /api/system/version` | No | Reads package.json |
| Update check | `GET /api/system/check-update` | No | git fetch + compare |
| Production safety | Line State API (in-memory Map) | Yes | Check processStatus |
| Update pipeline | `POST /api/system/update` | No | Spawns child processes |
| Progress stream | SSE from update process | No | Real-time terminal output |
| Migration runner | `scripts/run-migrations.js` | No | Scans migrations/ folder |
| Update history | `update_log` table | No | New DB table |
| Migration tracking | `schema_migrations` table | No | New DB table |
| Restart | `scripts/restart-watcher.ps1` | No | PowerShell file watcher |
| Auth check | `useAuth().isSuperAdmin` | Yes | Role gate |

## File Inventory

### New Files
```
app/super-admin/system-update/page.js
app/super-admin/system-update/loading.js
app/api/system/version/route.js
app/api/system/check-update/route.js
app/api/system/update/route.js
app/api/system/update/progress/route.js
app/api/system/update/history/route.js
app/api/system/migrations/pending/route.js
components/system-update/UpdateTerminal.jsx
components/system-update/VersionBadge.jsx
hooks/useSystemUpdate.js
scripts/run-migrations.js
scripts/restart-watcher.ps1
scripts/start-hmi.ps1
migrations/001_create_schema_migrations.sql
migrations/002_create_update_log.sql
```

### Modified Files
```
components/layout/TopNav.jsx          ← Add VersionBadge
context/AuthContext.jsx               ← Version check on superadmin login
package.json                          ← Ensure version field
i18n/en.json + id.json               ← New translation keys
CLAUDE.md                            ← Document OTA system
```

## Implementation Phases

### Phase 1: Foundation
- Create `production` branch + tag v1.0.0
- Create DB tables (schema_migrations, update_log)
- Bootstrap migration runner (scripts/run-migrations.js)
- API: `/api/system/version`

### Phase 2: Version Detection
- API: `/api/system/check-update`
- Hook: `useSystemUpdate` (polling + state)
- TopNav: VersionBadge component
- AuthContext: check on superadmin login

### Phase 3: Update Pipeline
- API: `/api/system/update` + `/api/system/update/progress` (SSE)
- Safety check (line-state query)
- Git pull + npm install + migration runner + build
- Update log DB writes

### Phase 4: Frontend UI
- `/super-admin/system-update` page (3 states)
- UpdateTerminal component (SSE consumer, typing animation)
- Preflight check display
- Changelog display
- Update history table

### Phase 5: Restart Mechanism
- `scripts/start-hmi.ps1` (production entry point)
- `scripts/restart-watcher.ps1` (file watcher)
- Restart trigger from update API

### Phase 6: Polish
- i18n translations (en + id)
- Error handling + rollback hints
- CLAUDE.md documentation
- Testing on production-like environment
