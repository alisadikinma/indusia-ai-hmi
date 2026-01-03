# INDUSIA AI HMI

A comprehensive Human-Machine Interface (HMI) system for AI-powered visual inspection in PCB manufacturing. Built with Next.js 14 and Supabase.

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

INDUSIA AI HMI is an end-to-end platform for managing AI-powered PCB visual inspections on the manufacturing floor. The system connects operators, managers, engineers, and administrators through role-specific interfaces.

### Key Modules

| Module | Description |
|--------|-------------|
| **Operator HMI** | Real-time inspection interface with APPROVE/FALSE CALL decisions |
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
| **Validation** | Zod 3.25 | Schema validation |
| **Forms** | React Hook Form 7.53 | Form management |
| **Charts** | Recharts 2.12 | Data visualization |
| **Password Hashing** | bcrypt 6.0 | Secure password storage |
| **Unit Testing** | Jest 30 + Testing Library | Component & hook testing |
| **E2E Testing** | Playwright 1.57 | End-to-end testing |

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
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                 API Routes (app/api/)                        ││
│  │  • Authentication via withAuth() middleware                  ││
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
│     └── Shows WO info: target qty, progress, yield                          │
│                                                                             │
│  4. AI inspects PCB → GOOD or NG detection                                  │
│     └── If GOOD: auto-proceed after 15 sec (or operator APPROVE)            │
│     └── If NG: wait for operator decision (APPROVE or FALSE CALL)           │
│                                                                             │
│  5. PLC receives signal based on side_count and current side                │
│     └── If 2-side and current=TOP: FLIP_BOTTOM                              │
│     └── Else: NEXT_PCB                                                      │
│                                                                             │
│  6. WO completes when completed_qty >= lot_size                             │
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
| `false_call_qty` | INTEGER | AI errors (false positives) |
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
- good_qty = Boards confirmed GOOD by operator (AI GOOD + FALSE CALL on NG)
- completed_qty = Total boards that completed full inspection cycle

Note: YIELD is based on FINAL operator-confirmed results, not AI detection alone.
```

---

## Inspection Flow

### Operator Decision Buttons

| Button | Shortcut | Meaning | Action |
|--------|----------|---------|--------|
| **APPROVE** | `A` | AI detection is CORRECT | Confirm AI result (GOOD or NG) |
| **FALSE CALL** | `F` | AI detection is WRONG | Report AI error, requires reason |

**Note**: REJECT button removed. Use APPROVE for true NG, FALSE CALL for AI errors.

### Detection Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INSPECTION FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PCB Arrives → AI Inspection                                                │
│       │                                                                     │
│       ├── AI Result: GOOD ────────────────────────────────────────┐         │
│       │   │                                                       │         │
│       │   └── Show 15 seconds ──┬── Operator APPROVE ─────────────┤         │
│       │                         │                                 │         │
│       │                         └── Auto-proceed (timeout) ───────┤         │
│       │                                                           │         │
│       │                                                           ▼         │
│       │                                                    ┌──────────────┐ │
│       │                                                    │ good_qty++   │ │
│       │                                                    │ Check Side   │ │
│       │                                                    └──────┬───────┘ │
│       │                                                           │         │
│       └── AI Result: NG ──────────────────────────────────────────┤         │
│           │                                                       │         │
│           └── Show to Operator (wait indefinitely)                │         │
│               │                                                   │         │
│               ├── APPROVE (AI correct, true NG) ──────────────────┤         │
│               │   └── ng_qty++                                    │         │
│               │                                                   │         │
│               └── FALSE CALL (AI wrong, actually GOOD) ───────────┤         │
│                   └── Show reason modal                           │         │
│                   └── good_qty++, false_call_qty++                │         │
│                                                                   │         │
│                                                                   ▼         │
│                                                         ┌─────────────────┐ │
│                                                         │   SIDE LOGIC    │ │
│                                                         └────────┬────────┘ │
│                                                                  │          │
│       ┌──────────────────────────────────────────────────────────┤          │
│       │                                                          │          │
│       ▼                                                          ▼          │
│  ┌─────────────────────────────┐                    ┌────────────────────┐  │
│  │ side_count=2 && side=TOP    │                    │ side_count=1       │  │
│  │                             │                    │ OR side=BOTTOM     │  │
│  │ PLC: FLIP_BOTTOM            │                    │                    │  │
│  │ Set side = BOTTOM           │                    │ PLC: NEXT_PCB      │  │
│  │ Repeat inspection           │                    │ completed_qty++    │  │
│  └─────────────────────────────┘                    │ Next board         │  │
│                                                     └────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### False Call Reasons

| Code | Description |
|------|-------------|
| `REFLECTION` | Lighting reflection causing false detection |
| `ACCEPTABLE_VARIATION` | Within acceptable tolerance per IPC standard |
| `WRONG_CLASSIFICATION` | AI detected wrong defect type |
| `NORMAL_SOLDER` | Normal solder joint misidentified |
| `OTHER` | Other reason (requires notes) |

---

## PLC Integration

### PLC Signals

| Signal | Description | When Sent |
|--------|-------------|-----------|
| `GOOD` | Board passed inspection | AI GOOD + operator confirm |
| `NG` | Board failed inspection | AI NG + operator APPROVE (confirm defect) |
| `FLIP_BOTTOM` | Flip board to inspect bottom | After TOP inspection, if side_count=2 |
| `NEXT_PCB` | Proceed to next board | After full inspection cycle complete |

### Signal Flow

```javascript
// After operator decision
if (side_count === 2 && current_side === 'TOP') {
  // Send flip signal, inspect bottom
  await signalFlipBottom(lineId, boardId);
  setCurrentSide('BOTTOM');
} else {
  // Full cycle complete
  await signalNextPCB(lineId, boardId);
  updateWOCounters();
  completed_qty++;
}
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

### Parsing Filename

Reading the filename immediately tells you:
- **When**: 2026-01-03 at 14:30:52
- **Which side**: TOP or BOTTOM
- **Result**: GOOD, NG, or False Call
- **AI Model**: v1.2.3
- **Customer**: ACME
- **Image type**: Full board or cropped defect
- **Defect type**: (if crop) solder_bridge, tombstone, etc.

---

## Project Structure

```
indusia-ai-hmi/
│
├── app/                              # Next.js App Router
│   ├── api/                          # RESTful API routes
│   │   ├── auth/                     # login, logout, change-password, me
│   │   ├── work-orders/              # Work order CRUD + active WO
│   │   ├── inspections/              # Inspection results + defects
│   │   ├── inspection/               # Session, action, stats
│   │   ├── master-data/              # customers, sections, lines, boards
│   │   ├── dashboard/                # summary, heatmap, pareto, trend
│   │   ├── users/                    # User CRUD
│   │   ├── roles/                    # Role CRUD
│   │   ├── plc/                      # PLC signal endpoint
│   │   └── ...
│   │
│   ├── dashboard/                    # Analytics dashboard
│   ├── inspection/
│   │   ├── live/[lineId]/            # Live inspection view
│   │   └── operator/                 # Fullscreen operator HMI
│   ├── engineering/
│   │   ├── master-data/              # Master data management
│   │   └── work-orders/              # Work order management
│   └── super-admin/                  # User/role management
│
├── components/                       # React components
│   ├── ui/                           # shadcn/ui primitives
│   ├── inspection/                   # LiveView, DefectPanel, etc.
│   ├── dashboard/                    # KPI cards, charts
│   └── ...
│
├── lib/                              # Utilities & Services
│   ├── repos/                        # Repository layer
│   │   ├── workOrderRepo.js          # Work order operations
│   │   ├── inspectionRepo.js         # Inspection results
│   │   └── ...
│   ├── services/                     # Client-side services
│   │   ├── plcSignal.js              # PLC communication
│   │   ├── inspectionService.js      # Inspection API calls
│   │   └── imageService.js           # Image handling
│   ├── utils/
│   │   ├── imageNaming.js            # Image filename generation
│   │   └── ...
│   └── validations/                  # Zod schemas
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
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
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
| **Operator** | View inspections, make APPROVE/FALSE CALL decisions |
| **Manager** | View reports, analytics, operator performance |
| **Engineer** | Master data CRUD, work order management, model config |
| **Super Admin** | All features + user/role/permission management |

### Permission Format

Pattern: `resource:action`

Examples: `users:read`, `work-orders:create`, `inspections:read`, `models:deploy`

---

## API Endpoints

### Work Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/work-orders` | List work orders |
| POST | `/api/work-orders` | Create work order |
| GET | `/api/work-orders/[id]` | Get work order detail |
| PUT | `/api/work-orders/[id]` | Update work order |
| POST | `/api/work-orders/[id]/start` | Start work order (set active) |
| POST | `/api/work-orders/[id]/complete` | Complete work order |
| GET | `/api/work-orders/active/[lineId]` | Get active WO for line |

### Inspections

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inspections` | List inspection results |
| POST | `/api/inspections` | Save inspection result |
| GET | `/api/inspections/[id]` | Get inspection detail |
| GET | `/api/inspections/stats` | Get inspection statistics |
| GET | `/api/inspections/defect-classes` | Get defect class options |
| GET | `/api/inspections/false-call-reasons` | Get false call reasons |

### PLC

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/plc/signal` | Send PLC signal |

### Master Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/master-data/customers` | Customer CRUD |
| GET/POST | `/api/master-data/sections` | Section CRUD |
| GET/POST | `/api/master-data/lines` | Line CRUD |
| GET/POST | `/api/master-data/boards` | Board CRUD |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| GET | `/api/auth/me` | Get current user |

---

## Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `work_orders` | Production work orders with lot tracking |
| `inspection_results` | Individual inspection records |
| `inspection_defects` | Defects detected per inspection |
| `customers` | Customer master data (with `code` field) |
| `boards` | PCB/board type definitions |
| `lines` | Production lines |
| `sections` | Factory sections |
| `users` | User accounts |
| `roles` | Role definitions |
| `defect_classes` | Defect type master data |
| `false_call_reasons` | False call reason options |
| `sample_images` | Demo/test images for development |

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
- `008-seed-defect-data.sql` - Defect class seed data

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

---

## Security

| Feature | Implementation |
|---------|----------------|
| **Auth Middleware** | `withAuth()` wrapper for API routes |
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
| REVIEW | Yellow `#F59E0B` | Square + ? |

### Confidence Display

| Range | Color | Action |
|-------|-------|--------|
| ≥85% | Green | Auto-proceed available |
| 60-84% | Yellow | Operator review |
| <60% | Red | Manual verification required |

---

## Recent Updates

### 2026-01-03: Work Order System

**New Features:**
- Work Order management with lot size and side count
- 2-button operator flow (APPROVE / FALSE CALL)
- Side tracking (TOP / BOTTOM) for 2-sided PCB
- Updated YIELD calculation based on operator-confirmed results
- Image naming convention with full metadata in filename
- PLC signal flow for FLIP_BOTTOM and NEXT_PCB

**Database Changes:**
- Added `work_orders` table
- Added `code` field to `customers` table
- Added `work_order_id`, `side`, `board_sequence` to `inspection_results`
- Removed unused `inspection_frames` table

**API Changes:**
- New `/api/work-orders/*` endpoints
- Updated `/api/inspections` to include WO reference

---

## License

Proprietary - INDUSIA AI
