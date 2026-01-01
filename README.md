# INDUSIA AI HMI

A comprehensive Human-Machine Interface (HMI) system for AI-powered visual inspection in PCB manufacturing. Built with Next.js 13.5 and Supabase.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [User Roles & RBAC](#user-roles--rbac)
- [Core Features](#core-features)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Testing](#testing)
- [Security](#security)
- [Internationalization](#internationalization)
- [Design System](#design-system)
- [Recent Updates](#recent-updates)
- [Development Phases](#development-phases)

---

## Recent Updates

### Pre-Phase: HMI Operator Components (2025-01-01)

**New Features:**
- Full-screen operator inspection mode with minimal distractions
- Auto-approve timer with 15-second countdown
- Pause/Resume functionality for operator breaks
- Dark/Light theme toggle (ISA-101 compliant)
- Role-based layout management

**New Components:**
- `components/inspection/HMIOperatorView.jsx` — Main operator fullscreen interface
- `components/inspection/HMIActionPanel.jsx` — AI detection card + action buttons
- `components/inspection/HMITimer.jsx` — Circular countdown timer

**New Hooks:**
- `hooks/useHMILayout.js` — Role-based layout switching (sidebar, header, theme)

**Keyboard Shortcuts:**
| Key | Action |
|-----|--------|
| `A` | Approve |
| `R` | Reject |
| `F` | False Call |
| `Space` | Pause/Resume |
| `Esc` | Exit fullscreen |

---

## Development Phases

Implementation prompts stored in `.claude/prompts/`:

| Phase | File | Status | Description |
|-------|------|--------|-------------|
| 1 | `phase-1-dashboard-backend.md` | ✅ Done | Dashboard KPIs backend |
| 2 | `phase-2-dashboard-frontend.md` | ✅ Done | Dashboard charts & components |
| 3 | `phase-3-override-annotation.md` | ✅ Done | Override annotation canvas |
| 4 | `phase-4-live-inspection.md` | ✅ Done | Live inspection SSE + overlay |
| 5 | `phase-5-operator-page.md` | 🔲 Pending | HMI Operator page route |
| 6 | `phase-6-inspection-api.md` | 🔲 Pending | Inspection action API |

---

## Overview

INDUSIA AI HMI is an end-to-end platform for managing AI-powered PCB visual inspections on the manufacturing floor. The system connects operators, managers, engineers, and administrators through role-specific interfaces.

### Key Modules

| Module | Description |
|--------|-------------|
| **Operator HMI** | Real-time inspection interface, submit false call overrides |
| **Manager Console** | Review queue for approving/rejecting operator overrides |
| **Engineering Console** | Master data management (customers, lines, boards, models) |
| **Admin Panel** | User management, role configuration, permissions |
| **Dashboard** | Analytics with KPIs, defect heatmaps, Pareto charts, trends |
| **System Health** | Real-time monitoring of AI models, cameras, cloud connectivity |
| **Event Log** | Comprehensive activity tracking with export functionality |
| **Notifications** | In-app alerts for workflows, system events, overrides |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | Next.js 13.5 (App Router) | Full-stack React framework |
| **UI Library** | React 18 | Component-based UI |
| **Styling** | Tailwind CSS 3.3 | Utility-first CSS |
| **UI Components** | shadcn/ui + Radix UI | Accessible component primitives |
| **State Management** | React Context + Custom Hooks | Client-side state |
| **Database** | Supabase (PostgreSQL) | Backend-as-a-Service |
| **Real-time** | Supabase Realtime | WebSocket subscriptions |
| **Validation** | Zod 3.25 | Schema validation |
| **Forms** | React Hook Form 7.53 | Form management |
| **Charts** | Recharts 2.12 | Data visualization |
| **Date Utilities** | date-fns 3.6 | Date formatting/manipulation |
| **Icons** | Lucide React | Icon library |
| **Password Hashing** | bcrypt 6.0 | Secure password storage |
| **Unit Testing** | Jest 30 + Testing Library | Component & hook testing |
| **E2E Testing** | Playwright 1.57 | End-to-end testing |
| **TypeScript** | 5.2 | Type safety (partial adoption) |

---

## Architecture

### Three-Tier Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   Pages     │───▶│   Hooks     │───▶│   React Contexts    │  │
│  │  (app/)     │    │  (hooks/)   │    │    (context/)       │  │
│  └─────────────┘    └──────┬──────┘    └─────────────────────┘  │
└────────────────────────────┼────────────────────────────────────┘
                             │ fetch
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API LAYER                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 API Routes (app/api/)                    │    │
│  │  • Authentication via withAuth() middleware              │    │
│  │  • Zod schema validation                                 │    │
│  │  • Input sanitization (XSS, SQL injection prevention)    │    │
│  │  • Permission-based access control                       │    │
│  └────────────────────────┬────────────────────────────────┘    │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    REPOSITORY LAYER                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Repositories (lib/repos/)                   │    │
│  │  • Direct Supabase queries                               │    │
│  │  • Case conversion (camelCase ↔ snake_case)              │    │
│  │  • Consistent error handling                             │    │
│  └────────────────────────┬────────────────────────────────┘    │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SUPABASE                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │ PostgreSQL │  │  Realtime  │  │   Storage  │                 │
│  └────────────┘  └────────────┘  └────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

### Context Provider Hierarchy

```jsx
<AuthProvider>                    // User authentication & session
  <I18nProvider>                  // Internationalization (EN/ID)
    <HelpOverlayProvider>         // Context-aware help overlays
      <NotificationProvider>      // In-app notifications
        <SystemHealthProvider>    // System status monitoring
          {children}
        </SystemHealthProvider>
      </NotificationProvider>
    </HelpOverlayProvider>
  </I18nProvider>
</AuthProvider>
```

---

## Project Structure

```
indusia-ai-hmi/
│
├── app/                              # Next.js App Router
│   ├── api/                          # RESTful API routes (50+ endpoints)
│   │   ├── auth/                     # login, logout, change-password, me
│   │   ├── overrides/                # CRUD + stats
│   │   ├── master-data/              # customers, sections, lines, boards
│   │   ├── dashboard/                # summary, heatmap, pareto, trend
│   │   ├── event-log/                # Event log with filters
│   │   ├── notifications/            # Notification management
│   │   ├── users/                    # User CRUD
│   │   ├── roles/                    # Role CRUD
│   │   ├── permissions/              # Permission management
│   │   ├── models/                   # AI model deployment & history
│   │   ├── images/                   # Image upload/storage
│   │   ├── defect-classes/           # Defect classification
│   │   ├── dataset-queue/            # Dataset management
│   │   └── live/                     # Real-time inspection data
│   │
│   ├── dashboard/                    # Analytics dashboard page
│   ├── inspection/
│   │   ├── result/[id]/              # Inspection result detail
│   │   ├── live/                     # Live inspection view
│   │   └── overrides/                # Manager override queue
│   ├── engineering/
│   │   └── master-data/              # Master data management
│   ├── event-log/                    # Event log viewer
│   ├── super-admin/
│   │   ├── users/                    # User management
│   │   ├── roles/                    # Role management
│   │   └── permissions/              # Permission management
│   ├── settings/
│   │   └── sync/                     # Sync configuration
│   ├── login/                        # Authentication page
│   │
│   ├── layout.js                     # Root layout (metadata, fonts)
│   ├── layout-client.jsx             # Client layout with providers
│   └── page.js                       # Home/dashboard
│
├── components/                       # 100+ React components
│   ├── ui/                           # shadcn/ui primitives (40+ components)
│   ├── common/                       # Reusable UI (Card, Badge, EmptyState, etc.)
│   ├── layout/                       # SideNav, TopNav
│   ├── dashboard/                    # KPI cards, charts, heatmap
│   ├── inspection/                   # Detection overlay, modals
│   ├── override/                     # Override-specific components
│   ├── notifications/                # Bell, drawer, filters
│   ├── event-log/                    # Table, filters, summary
│   ├── system/                       # Health bar, status chips
│   ├── sync/                         # Sync progress, queue
│   └── help/                         # Help overlay, shortcuts
│
├── context/                          # React Contexts
│   ├── AuthContext.jsx               # User auth, role, session
│   ├── SystemHealthContext.jsx       # System component status
│   ├── NotificationContext.jsx       # Notifications, realtime
│   ├── HelpOverlayContext.jsx        # Help overlays, shortcuts
│   └── I18nContext.jsx               # Language, translations
│
├── hooks/                            # 21 Custom Hooks
│   ├── useAuth.js                    # Auth context hook
│   ├── useOverrides.js               # Override CRUD
│   ├── useMasterData.js              # Master data fetching
│   ├── useUsers.js                   # User management
│   ├── useRoles.js                   # Role management
│   ├── usePermissions.js             # Permission management
│   ├── useModels.js                  # AI model management
│   ├── useEventLog.js                # Event log with export
│   ├── useNotifications.js           # Notification management
│   ├── useDashboard.js               # Analytics data
│   ├── useImageUpload.js             # Image storage
│   ├── useLiveInspection.js          # Real-time inspection
│   ├── useSystemHealth.js            # System status
│   └── useI18n.js                    # Translation helper
│
├── lib/                              # Utilities & Services
│   ├── repos/                        # Repository layer (16 modules)
│   │   ├── index.js                  # Helpers (case conversion, error handling)
│   │   ├── overridesRepo.js
│   │   ├── usersRepo.js
│   │   ├── rolesRepo.js
│   │   ├── permissionsRepo.js
│   │   ├── masterDataRepo.js
│   │   ├── eventLogRepo.js
│   │   ├── notificationsRepo.js
│   │   ├── modelsRepo.js
│   │   ├── dashboardRepo.js
│   │   ├── inspectionFramesRepo.js
│   │   ├── inspectionStatsRepo.js
│   │   ├── defectClassesRepo.js
│   │   ├── datasetQueueRepo.js
│   │   └── shiftConfigRepo.js
│   │
│   ├── auth/                         # Authentication & RBAC
│   │   ├── apiAuth.js                # withAuth() middleware
│   │   ├── rbac.js                   # Permission checking
│   │   └── sectionAccess.js          # Section-based access
│   │
│   ├── validations/                  # Input Validation
│   │   ├── schemas.js                # Zod schemas
│   │   └── validate.js               # Validation helpers
│   │
│   ├── utils/
│   │   ├── sanitize.js               # XSS, SQL injection prevention
│   │   ├── password.js               # Password hashing
│   │   └── authFetch.js              # Authenticated fetch wrapper
│   │
│   ├── realtime/                     # Supabase realtime subscriptions
│   ├── supabase/                     # Supabase client config
│   ├── supabaseClient.js             # Main Supabase client
│   ├── eventLogger.js                # Event logging utilities
│   └── utils.ts                      # General utilities (cn, etc.)
│
├── data/                             # Mock/Fallback Data
│   ├── masterData.js                 # Master data seed
│   ├── mockEvents.js                 # Event log samples
│   └── mockNotifications.js          # Notification samples
│
├── i18n/                             # Internationalization
│   ├── en.json                       # English translations
│   └── id.json                       # Indonesian translations
│
├── .claude/sql/                      # Database Scripts
│   ├── indusia_supabase_setup.sql    # Complete schema (v3)
│   ├── indusia_seed_data.sql         # Initial data
│   └── indusia_truncate_all.sql      # Database cleanup
│
├── scripts/                          # Utility Scripts
│   ├── generatePasswordHashes.js     # Password hashing utility
│   └── mockLiveData.js               # Mock data generator
│
├── __tests__/                        # Test suites
├── e2e/                              # Playwright E2E tests
│
├── middleware.js                     # Security headers, CORS
├── tailwind.config.js                # Tailwind + INDUSIA theme
├── next.config.js                    # Next.js configuration
├── jest.config.js                    # Jest configuration
├── playwright.config.js              # Playwright configuration
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase project (for production)

### Installation

```bash
# Clone repository
git clone <repo-url>
cd indusia-ai-hmi

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### Environment Variables

Create `.env` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@indusia.ai | admin123 |
| Manager | manager@indusia.ai | manager123 |
| Engineer | engineer@indusia.ai | engineer123 |
| Operator | operator@indusia.ai | operator123 |

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm test` | Run Jest unit tests |
| `npm run test:watch` | Jest in watch mode |
| `npm run test:coverage` | Jest with coverage report |
| `npm run test:e2e` | Run Playwright E2E tests (headless) |
| `npm run test:e2e:headed` | E2E tests with browser visible |
| `npm run test:e2e:ui` | Playwright interactive UI mode |

---

## User Roles & RBAC

### Role Definitions

| Role | Access Level | Capabilities |
|------|--------------|--------------|
| **Operator** | Basic | View inspections, submit false call overrides |
| **Manager** | Intermediate | Review overrides, approve/reject, view reports |
| **Engineer** | Advanced | Master data CRUD, model management, sync config |
| **Super Admin** | Full | All features + user/role/permission management |

### Permission Format

Permissions follow the `resource:action` pattern:

```
users:read        # View users
users:create      # Create users
users:update      # Update users
users:delete      # Delete users
overrides:create  # Submit overrides
overrides:review  # Approve/reject overrides
models:deploy     # Deploy AI models
```

### Route Protection

Routes are protected based on user roles. Navigation items are filtered by `SideNav.jsx` according to the user's role. Each API route uses the `withAuth()` middleware to verify permissions.

---

## Core Features

### 1. False Call Override Workflow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    OPERATOR     │     │    MANAGER      │     │    SYSTEM       │
│                 │     │                 │     │                 │
│  Submits false  │────▶│  Reviews in     │────▶│  Creates event  │
│  call override  │     │  override queue │     │  log entry      │
│  (status:       │     │                 │     │                 │
│   pending)      │     │  Approves or    │     │  Sends          │
│                 │     │  rejects        │     │  notification   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 2. System Health Monitoring

Monitors these components in real-time (15-second refresh):

| Component | Description |
|-----------|-------------|
| `aiModel` | AI model status and performance |
| `camera` | Camera connectivity |
| `cloud` | Cloud service connectivity |
| `lineRuntime` | Production line status |
| `lastSync` | Last sync operation status |

Status values: `ok` | `warning` | `error` | `offline` | `degraded` | `unknown` | `in-progress`

### 3. Dashboard Analytics

- **KPI Grid**: Key performance metrics
- **Defect Heatmap**: Spatial defect distribution
- **Pareto Chart**: Root cause analysis
- **Trend Chart**: Defect trends over time

### 4. Event Log System

Tracks all system activities:

- Login/logout events
- Override submissions and reviews
- Sync operations
- Training jobs
- System errors

Features: Filtering, pagination, CSV export

### 5. Notification System

Types:
- **System**: Infrastructure alerts
- **Workflow**: Process updates
- **Alert**: Critical notifications

Severities: `info` | `warning` | `error` | `success`

### 6. Help Overlay System

Press `?` to toggle context-aware help overlays. Contexts automatically detected from route:

- Global (all pages)
- HMI (inspection pages)
- Manager (override review)
- Engineer (master data)
- SuperAdmin (admin pages)

---

## API Endpoints

### Authentication (4 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| POST | `/api/auth/change-password` | Change password |
| GET | `/api/auth/me` | Get current user |

### Overrides (4 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/overrides` | List overrides with filters |
| POST | `/api/overrides` | Create override |
| PATCH | `/api/overrides/[id]` | Update override status |
| GET | `/api/overrides/stats` | Override statistics |

### Master Data (5 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/master-data/customers` | Customer CRUD |
| GET/POST | `/api/master-data/sections` | Section CRUD |
| GET/POST | `/api/master-data/lines` | Line CRUD |
| GET/POST | `/api/master-data/boards` | Board CRUD |
| GET | `/api/master-data/menu-items` | Menu items |

### Dashboard (4 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/summary` | KPI summary |
| GET | `/api/dashboard/heatmap` | Defect heatmap data |
| GET | `/api/dashboard/pareto` | Pareto chart data |
| GET | `/api/dashboard/trend` | Trend chart data |

### Users, Roles, Permissions (6 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/users` | User list/create |
| GET/PATCH/DELETE | `/api/users/[id]` | User detail/update/delete |
| GET/POST | `/api/roles` | Role list/create |
| GET/PATCH/DELETE | `/api/roles/[id]` | Role detail/update/delete |
| GET | `/api/permissions` | Permission list |
| POST/PATCH | `/api/permissions/[roleId]` | Role permissions |

### Other Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/event-log` | Event log with filters |
| GET/PATCH | `/api/notifications` | Notification management |
| GET | `/api/models` | AI model list |
| POST | `/api/models/[id]/deploy` | Deploy model |
| POST | `/api/images/upload` | Image upload |
| GET/POST | `/api/defect-classes` | Defect classes |
| GET/POST | `/api/dataset-queue` | Dataset queue |
| GET | `/api/live/[lineId]` | Live inspection data |

---

## Database Schema

Key tables in the database:

### Master Data
- `customers` - Customer information
- `sections` - Factory sections
- `lines` - Production lines
- `boards` - Board/model definitions

### RBAC
- `users` - User accounts
- `roles` - Role definitions
- `role_menu_permissions` - Role-based menu access

### Operations
- `overrides` - False call override submissions
- `inspection_frames` - Inspection image frames
- `inspection_stats` - Inspection statistics

### Tracking
- `notifications` - In-app notifications
- `event_log` - System activity log
- `system_events` - Health monitoring events

### ML Pipeline
- `models` - AI model versions
- `dataset_queue` - Dataset management
- `defect_classes` - Defect classification

Full schema available in `.claude/sql/indusia_supabase_setup.sql`

---

## Testing

### Unit Tests (Jest)

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

Coverage collected from: `lib/`, `hooks/`, `components/`, `context/`, `app/api/`

### E2E Tests (Playwright)

```bash
# Headless
npm run test:e2e

# With browser
npm run test:e2e:headed

# Interactive UI
npm run test:e2e:ui
```

Reports generated in `playwright-report/`

---

## Security

### Implemented Measures

| Feature | Implementation |
|---------|----------------|
| **Auth Middleware** | `withAuth()` wrapper for API routes |
| **Permission Checking** | RBAC with `resource:action` permissions |
| **Input Validation** | Zod schemas for all API inputs |
| **Input Sanitization** | XSS, SQL injection, prototype pollution prevention |
| **Password Hashing** | bcrypt with salt rounds |
| **Security Headers** | X-Frame-Options, X-Content-Type-Options via middleware |
| **CORS** | Configured allowed origins |
| **Section Access** | Filtering data by user's assigned sections |

### API Route Pattern

```javascript
import { withAuth } from '@/lib/auth/apiAuth'
import { validate } from '@/lib/validations/validate'
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

// Wrap with auth + permission check
export const POST = withAuth('overrides:create')(handlePOST)
```

---

## Internationalization

Supported languages: English (EN) and Indonesian (ID)

### Usage

```jsx
import { useI18n } from '@/context/I18nContext'

function Component() {
  const { t, language, setLanguage } = useI18n()

  return (
    <div>
      <h1>{t('nav.dashboard')}</h1>
      <button onClick={() => setLanguage('id')}>
        Switch to Indonesian
      </button>
    </div>
  )
}
```

Translation files: `i18n/en.json`, `i18n/id.json`

---

## Design System

### INDUSIA Color Palette

```javascript
// tailwind.config.js
indusia: {
  bg: '#0A1628',           // Main background (dark blue)
  surface: '#1A2942',      // Card/panel background
  surfaceMuted: '#152033', // Subtle backgrounds
  primary: '#0FB5BA',      // Primary actions (teal)
  text: '#E8EDF2',         // Main text (light)
  textMuted: '#8A95A8',    // Secondary text
  pass: '#10B981',         // Success/pass (green)
  fail: '#EF4444',         // Error/fail (red)
  warning: '#F59E0B',      // Warning (amber)
  border: '#2D3E56',       // Borders
}
```

### Usage

```jsx
<div className="bg-indusia-bg text-indusia-text">
  <div className="bg-indusia-surface border border-indusia-border">
    <span className="text-indusia-primary">Primary text</span>
    <span className="text-indusia-pass">Pass</span>
    <span className="text-indusia-fail">Fail</span>
  </div>
</div>
```

### shadcn/ui Components

40+ accessible UI components built on Radix UI primitives:

- Dialog, AlertDialog, Sheet
- Select, Checkbox, RadioGroup, Switch
- Tabs, Accordion, Collapsible
- Avatar, Badge, Button, Card
- Menubar, DropdownMenu, ContextMenu
- Popover, Tooltip, HoverCard
- Progress, Slider, ScrollArea
- Toast, Sonner

---

## Documentation

- **CLAUDE.md** - Development guidelines for Claude Code
- **.claude/sql/** - Database setup and seed scripts

---

## License

Proprietary - INDUSIA AI
