# INDUSIA AI HMI

A comprehensive Human-Machine Interface (HMI) system for AI-powered visual inspection in PCB manufacturing. Built with Next.js 14 and Supabase, featuring SSE-based real-time inspection with GOOD/NG operator workflow.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Business Flow](#business-flow)
- [Work Order System](#work-order-system)
- [Inspection Flow](#inspection-flow)
- [PLC Integration](#plc-integration)
- [Image Storage Convention](#image-storage-convention)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [User Roles & RBAC](#user-roles--rbac)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Testing](#testing)
- [Security](#security)
- [Internationalization](#internationalization)
- [Design System](#design-system)
- [Recent Updates](#recent-updates)

---

## Overview

INDUSIA AI HMI is an end-to-end platform for managing AI-powered PCB visual inspections on the manufacturing floor. The system uses **Server-Sent Events (SSE)** for real-time communication between the AI Backend and the UI, with a simplified **GOOD/NG operator workflow**.

### Key Modules

| Module | Description |
|--------|-------------|
| **Operator HMI** | Real-time inspection interface with GOOD/NG decisions |
| **Work Order Management** | Production job tracking with lot size, side count, yield metrics |
| **Engineering Console** | Master data management (customers, lines, boards, models) |
| **Admin Panel** | User management, role configuration, permissions |
| **Dashboard** | Analytics with KPIs, defect heatmaps, Pareto charts, trends |
| **System Health** | Real-time monitoring of AI models, cameras, cloud connectivity |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | Next.js 14 (App Router) | Full-stack React framework |
| **Language** | JavaScript (ES6+) | No TypeScript |
| **UI Library** | React 18 | Component-based UI |
| **Styling** | Tailwind CSS 3.3 | Utility-first CSS |
| **UI Components** | shadcn/ui + Radix UI | Accessible component primitives |
| **Database** | Supabase (PostgreSQL + pgvector) | Backend-as-a-Service |
| **Real-time** | Server-Sent Events (SSE) | AI Backend → UI communication |
| **Validation** | Zod 3.25 | Schema validation |
| **Forms** | React Hook Form 7.53 | Form management |
| **Charts** | Recharts 2.12 | Data visualization |
| **Password Hashing** | bcrypt 6.0 | Secure password storage |
| **Unit Testing** | Jest 30 + Testing Library | Component & hook testing |
| **E2E Testing** | Playwright 1.57 | End-to-end testing |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SYSTEM ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐         SSE Events          ┌──────────────────┐  │
│  │                     │ ──────────────────────────▶ │                  │  │
│  │    AI Backend       │    • inspection             │   Next.js UI     │  │
│  │   (Python/FastAPI)  │    • hardware_status        │                  │  │
│  │                     │    • running_status         │  • LiveView      │  │
│  │   • Camera capture  │                             │  • Dashboard     │  │
│  │   • AI inference    │ ◀────────────────────────── │  • WO Mgmt       │  │
│  │   • PLC control     │      POST /confirm          │  • Admin         │  │
│  │   • Image storage   │      (operator decision)    │                  │  │
│  │                     │                             │                  │  │
│  └──────────┬──────────┘                             └────────┬─────────┘  │
│             │                                                  │            │
│             │           REST API (/api/ai/*)                   │            │
│             │ ◀────────────────────────────────────────────────┤            │
│             │                                                  │            │
│             └──────────────────────┬───────────────────────────┘            │
│                                    │                                        │
│                                    ▼                                        │
│                         ┌─────────────────────┐                             │
│                         │      Supabase       │                             │
│                         │    (PostgreSQL)     │                             │
│                         └─────────────────────┘                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Responsibility Split

| ✅ UI (Next.js) | ❌ AI Backend |
|-----------------|---------------|
| Display inspection results | Camera capture |
| Operator GOOD/NG confirmation | AI inference |
| Work Order management | PLC control (RS232) |
| Statistics & Dashboard | Image storage |
| User management & RBAC | Hardware monitoring |
| Log operator decisions | Conveyor control |

### Three-Tier Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   Pages     │───▶│   Hooks     │───▶│   React Contexts    │  │
│  │  (app/)     │    │  (hooks/)   │    │    (context/)       │  │
│  └─────────────┘    └──────┬──────┘    └─────────────────────┘  │
└────────────────────────────┼────────────────────────────────────┘
                             │ fetch / SSE
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API LAYER                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                 API Routes (app/api/)                        ││
│  │  • Authentication via withAuth() middleware                  ││
│  │  • API Key auth for AI Backend (withApiKeyAuth)              ││
│  │  • Zod schema validation                                     ││
│  │  • Input sanitization (XSS, SQL injection prevention)        ││
│  └────────────────────────┬────────────────────────────────────┘│
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    REPOSITORY LAYER                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Repositories (lib/repos/)                       ││
│  │  • Direct Supabase queries                                   ││
│  │  • Case conversion (camelCase ↔ snake_case)                  ││
│  └────────────────────────┬────────────────────────────────────┘│
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

---

## Business Flow

### Production Workflow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PRODUCTION WORKFLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. ENGINEERING creates Work Order (WO)                                     │
│     └── Customer, Board, Line, Lot Size, Side Count (1 or 2)               │
│                                                                             │
│  2. ENGINEERING assigns WO to Line and sets status = 'active'               │
│     └── Only ONE active WO per Line allowed                                 │
│                                                                             │
│  3. OPERATOR opens LiveView → System loads active WO                        │
│     └── Connects to AI Backend SSE stream                                   │
│                                                                             │
│  4. AI Backend sends SSE 'inspection' event                                 │
│     └── UI displays AI decision: PASS or FAIL                               │
│     └── If PASS: auto-proceed after 15 sec (or operator GOOD)               │
│     └── If FAIL: wait for operator decision (GOOD or NG)                    │
│                                                                             │
│  5. Operator clicks GOOD or NG                                              │
│     └── UI sends POST /confirm to AI Backend (triggers PLC)                 │
│     └── False call auto-calculated if operator disagrees with AI            │
│                                                                             │
│  6. PLC receives signal based on side_count and current side                │
│     └── If 2-side and current=TOP: FLIP_BOTTOM                              │
│     └── Else: NEXT_PCB                                                      │
│                                                                             │
│  7. WO completes when completed_qty >= lot_size                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Work Order System

### Work Order Fields

| Field | Type | Description |
|-------|------|-------------|
| `wo_number` | VARCHAR(30) | Unique WO number (format: `WO-YYYYMMDD-XXXX`) |
| `customer_id` | TEXT | Reference to customer |
| `board_id` | TEXT | Reference to board/PCB type |
| `line_id` | TEXT | Assigned production line |
| `lot_size` | INTEGER | Target quantity to produce |
| `side_count` | INTEGER | 1 = TOP only, 2 = TOP + BOTTOM |
| `completed_qty` | INTEGER | Boards fully inspected |
| `good_qty` | INTEGER | GOOD after operator confirmation |
| `ng_qty` | INTEGER | NG after operator confirmation |
| `false_call_qty` | INTEGER | AI errors (auto-calculated) |
| `status` | VARCHAR | `draft` → `ready` → `active` → `completed` → `closed` |

### Work Order Number Format

```
WO-YYYYMMDD-XXXX

Example: WO-20260103-0001
         │  │        │
         │  │        └── Sequential number (4 digits)
         │  └─────────── Date (YYYYMMDD)
         └────────────── Prefix
```

### YIELD Calculation

```
YIELD = (good_qty / completed_qty) × 100%

Where:
- good_qty = Boards confirmed GOOD by operator
- completed_qty = Total boards that completed full inspection cycle

Note: YIELD is based on FINAL operator-confirmed results, not AI detection alone.
```

---

## Inspection Flow

### Terminology

| Layer | Term | Values | Description |
|-------|------|--------|-------------|
| AI Backend | `decision` | `PASS` / `FAIL` | AI detection result |
| Operator | `operator_decision` | `GOOD` / `NG` | Operator confirmation |

### Operator Decision Buttons

| Button | Shortcut | Color | Action |
|--------|----------|-------|--------|
| **GOOD** | `G` | Green `#10B981` | Board passes, confirm result |
| **NG** | `N` | Red `#EF4444` | Board rejected, confirm defect |

### False Call Auto-Detection

False call is **automatically calculated** when operator disagrees with AI:

```javascript
const isFalseCall = 
  (aiDecision === 'PASS' && operatorDecision === 'NG') ||
  (aiDecision === 'FAIL' && operatorDecision === 'GOOD')
```

### Decision Matrix

| AI Decision | Operator Click | Result | Is False Call |
|-------------|----------------|--------|---------------|
| PASS | GOOD | Board passes | No |
| PASS | NG | Board rejected | **Yes** (AI missed defect) |
| FAIL | GOOD | Board passes | **Yes** (AI false positive) |
| FAIL | NG | Board rejected | No |

### Detection Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INSPECTION FLOW (SSE-Based)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  AI Backend ──── SSE: inspection event ────▶ UI                             │
│       │                                       │                             │
│       │                                       ├── AI Result: PASS           │
│       │                                       │   │                         │
│       │                                       │   └── 15 sec countdown      │
│       │                                       │       ├── Operator: GOOD ───┤
│       │                                       │       └── Auto-proceed ─────┤
│       │                                       │                             │
│       │                                       └── AI Result: FAIL           │
│       │                                           │                         │
│       │                                           └── Wait for operator     │
│       │                                               ├── GOOD (false call)─┤
│       │                                               └── NG (confirm) ─────┤
│       │                                                                     │
│       │◀────── POST /confirm (operator_decision) ───────────────────────────┤
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         PLC SIGNAL                                   │    │
│  │  • side_count=2 && side=TOP → FLIP_BOTTOM                           │    │
│  │  • otherwise → NEXT_PCB                                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### False Call Reasons

When false call is detected, operator selects reason:

| Code | Description |
|------|-------------|
| `REFLECTION` | Lighting reflection causing false detection |
| `ACCEPTABLE_VARIATION` | Within acceptable tolerance per IPC standard |
| `WRONG_CLASSIFICATION` | AI detected wrong defect type |
| `NORMAL_SOLDER` | Normal solder joint misidentified |
| `OTHER` | Other reason (requires notes) |

---

## PLC Integration

### Responsibility

**AI Backend handles all PLC communication** via Serial RS232. The UI sends operator decisions to AI Backend, which then controls the PLC.

### PLC Signals

| Signal | Description | When Sent |
|--------|-------------|-----------|
| `PASS` | Board passed inspection | Operator: GOOD |
| `REJECT` | Board failed inspection | Operator: NG |
| `FLIP_BOTTOM` | Flip board to inspect bottom | After TOP, if side_count=2 |
| `NEXT_PCB` | Proceed to next board | After full cycle complete |

### Signal Flow

```
UI                          AI Backend                    PLC
 │                              │                          │
 │── POST /confirm ────────────▶│                          │
 │   (operator_decision: GOOD)  │                          │
 │                              │── RS232 Signal ─────────▶│
 │                              │   (PASS/REJECT/FLIP)     │
 │◀── Response ─────────────────│                          │
 │                              │                          │
```

---

## Image Storage Convention

### Folder Structure

```
/inspection-images/
  └── {WO_NUMBER}/
      └── {BOARD_SEQUENCE}/
          ├── {timestamp}_{side}_{result}_{model}_{customer}_full.png
          └── {timestamp}_{side}_{result}_{model}_{customer}_crop_{defect}.png
```

### Filename Format

```
{YYYYMMDD}_{HHmmss}_{SIDE}_{RESULT}_{MODEL}_{CUSTOMER}_{TYPE}[_{DEFECT}].png

Components:
├── YYYYMMDD      Date (e.g., 20260103)
├── HHmmss        Time (e.g., 143052)
├── SIDE          TOP or BOT
├── RESULT        GOOD, NG, or FC (False Call)
├── MODEL         AI model version (e.g., v1.2.3)
├── CUSTOMER      Customer code (e.g., ACME)
├── TYPE          full or crop
└── DEFECT        Defect type (only for crop, e.g., solder_bridge)
```

### Examples

```
WO-20260103-0001/
├── 0001/
│   ├── 20260103_143052_TOP_GOOD_v1.2.3_ACME_full.png
│   └── 20260103_143127_BOT_GOOD_v1.2.3_ACME_full.png
├── 0002/
│   ├── 20260103_143205_TOP_NG_v1.2.3_ACME_full.png
│   ├── 20260103_143205_TOP_NG_v1.2.3_ACME_crop_solder_bridge.png
│   └── 20260103_143245_BOT_GOOD_v1.2.3_ACME_full.png
├── 0003/
│   ├── 20260103_143312_TOP_FC_v1.2.3_ACME_full.png
│   ├── 20260103_143312_TOP_FC_v1.2.3_ACME_crop_tombstone.png
│   └── 20260103_143358_BOT_GOOD_v1.2.3_ACME_full.png
```

---

## Project Structure

```
indusia-ai-hmi/
│
├── app/                              # Next.js App Router
│   ├── api/                          # RESTful API routes
│   │   ├── ai/                       # AI Backend API (33+ endpoints)
│   │   │   ├── inspections/          # AI inspection results
│   │   │   ├── models/               # Model registry
│   │   │   ├── training-jobs/        # Training pipeline
│   │   │   └── system-status/        # Hardware status
│   │   ├── auth/                     # login, logout, change-password, me
│   │   ├── work-orders/              # Work order CRUD + active WO
│   │   ├── inspections/              # Inspection results + defects
│   │   ├── inspection/               # Session, action, stats
│   │   ├── master-data/              # customers, sections, lines, boards
│   │   ├── dashboard/                # summary, heatmap, pareto, trend
│   │   ├── users/                    # User CRUD
│   │   ├── roles/                    # Role CRUD
│   │   └── dev/                      # Development simulation endpoints
│   │
│   ├── dashboard/                    # Analytics dashboard
│   ├── inspection/
│   │   ├── live/[lineId]/            # Live inspection view (SSE consumer)
│   │   └── operator/                 # Fullscreen operator HMI
│   ├── engineering/
│   │   ├── master-data/              # Master data management
│   │   └── work-orders/              # Work order management
│   ├── super-admin/                  # User/role management
│   └── dev/simulation/               # SSE testing page
│
├── components/                       # React components
│   ├── ui/                           # shadcn/ui primitives
│   ├── inspection/                   # LiveView, DefectPanel, etc.
│   └── dashboard/                    # KPI cards, charts
│
├── lib/                              # Utilities & Services
│   ├── auth/                         # Auth middleware
│   │   ├── apiAuth.js                # withAuth() for user auth
│   │   └── apiKeyAuth.js             # withApiKeyAuth() for AI Backend
│   ├── repos/                        # Repository layer
│   │   ├── workOrderRepo.js          # Work order operations
│   │   ├── inspectionRepo.js         # Inspection results
│   │   ├── aiModelsRepo.js           # AI model registry
│   │   └── trainingJobsRepo.js       # Training jobs
│   ├── services/                     # Client-side services
│   │   ├── sseService.js             # SSE connection handler
│   │   ├── inspectionService.js      # Inspection API calls
│   │   └── imageService.js           # Image handling
│   ├── utils/
│   │   ├── apiResponse.js            # Standardized API responses
│   │   └── imageNaming.js            # Image filename generation
│   └── validations/                  # Zod schemas
│       └── aiSchemas.js              # AI Backend validation
│
├── hooks/                            # Custom React hooks
│   └── useLiveInspection.js          # SSE consumer hook
│
├── docs/                             # Documentation
│   ├── API_AI_BACKEND.md             # AI Backend API contract
│   ├── API_DOCUMENTATION.md          # Internal UI API
│   └── DATABASE_SCHEMA.md            # Database schema & ownership
│
├── .claude/
│   ├── prompts/                      # Development phase prompts
│   └── sql/                          # Database scripts
│
└── ...
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase project
- AI Backend (Python/FastAPI) running for full functionality

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

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# AI Backend Integration
AI_BACKEND_API_KEY=your-secure-api-key
AI_BACKEND_URL=http://localhost:8001
NEXT_PUBLIC_AI_BACKEND_SSE_URL=http://localhost:8001/sse
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo Credentials

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
| `npm test` | Run Jest unit tests |
| `npm run test:coverage` | Jest with coverage |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run test:e2e:ui` | Playwright UI mode |

---

## User Roles & RBAC

### Role Capabilities

| Role | Capabilities |
|------|--------------|
| **Operator** | View inspections, make GOOD/NG decisions |
| **Manager** | View reports, analytics, operator performance |
| **Engineer** | Master data CRUD, work order management, model config |
| **Super Admin** | All features + user/role/permission management |

### Permission Format

Pattern: `resource:action`

Examples: `users:read`, `work-orders:create`, `inspections:read`, `models:deploy`

---

## API Endpoints

### Internal UI API

| Category | Endpoints |
|----------|-----------|
| Auth | `/api/auth/{login,logout,change-password,me}` |
| Work Orders | `/api/work-orders/*` |
| Master Data | `/api/master-data/{customers,sections,lines,boards}` |
| Dashboard | `/api/dashboard/{summary,heatmap,pareto,trend}` |
| Inspections | `/api/inspection/*`, `/api/live/[lineId]` |
| Users/RBAC | `/api/users`, `/api/roles`, `/api/permissions` |
| System | `/api/system-health`, `/api/event-log` |

### AI Backend API

Authenticated via `X-API-Key` header.

| Category | Endpoints | Purpose |
|----------|-----------|---------|
| Inspections | `/api/ai/inspections/*` | AI detection results |
| Models | `/api/ai/models/*` | Model registry |
| Datasets | `/api/ai/dataset-images/*` | Training images |
| Training | `/api/ai/training-jobs/*` | Training pipeline |
| Metrics | `/api/ai/training-metrics/*` | Epoch metrics |
| Defects | `/api/ai/defect-classes` | Defect reference |
| False Call | `/api/ai/false-call-reasons` | Reason reference |
| System | `/api/ai/system-status` | Hardware status |

### SSE Events (from AI Backend)

| Event | Description |
|-------|-------------|
| `inspection` | AI detection results + images |
| `hardware_status` | Camera, PLC status |
| `running_status` | Conveyor stage |

---

## Database Schema

### Database Ownership Matrix

| Table | UI | AI Backend | Notes |
|-------|:--:|:----------:|-------|
| **Master Data** |
| `customers` | RW | R | |
| `boards` | RW | R | |
| `lines` | RW | R | |
| `sections` | RW | R | |
| **Production** |
| `work_orders` | RW | R | |
| **Inspection** |
| `inspection_results` | RW | RW | **SHARED** |
| `inspection_defects` | R | RW | AI writes bbox |
| `inspection_stats` | RW | R | |
| **Training Pipeline** |
| `ai_models` | R | RW | |
| `dataset_images` | R | RW | |
| `training_datasets` | R | RW | |
| `training_jobs` | R | RW | |
| `training_metrics` | R | RW | |
| **Auth/RBAC** |
| `users` | RW | - | |
| `roles` | RW | - | |
| **Reference** |
| `defect_classes` | RW | R | |
| `false_call_reasons` | RW | R | |
| `shift_config` | RW | R | |

**Legend:** R = Read, W = Write, RW = Read/Write, - = No access

### Key Relationships

```
work_orders
├── customer_id → customers.id
├── board_id → boards.id
├── line_id → lines.id
└── section_id → sections.id

inspection_results
├── work_order_id → work_orders.id
├── line_id → lines.id
├── operator_id → users.id
└── inspection_defects (1:many)

inspection_defects
├── inspection_id → inspection_results.id
├── defect_class_id → defect_classes.id
└── false_call_reason_id → false_call_reasons.id
```

### Schema Files

Located in `.claude/sql/`:
- `indusia_supabase_setup.sql` - Complete schema
- `013-work-orders-cleanup.sql` - Work order table + migrations
- `007-inspection-results.sql` - Inspection tables
- `022-ai-backend-indexes.sql` - AI Backend indexes
- `023-training-pipeline-constraints.sql` - FK constraints

---

## Testing

### Unit Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```

### E2E Tests

```bash
npm run test:e2e      # Headless
npm run test:e2e:ui   # Interactive UI
```

### Development Simulation

When AI Backend is not available, use dev simulation:

```bash
# SSE simulation
curl http://localhost:3000/api/dev/sse/line-1

# Single inspection
curl http://localhost:3000/api/dev/inspection?decision=FAIL

# Confirm (GOOD/NG)
curl -X POST http://localhost:3000/api/dev/confirm \
  -H "Content-Type: application/json" \
  -d '{"inspection_id":"insp-123","ai_decision":"FAIL","operator_decision":"GOOD"}'
```

---

## Security

| Feature | Implementation |
|---------|----------------|
| **User Auth Middleware** | `withAuth()` wrapper for API routes |
| **API Key Auth** | `withApiKeyAuth()` for AI Backend routes |
| **Permission Check** | RBAC with `resource:action` permissions |
| **Input Validation** | Zod schemas for all API inputs |
| **Input Sanitization** | XSS, SQL injection prevention |
| **Password Hashing** | bcrypt with salt rounds |
| **Security Headers** | X-Frame-Options, X-Content-Type-Options |

---

## Internationalization

Supported: English (EN), Indonesian (ID)

```jsx
import { useI18n } from '@/context/I18nContext'

function Component() {
  const { t, setLanguage } = useI18n()
  return <h1>{t('nav.dashboard')}</h1>
}
```

Translation files: `i18n/en.json`, `i18n/id.json`

---

## Design System

### HMI Design Guidelines (ISA-101)

| Rule | Specification |
|------|---------------|
| Background | Neutral gray `#E0E0E0` - color only for abnormal |
| Critical buttons | Min 30×30mm (~110px), 1-click access |
| Color + Shape | Never color alone; combine with icon/text |
| Refresh rate | Max 2×/sec for live data |

### Status Colors

| Status | Color | Shape |
|--------|-------|-------|
| PASS/GOOD | Green `#10B981` | Circle + ✓ |
| FAIL/NG | Red `#EF4444` | Diamond + ✗ |
| WARNING | Yellow `#F59E0B` | Square + ! |

### Confidence Display

| Range | Color | Action |
|-------|-------|--------|
| ≥85% | Green | Auto-proceed available |
| 60-84% | Yellow | Operator review |
| <60% | Red | Manual verification required |

---

## Recent Updates

### 2026-01-04: SSE Architecture & GOOD/NG Workflow

**Architecture Changes:**
- SSE-based real-time communication (AI Backend → UI)
- AI Backend handles PLC control via RS232
- Clear responsibility split between UI and AI Backend

**Operator Workflow:**
- Changed from APPROVE/FALSE CALL to **GOOD/NG** buttons
- False call now **auto-calculated** when operator disagrees with AI
- Simplified 2-button design for faster decisions

**API Changes:**
- Added `/api/ai/*` endpoints (33+ endpoints) for AI Backend
- Added `withApiKeyAuth()` middleware for API key authentication
- New SSE consumer hook `useLiveInspection()`

**Database Changes:**
- Added training pipeline tables (ai_models, training_jobs, etc.)
- Added ownership matrix (UI vs AI Backend access)
- Added system_status table for hardware monitoring

### 2026-01-03: Work Order System

**New Features:**
- Work Order management with lot size and side count
- Side tracking (TOP / BOTTOM) for 2-sided PCB
- Image naming convention with full metadata in filename
- PLC signal flow for FLIP_BOTTOM and NEXT_PCB

**Database Changes:**
- Added `work_orders` table
- Added `code` field to `customers` table
- Added `work_order_id`, `side`, `board_sequence` to `inspection_results`

---

## Documentation

| Document | Location | Description |
|----------|----------|-------------|
| API_AI_BACKEND.md | `docs/` | AI Backend API contract (33+ endpoints) |
| API_DOCUMENTATION.md | `docs/` | Internal UI API |
| DATABASE_SCHEMA.md | `docs/` | Database schema & ownership matrix |
| 01-hmi-design-reference.md | `.claude/` | ISA-101 HMI design guide |
| 02-indusia-project-reference-v2.md | `.claude/` | Project reference |
| Industrial_AOI_HMI_Design...md | `.claude/` | Industry best practices |

---

## License

Proprietary - INDUSIA AI
