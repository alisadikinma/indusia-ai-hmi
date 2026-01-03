# INDUSIA AI HMI

A comprehensive Human-Machine Interface (HMI) system for AI-powered visual inspection in PCB manufacturing. Built with Next.js 14 and Supabase.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [Project Structure](#project-structure)
- [User Roles & RBAC](#user-roles--rbac)
- [Design System](#design-system)
- [Testing](#testing)
- [Recent Updates](#recent-updates)

---

## Overview

INDUSIA AI HMI is an end-to-end platform for managing AI-powered PCB visual inspections on the manufacturing floor. The system connects operators, managers, engineers, and administrators through role-specific interfaces.

### Key Modules

| Module | Description |
|--------|-------------|
| **Operator HMI** | Real-time inspection display with GOOD/NG operator decisions |
| **Work Order Management** | Production job tracking with lot size, yield metrics |
| **Engineering Console** | Master data management (customers, lines, boards) |
| **Admin Panel** | User management, role configuration, permissions |
| **Dashboard** | Analytics with KPIs, defect heatmaps, Pareto charts |
| **System Health** | Real-time monitoring of AI models, cameras, PLC |

### System Responsibilities

| ✅ UI (Next.js) | ❌ AI Backend |
|-----------------|---------------|
| Display inspection results | Camera capture |
| Operator GOOD/NG confirmation | AI inference |
| False call reason capture | PLC control |
| Work Order management | Image storage |
| Statistics & Dashboard | Labeling/annotation |
| User management & RBAC | Hardware monitoring |
| Log operator decisions | Conveyor control |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | Next.js 14 (App Router) | Full-stack React framework |
| **Language** | JavaScript (ES6+) | No TypeScript |
| **UI Library** | React 18 | Component-based UI |
| **Styling** | Tailwind CSS 3.3 | Utility-first CSS |
| **UI Components** | shadcn/ui + Radix UI | Accessible primitives |
| **Database** | Supabase (PostgreSQL) | Backend-as-a-Service |
| **Real-time** | Server-Sent Events (SSE) | AI Backend → UI streaming |
| **Validation** | Zod 3.25 | Schema validation |
| **Charts** | Recharts 2.12 | Data visualization |
| **Testing** | Jest + Playwright | Unit & E2E testing |

---

## Architecture

### System Overview

```
┌─────────────────┐      SSE Events      ┌─────────────────┐
│   AI Backend    │ ────────────────────▶│   UI (Next.js)  │
│                 │                      │                 │
│  • Camera       │      POST /confirm   │  • LiveView     │
│  • AI Inference │ ◀────────────────────│  • Dashboard    │
│  • PLC Control  │                      │  • WO Mgmt      │
│  • Image Store  │                      │  • Admin        │
└────────┬────────┘                      └────────┬────────┘
         │                                        │
         │      REST API (/api/ai/*)              │
         │ ◀──────────────────────────────────────┤
         │                                        │
         │                                        ▼
         │                               ┌─────────────────┐
         └──────────────────────────────▶│    Supabase     │
                   (via API)             │   (PostgreSQL)  │
                                         └─────────────────┘
```

### Data Flow

1. **AI Backend** captures image → runs inference → sends SSE `inspection` event
2. **UI** displays result → Operator clicks GOOD or NG
3. **UI** sends `POST /confirm` to AI Backend (PLC control)
4. **UI** updates Work Order counters in Supabase
5. **UI** logs inspection result to database

### SSE Events (AI Backend → UI)

| Event | Purpose |
|-------|---------|
| `inspection` | AI detection results + image URLs |
| `hardware_status` | Camera, PLC, AI Model status |
| `running_status` | Conveyor stage progress |

📄 **Full SSE Spec:** [docs/API_AI_BACKEND.md](docs/API_AI_BACKEND.md#sse-events-reference)

---

## Quick Start

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
cp .env.example .env.local
```

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
AI_BACKEND_API_KEY=your-ai-backend-api-key
AI_BACKEND_URL=http://localhost:8001
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

## Documentation

| Document | Description |
|----------|-------------|
| 📄 [API_AI_BACKEND.md](docs/API_AI_BACKEND.md) | AI Backend API Contract (SSE, REST endpoints) |
| 📄 [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Database tables, ownership, relationships |

### API Quick Reference

#### AI Backend → Database API

| Category | Endpoints | Purpose |
|----------|-----------|---------|
| Inspections | `/api/ai/inspections/*` | AI detection results |
| Models | `/api/ai/models/*` | Model registry |
| Datasets | `/api/ai/dataset-images/*` | Training images |
| Training | `/api/ai/training-jobs/*` | Training pipeline |
| System | `/api/ai/system-status` | Hardware status |

#### Internal UI API

| Category | Endpoints | Purpose |
|----------|-----------|---------|
| Work Orders | `/api/work-orders/*` | WO CRUD |
| Auth | `/api/auth/*` | Login, logout, session |
| Master Data | `/api/master-data/*` | Customers, lines, boards |
| Dashboard | `/api/dashboard/*` | Analytics data |

---

## Project Structure

```
indusia-ai-hmi/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── ai/                   # AI Backend API (protected)
│   │   ├── auth/                 # Authentication
│   │   ├── work-orders/          # Work Order CRUD
│   │   ├── master-data/          # Master data
│   │   └── dashboard/            # Analytics
│   ├── dashboard/                # Analytics pages
│   ├── inspection/               # LiveView, operator HMI
│   ├── engineering/              # Master data, work orders
│   └── super-admin/              # User/role management
│
├── components/                   # React components
│   ├── ui/                       # shadcn/ui primitives
│   ├── inspection/               # LiveView components
│   └── dashboard/                # KPI cards, charts
│
├── lib/                          # Utilities & Services
│   ├── repos/                    # Repository layer
│   ├── services/                 # SSE, API services
│   ├── validations/              # Zod schemas
│   └── auth/                     # Auth middleware
│
├── hooks/                        # Custom React hooks
├── context/                      # React contexts
├── docs/                         # Documentation
│   ├── API_AI_BACKEND.md         # AI Backend API Contract
│   └── DATABASE_SCHEMA.md        # Database schema
│
└── .claude/sql/                  # Database scripts
```

---

## User Roles & RBAC

| Role | Capabilities |
|------|--------------|
| **Operator** | View inspections, make GOOD/NG decisions |
| **Manager** | View reports, analytics, operator performance |
| **Engineer** | Master data CRUD, work order management |
| **Super Admin** | All features + user/role management |

### Permission Format

```
resource:action
```

Examples: `work-orders:create`, `inspections:read`, `users:delete`

---

## Design System

### HMI Guidelines (ISA-101)

| Rule | Specification |
|------|---------------|
| Background | Neutral gray `#E0E0E0` |
| Critical buttons | Min 30×30mm (~110px) |
| Color + Shape | Never color alone |

### Status Colors

| Status | Color | Shape |
|--------|-------|-------|
| PASS/GOOD | Green `#10B981` | Circle + ✓ |
| FAIL/NG | Red `#EF4444` | Diamond + ✗ |
| WARNING | Yellow `#F59E0B` | Square + ! |

### Operator Buttons

| Button | Color | Shortcut | Action |
|--------|-------|----------|--------|
| **GOOD** | Green | `G` | Board passed |
| **NG** | Red | `N` | Defect confirmed |

### False Call Logic

```javascript
// False call = Operator disagrees with AI
const isFalseCall = 
  (aiDecision === 'PASS' && operatorDecision === 'NG') ||
  (aiDecision === 'FAIL' && operatorDecision === 'GOOD')
```

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

## Recent Updates

### 2026-01-04: SSE Architecture Redesign

**Major Changes:**
- UI now receives inspection results via SSE from AI Backend
- PLC control moved to AI Backend
- Image storage handled by AI Backend
- New operator buttons: GOOD / NG (replaced APPROVE / FALSE CALL)

**New Documentation:**
- `docs/API_AI_BACKEND.md` — Full API contract for AI Backend
- `docs/DATABASE_SCHEMA.md` — Database ownership & schema

**New API Endpoints:**
- `/api/ai/*` — AI Backend API (33+ endpoints)
- SSE integration for real-time updates

### 2026-01-03: Work Order System

- Work Order management page
- 4-status workflow: draft → ready → active → completed
- Yield calculation from operator decisions
- Side tracking for 2-sided PCB inspection

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Jest unit tests |
| `npm run test:e2e` | Playwright E2E tests |

---

## License

Proprietary - INDUSIA AI
