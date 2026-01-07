# INDUSIA AI HMI

A comprehensive Human-Machine Interface (HMI) system for AI-powered visual inspection in PCB manufacturing. Built with Next.js 13.5 and Supabase, featuring SSE-based real-time inspection with GOOD/NG operator workflow.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Core Features](#core-features)
- [User Roles & RBAC](#user-roles--rbac)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Cloud Sync System](#cloud-sync-system)
- [Testing](#testing)
- [Security](#security)
- [Internationalization](#internationalization)
- [Design System](#design-system)
- [Documentation](#documentation)

---

## Overview

INDUSIA AI HMI is an end-to-end platform for managing AI-powered PCB visual inspections on the manufacturing floor. The system uses **Server-Sent Events (SSE)** for real-time communication between the AI Backend and the UI, with a simplified **GOOD/NG operator workflow**.

### Key Modules

| Module | Route | Description |
|--------|-------|-------------|
| **Operator HMI** | `/inspection/live/[lineId]` | Real-time inspection interface with GOOD/NG decisions |
| **Line Selection** | `/inspection/select-line` | Board and line selector for operators |
| **Override Review** | `/inspection/overrides` | Manager queue for false call override review |
| **Work Order Management** | `/engineering/work-orders` | Production job tracking with lot size, side count, yield metrics |
| **Master Data** | `/engineering/master-data` | Engineering console for customers, lines, boards, models |
| **Dashboard** | `/dashboard` | Analytics with KPIs, defect heatmaps, Pareto charts, trends |
| **User Management** | `/super-admin/users` | Admin panel for users |
| **Role Management** | `/super-admin/roles` | Admin panel for roles |
| **Permissions** | `/super-admin/permissions` | Admin panel for role permissions |
| **Sync Settings** | `/settings/sync` | Cloud sync configuration and monitoring |
| **Event Log** | `/event-log` | System event tracking and audit trail |

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Framework** | Next.js (App Router) | 13.5.1 | Full-stack React framework |
| **Language** | JavaScript/TypeScript | ES6+ | Mixed codebase |
| **UI Library** | React | 18.2 | Component-based UI |
| **Styling** | Tailwind CSS | 3.3.3 | Utility-first CSS |
| **UI Components** | shadcn/ui + Radix UI | - | Accessible component primitives |
| **Database** | Supabase (PostgreSQL) | - | Backend-as-a-Service |
| **Real-time** | Server-Sent Events (SSE) | - | AI Backend → UI communication |
| **Validation** | Zod | 3.25 | Schema validation |
| **Forms** | React Hook Form | 7.53 | Form management |
| **Charts** | Recharts | 2.12 | Data visualization |
| **Password** | bcrypt | 6.0 | Secure password hashing |
| **Unit Testing** | Jest + Testing Library | 30.2 | Component & hook testing |
| **E2E Testing** | Playwright | 1.57 | End-to-end testing |
| **Icons** | Lucide React | 0.446 | Icon library |

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
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       SUPABASE (Edge + Cloud)                        │   │
│  │  ┌──────────────────┐         Sync         ┌──────────────────┐     │   │
│  │  │  Edge PostgreSQL │ ───────────────────▶ │  Cloud PostgreSQL│     │   │
│  │  │  (Local/Factory) │                      │  (Supabase Cloud)│     │   │
│  │  └──────────────────┘                      └──────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Responsibility Split

| ✅ UI (Next.js) | ❌ AI Backend (Python) |
|-----------------|------------------------|
| Display inspection results | Camera capture |
| Operator GOOD/NG confirmation | AI inference |
| Work Order management | PLC control (RS232) |
| Statistics & Dashboard | Image storage |
| User management & RBAC | Hardware monitoring |
| Cloud sync | Conveyor control |

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
│                       API LAYER (94 endpoints)                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                 API Routes (app/api/)                        ││
│  │  • withAuth() middleware - User authentication               ││
│  │  • withApiKeyAuth() - AI Backend API key auth                ││
│  │  • Zod schema validation                                     ││
│  │  • Input sanitization (XSS, SQL injection prevention)        ││
│  └────────────────────────┬────────────────────────────────────┘│
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    REPOSITORY LAYER (27 repos)                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Repositories (lib/repos/)                       ││
│  │  • Direct Supabase queries                                   ││
│  │  • Case conversion (camelCase ↔ snake_case)                  ││
│  │  • Error handling & data transformation                      ││
│  └────────────────────────┬────────────────────────────────────┘│
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │ PostgreSQL │  │  Realtime  │  │   Storage  │                 │
│  └────────────┘  └────────────┘  └────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

### Context Provider Architecture

The app uses a nested context provider pattern in `app/layout-client.jsx`:

```
ToastProvider
└─ AuthProvider (outermost)
   └─ I18nProvider
      └─ HelpOverlayProvider
         └─ NotificationProvider
            └─ SystemHealthProvider (innermost)
```

---

## Project Structure

```
indusia-ai-hmi/
│
├── app/                              # Next.js App Router
│   ├── api/                          # RESTful API routes (94 endpoints)
│   │   ├── ai/                       # AI Backend API (30+ endpoints)
│   │   │   ├── inspections/          # AI inspection results
│   │   │   ├── models/               # Model registry
│   │   │   ├── training-jobs/        # Training pipeline
│   │   │   ├── training-datasets/    # Training datasets
│   │   │   ├── dataset-images/       # Dataset images
│   │   │   ├── sample-images/        # Sample images
│   │   │   ├── training-metrics/     # Training metrics
│   │   │   ├── defect-classes/       # Defect classes
│   │   │   ├── false-call-reasons/   # False call reasons
│   │   │   └── system-status/        # Hardware status
│   │   ├── auth/                     # login, logout, change-password, me, csrf
│   │   ├── work-orders/              # Work order CRUD + active WO + counters
│   │   ├── inspections/              # Inspection results + defects
│   │   ├── inspection/               # Session, action, stats, line-state
│   │   ├── master-data/              # customers, sections, lines, boards, false-call-reasons
│   │   ├── dashboard/                # summary, heatmap, pareto, trend
│   │   ├── users/                    # User CRUD
│   │   ├── roles/                    # Role CRUD
│   │   ├── permissions/              # Role permissions
│   │   ├── overrides/                # Override submissions + stats
│   │   ├── notifications/            # Notifications + unread count
│   │   ├── sync/                     # Cloud sync (trigger, status, progress, history)
│   │   ├── sync-queue/               # Sync queue management
│   │   ├── live/[lineId]/            # SSE endpoint for live inspection
│   │   ├── system-health/            # System health status
│   │   ├── event-log/                # Event log entries
│   │   ├── images/                   # Image upload and retrieval
│   │   ├── storage/                  # File storage
│   │   └── plc/                      # PLC signal endpoint
│   │
│   ├── dashboard/                    # Analytics dashboard page
│   ├── inspection/
│   │   ├── live/[lineId]/            # Live inspection HMI (SSE consumer)
│   │   ├── select-line/              # Line/board selector for operators
│   │   ├── overrides/                # Override review queue (manager)
│   │   └── result/[id]/              # Inspection result details
│   ├── engineering/
│   │   ├── master-data/              # Master data management
│   │   └── work-orders/              # Work order management
│   ├── super-admin/
│   │   ├── users/                    # User management
│   │   ├── roles/                    # Role management
│   │   └── permissions/              # Permission management
│   ├── settings/
│   │   ├── sync/                     # Cloud sync settings
│   │   └── false-call-reasons/       # False call reasons config
│   ├── event-log/                    # Event log viewer
│   ├── login/                        # Login page
│   ├── dev/                          # Development tools
│   ├── layout.js                     # Root layout
│   ├── layout-client.jsx             # Client layout with providers
│   ├── page.js                       # Home page (redirects)
│   └── globals.css                   # Global styles
│
├── components/                       # React components (180+ files)
│   ├── ui/                           # shadcn/ui primitives (40+ components)
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   └── ... (40+ files)
│   ├── inspection/                   # Inspection components
│   │   ├── LiveViewV3.jsx            # Main live inspection view
│   │   ├── LiveView.jsx              # Legacy live view
│   │   ├── DetectionOverlay.jsx      # Detection bounding boxes
│   │   ├── DetectionResultPanel.jsx  # Detection results panel
│   │   ├── HMIOperatorView.jsx       # Operator HMI view
│   │   ├── HMIActionPanel.jsx        # GOOD/NG action buttons
│   │   ├── HMITimer.jsx              # Inspection timer
│   │   ├── AIDecisionPanel.jsx       # AI decision display
│   │   ├── SidePanel.jsx             # Side info panel
│   │   ├── DefectViewPanel.jsx       # Defect details panel
│   │   ├── BoardOverview.jsx         # Board overview
│   │   ├── InspectionResult.jsx      # Result display
│   │   ├── InspectionStage.jsx       # Stage indicator
│   │   ├── FalseCallOverrideModal.jsx
│   │   ├── FalseCallModal.jsx
│   │   ├── OverrideReviewModal.jsx
│   │   ├── NextPCBConfirmModal.jsx
│   │   └── VolumeControl.jsx
│   ├── dashboard/                    # Dashboard components
│   │   ├── KPIGrid.jsx
│   │   ├── KPICard.jsx
│   │   ├── DefectTrendChart.jsx
│   │   ├── DefectPareto.jsx
│   │   └── DefectHeatmap.jsx
│   ├── override/                     # Override wizard components
│   │   ├── OverrideWizard.jsx
│   │   ├── OverrideModal.jsx
│   │   └── AnnotationCanvas.jsx
│   ├── work-orders/                  # Work order components
│   │   ├── WorkOrderTable.jsx
│   │   ├── WorkOrderForm.jsx
│   │   ├── WorkOrderFilters.jsx
│   │   ├── WorkOrderStats.jsx
│   │   └── WorkOrderStatusBadge.jsx
│   ├── sync/                         # Sync components
│   │   ├── SyncProgressModal.jsx
│   │   ├── SyncSummaryCard.jsx
│   │   ├── SyncQueueTable.jsx
│   │   ├── SyncSettings.jsx
│   │   └── SyncIndicator.jsx
│   ├── notifications/                # Notification components
│   │   ├── NotificationBell.jsx
│   │   ├── NotificationDrawer.jsx
│   │   ├── NotificationListItem.jsx
│   │   ├── NotificationFilters.jsx
│   │   └── NotificationEmptyState.jsx
│   ├── event-log/                    # Event log components
│   │   ├── EventLogTable.jsx
│   │   ├── EventLogFilters.jsx
│   │   ├── EventLogDetailDrawer.jsx
│   │   └── EventLogSummaryCards.jsx
│   ├── system/                       # System health components
│   │   ├── SystemHealthBar.jsx
│   │   ├── SystemStatusChip.jsx
│   │   └── SystemStatusDetailsModal.jsx
│   ├── help/                         # Help overlay components
│   │   ├── HelpOverlay.jsx
│   │   ├── HelpSectionCard.jsx
│   │   ├── ShortcutCheatSheet.jsx
│   │   ├── OverlayHighlightTooltip.jsx
│   │   └── OverlayLegend.jsx
│   ├── layout/                       # Layout components
│   │   ├── SideNav.jsx
│   │   └── TopNav.jsx
│   ├── common/                       # Common/reusable components
│   │   ├── Card.jsx
│   │   ├── StatusBadge.jsx
│   │   ├── EmptyState.jsx
│   │   ├── ErrorBanner.jsx
│   │   ├── SectionHeader.jsx
│   │   ├── DateRangePicker.jsx
│   │   ├── LanguageSwitcher.jsx
│   │   ├── StatsGrid.jsx
│   │   ├── CardSkeleton.jsx
│   │   └── TableSkeleton.jsx
│   ├── ErrorBoundary.jsx
│   ├── OfflineBanner.jsx
│   ├── ConfirmDialog.jsx
│   └── Drawer.jsx
│
├── context/                          # React Contexts (6 contexts)
│   ├── AuthContext.jsx               # Authentication & user state
│   ├── I18nContext.jsx               # Internationalization
│   ├── NotificationContext.jsx       # In-app notifications
│   ├── SystemHealthContext.jsx       # System health monitoring
│   ├── HelpOverlayContext.jsx        # Help overlay state
│   └── SidebarContext.jsx            # Sidebar state
│
├── hooks/                            # Custom React Hooks (25 hooks)
│   ├── useApi.js                     # API wrapper with error handling
│   ├── useAuth.js                    # Authentication hook (from context)
│   ├── useAudioFeedback.js           # Audio feedback for inspections
│   ├── useDashboard.js               # Dashboard data fetching
│   ├── useEventLog.js                # Event log data & filters
│   ├── useHelpOverlay.js             # Help overlay control
│   ├── useHMILayout.js               # HMI layout calculations
│   ├── useI18n.js                    # Translation hook
│   ├── useImageUpload.js             # Image upload handling
│   ├── useInspectionKeyboardShortcuts.jsx # Keyboard shortcuts
│   ├── useLiveInspection.js          # SSE consumer for live inspection
│   ├── useMasterData.js              # Master data fetching
│   ├── useModels.js                  # AI models data
│   ├── useNetworkStatus.js           # Online/offline detection
│   ├── useNotifications.js           # Notifications from context
│   ├── useOverrides.js               # Override submissions
│   ├── usePermissions.js             # Permission checking
│   ├── useRoles.js                   # Role management
│   ├── useSections.js                # Sections data
│   ├── useSync.js                    # Cloud sync operations
│   ├── useSystemHealth.js            # System health from context
│   ├── useToast.jsx                  # Toast notifications
│   ├── useUsers.js                   # User management
│   └── useWorkOrders.js              # Work order operations
│
├── lib/                              # Utilities & Services
│   ├── auth/                         # Authentication modules
│   │   ├── apiAuth.js                # withAuth() middleware for user auth
│   │   ├── apiKeyAuth.js             # withApiKeyAuth() for AI Backend
│   │   ├── rbac.js                   # Role-based access control
│   │   └── sectionAccess.js          # Section-based access control
│   ├── repos/                        # Repository layer (27 repos)
│   │   ├── index.js                  # Exports + case conversion utilities
│   │   ├── usersRepo.js              # User CRUD
│   │   ├── rolesRepo.js              # Role CRUD
│   │   ├── permissionsRepo.js        # Permissions CRUD
│   │   ├── workOrderRepo.js          # Work order operations
│   │   ├── inspectionRepo.js         # Inspection results
│   │   ├── inspectionStatsRepo.js    # Inspection statistics
│   │   ├── inspectionFramesRepo.js   # Inspection frames
│   │   ├── overridesRepo.js          # Override submissions
│   │   ├── masterDataRepo.js         # Master data (customers, lines, boards)
│   │   ├── dashboardRepo.js          # Dashboard analytics
│   │   ├── notificationsRepo.js      # Notifications
│   │   ├── eventLogRepo.js           # Event log entries
│   │   ├── systemHealthRepo.js       # System health status
│   │   ├── syncRepo.js               # Sync operations
│   │   ├── syncQueueRepo.js          # Sync queue management
│   │   ├── aiModelsRepo.js           # AI model registry
│   │   ├── modelsRepo.js             # Models (alias)
│   │   ├── defectClassesRepo.js      # Defect class reference
│   │   ├── trainingDatasetsRepo.js   # Training datasets
│   │   ├── trainingJobsRepo.js       # Training jobs
│   │   ├── trainingMetricsRepo.js    # Training metrics
│   │   ├── datasetImagesRepo.js      # Dataset images
│   │   ├── datasetQueueRepo.js       # Dataset queue
│   │   ├── sampleImagesRepo.js       # Sample images
│   │   └── imageStorageRepo.js       # Image storage
│   ├── sync/                         # Cloud sync module
│   │   ├── index.js                  # Module exports
│   │   ├── syncToCloud.js            # Main sync logic
│   │   ├── syncLock.js               # Lock management
│   │   ├── onlineCheck.js            # Cloud connectivity check
│   │   ├── supabaseAdmin.js          # Supabase admin client
│   │   └── cloudImageUpload.js       # Cloud image upload
│   ├── services/                     # Services
│   │   ├── aiBackendService.js       # AI Backend API client
│   │   ├── imageService.js           # Image handling service
│   │   ├── inspectionService.js      # Inspection API calls
│   │   └── plcSignal.js              # PLC signal service
│   ├── validations/                  # Zod schemas
│   │   ├── schemas.js                # General schemas
│   │   ├── aiSchemas.js              # AI Backend schemas
│   │   ├── inspectionSchema.js       # Inspection schemas
│   │   ├── workOrderSchema.js        # Work order schemas
│   │   └── validate.js               # Validation utilities
│   ├── utils/                        # Utility functions
│   │   ├── apiResponse.js            # Standardized API responses
│   │   ├── authFetch.js              # Authenticated fetch wrapper
│   │   ├── cropImage.js              # Image cropping utility
│   │   ├── csrf.js                   # CSRF protection
│   │   ├── imageNaming.js            # Image filename generation
│   │   ├── password.js               # Password hashing
│   │   ├── rateLimit.js              # Rate limiting
│   │   ├── roleUtils.js              # Role normalization
│   │   └── sanitize.js               # Input sanitization
│   ├── realtime/                     # Realtime subscriptions
│   │   └── subscriptions.js
│   ├── supabase/                     # Supabase configuration
│   │   └── server.js
│   ├── supabaseClient.js             # Supabase client
│   ├── audit.js                      # Audit logging
│   ├── eventLogger.js                # Event logger
│   ├── notificationHelper.js         # Notification helpers
│   └── utils.ts                      # TypeScript utilities (cn)
│
├── data/                             # Mock/Seed data
│   ├── masterData.js                 # Master data samples
│   ├── mockEvents.js                 # Event log samples
│   ├── mockNotifications.js          # Notification samples
│   └── mockUsers.js                  # User samples
│
├── i18n/                             # Translations
│   ├── en.json                       # English
│   └── id.json                       # Indonesian
│
├── docs/                             # Documentation
│   ├── API_AI_BACKEND.md             # AI Backend API contract
│   ├── API_DOCUMENTATION.md          # Internal UI API
│   ├── DATABASE_SCHEMA.md            # Database schema & ownership
│   └── migrations/                   # Migration docs
│
├── public/                           # Static assets
├── storage/                          # Local file storage
├── scripts/                          # Utility scripts
│   ├── generatePasswordHashes.js
│   ├── generate-local-jwt.js
│   └── mockLiveData.js
├── e2e/                              # E2E tests (Playwright)
├── __fixtures__/                     # Test fixtures
│
├── .claude/                          # Claude Code configuration
│   ├── prompts/                      # Development phase prompts
│   └── settings.json
│
├── middleware.js                     # Next.js middleware
├── tailwind.config.js                # Tailwind configuration
├── next.config.js                    # Next.js configuration
├── jest.config.js                    # Jest configuration
├── playwright.config.js              # Playwright configuration
├── tsconfig.json                     # TypeScript configuration
├── package.json                      # Dependencies
├── CLAUDE.md                         # Claude Code instructions
└── README.md                         # This file
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase project (Edge + Cloud)
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
# Supabase - Client (browser access)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Supabase - Server (admin operations)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Backend Integration (API key for /api/ai/* routes)
AI_BACKEND_API_KEY=your-secure-api-key-here

# AI Backend URLs (external Python/FastAPI server)
NEXT_PUBLIC_AI_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_AI_BACKEND_SSE_URL=http://localhost:8000/sse

# Cloud Sync (optional - for edge → cloud sync)
NEXT_PUBLIC_SUPABASE_CLOUD_URL=https://your-cloud-project.supabase.co
NEXT_PUBLIC_SUPABASE_CLOUD_SERVICE_ROLE_KEY=your-cloud-service-role-key
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
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm test` | Run Jest unit tests |
| `npm run test:watch` | Jest in watch mode |
| `npm run test:coverage` | Jest with coverage report |
| `npm run test:e2e` | Run Playwright E2E tests (headless) |
| `npm run test:e2e:headed` | Playwright with browser |
| `npm run test:e2e:ui` | Playwright interactive UI mode |

---

## Core Features

### 1. Work Order System

Work orders track production jobs with lot size, side count, and yield metrics.

**Work Order Fields:**

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

**Status Flow:**
```
draft → ready → active → completed → closed
```

**YIELD Calculation:**
```
YIELD = (good_qty / completed_qty) × 100%
```

### 2. Inspection Flow

The system uses SSE for real-time inspection communication.

**Terminology:**

| Layer | Term | Values | Description |
|-------|------|--------|-------------|
| AI Backend | `decision` | `PASS` / `FAIL` | AI detection result |
| Operator | `operator_decision` | `GOOD` / `NG` | Operator confirmation |

**Operator Buttons:**

| Button | Shortcut | Color | Action |
|--------|----------|-------|--------|
| **GOOD** | `G` | Green `#10B981` | Board passes |
| **NG** | `N` | Red `#EF4444` | Board rejected |

**False Call Auto-Detection:**

```javascript
const isFalseCall =
  (aiDecision === 'PASS' && operatorDecision === 'NG') ||
  (aiDecision === 'FAIL' && operatorDecision === 'GOOD')
```

**Decision Matrix:**

| AI Decision | Operator Click | Result | Is False Call |
|-------------|----------------|--------|---------------|
| PASS | GOOD | Board passes | No |
| PASS | NG | Board rejected | **Yes** (AI missed defect) |
| FAIL | GOOD | Board passes | **Yes** (AI false positive) |
| FAIL | NG | Board rejected | No |

### 3. PLC Integration

AI Backend handles all PLC communication via Serial RS232.

**PLC Signals:**

| Signal | Description | When Sent |
|--------|-------------|-----------|
| `PASS` | Board passed inspection | Operator: GOOD |
| `REJECT` | Board failed inspection | Operator: NG |
| `FLIP_BOTTOM` | Flip board to inspect bottom | After TOP, if side_count=2 |
| `NEXT_PCB` | Proceed to next board | After full cycle complete |

### 4. Image Storage Convention

```
/inspection-images/
  └── {WO_NUMBER}/
      └── {BOARD_SEQUENCE}/
          ├── {timestamp}_{side}_{result}_{model}_{customer}_full.png
          └── {timestamp}_{side}_{result}_{model}_{customer}_crop_{defect}.png
```

**Filename Format:**
```
{YYYYMMDD}_{HHmmss}_{SIDE}_{RESULT}_{MODEL}_{CUSTOMER}_{TYPE}[_{DEFECT}].png
```

---

## User Roles & RBAC

### Role Capabilities

| Role | Capabilities |
|------|--------------|
| **Operator** | View inspections, make GOOD/NG decisions |
| **Manager** | View reports, analytics, review overrides |
| **Engineer** | Master data CRUD, work order management, model config |
| **Super Admin** | All features + user/role/permission management |

### Permission Format

Pattern: `resource:action`

Examples: `users:read`, `work-orders:create`, `inspections:read`, `models:deploy`

### Available Permissions

| Resource | Actions |
|----------|---------|
| `users` | read, create, update, delete |
| `roles` | read, create, update, delete |
| `work-orders` | read, create, update, delete, activate |
| `inspections` | read, create, update |
| `overrides` | read, create, review |
| `master-data` | read, create, update, delete |
| `dashboard` | read |
| `settings` | read, update |
| `sync` | read, trigger |

---

## API Endpoints

The system has **94 API endpoints** organized into categories:

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| POST | `/api/auth/change-password` | Change password |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/auth/permissions` | Get user permissions |
| GET | `/api/auth/csrf` | Get CSRF token |

### Work Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/work-orders` | List work orders |
| POST | `/api/work-orders` | Create work order |
| GET | `/api/work-orders/[id]` | Get work order |
| PUT | `/api/work-orders/[id]` | Update work order |
| DELETE | `/api/work-orders/[id]` | Delete work order |
| POST | `/api/work-orders/[id]/start` | Start work order |
| POST | `/api/work-orders/[id]/complete` | Complete work order |
| PATCH | `/api/work-orders/[id]/counters` | Update counters |
| POST | `/api/work-orders/[id]/next-side` | Advance to next side |
| GET | `/api/work-orders/active` | Get all active work orders |
| GET | `/api/work-orders/active/[lineId]` | Get active WO for line |

### Master Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/master-data/customers` | Customers CRUD |
| GET/PUT/DELETE | `/api/master-data/customers/[id]` | Customer by ID |
| GET/POST | `/api/master-data/sections` | Sections CRUD |
| GET/PUT/DELETE | `/api/master-data/sections/[id]` | Section by ID |
| GET/POST | `/api/master-data/lines` | Lines CRUD |
| GET/PUT/DELETE | `/api/master-data/lines/[id]` | Line by ID |
| GET/POST | `/api/master-data/boards` | Boards CRUD |
| GET/PUT/DELETE | `/api/master-data/boards/[id]` | Board by ID |
| GET/POST | `/api/master-data/false-call-reasons` | False call reasons |
| GET | `/api/master-data/menu-items` | Menu items |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/summary` | KPI summary |
| GET | `/api/dashboard/heatmap` | Defect heatmap |
| GET | `/api/dashboard/pareto` | Defect Pareto |
| GET | `/api/dashboard/trend` | Defect trend |

### Inspections

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/inspections` | Inspections list/create |
| GET | `/api/inspections/[id]` | Inspection details |
| POST | `/api/inspections/submit` | Submit inspection result |
| GET | `/api/inspections/stats` | Inspection statistics |
| GET | `/api/inspections/defect-classes` | Defect classes |
| GET | `/api/inspections/false-call-reasons` | False call reasons |
| GET | `/api/inspection/session` | Get session |
| POST | `/api/inspection/session` | Create session |
| GET | `/api/inspection/session/[id]` | Session details |
| POST | `/api/inspection/action` | Inspection action (GOOD/NG) |
| GET | `/api/inspection/stats/[lineId]` | Line statistics |
| GET | `/api/inspection/line-state/[lineId]` | Line state |

### Live Inspection (SSE)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/live/[lineId]` | SSE stream for live inspection |

### Overrides

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/overrides` | List/create overrides |
| GET/PATCH | `/api/overrides/[id]` | Override details/review |
| GET | `/api/overrides/stats` | Override statistics |

### Cloud Sync

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sync/status` | Full sync status |
| GET | `/api/sync/check-online` | Cloud connectivity check |
| POST | `/api/sync/trigger` | Start sync |
| GET | `/api/sync/progress` | Sync progress |
| GET | `/api/sync/history` | Sync history |
| POST | `/api/sync/force-release` | Release stuck lock |
| POST | `/api/sync/cloud` | Cloud operations |
| GET | `/api/sync-queue/summary` | Queue summary |
| GET | `/api/sync-queue/history` | Queue history |
| POST | `/api/sync-queue/sync` | Sync queue items |

### AI Backend API

Authenticated via `X-API-Key` header.

| Category | Endpoints | Purpose |
|----------|-----------|---------|
| Inspections | `/api/ai/inspections/*` | AI detection results |
| Models | `/api/ai/models/*` | Model registry |
| Datasets | `/api/ai/training-datasets/*` | Training datasets |
| Images | `/api/ai/dataset-images/*` | Dataset images |
| Training | `/api/ai/training-jobs/*` | Training pipeline |
| Metrics | `/api/ai/training-metrics/*` | Epoch metrics |
| Samples | `/api/ai/sample-images/*` | Sample images |
| Defects | `/api/ai/defect-classes/*` | Defect reference |
| False Call | `/api/ai/false-call-reasons` | Reason reference |
| System | `/api/ai/system-status` | Hardware status |

### Users & RBAC

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/users` | Users list/create |
| GET/PUT/DELETE | `/api/users/[id]` | User by ID |
| GET/POST | `/api/roles` | Roles list/create |
| GET/PUT/DELETE | `/api/roles/[id]` | Role by ID |
| GET/PUT | `/api/permissions/[roleId]` | Role permissions |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/system-health` | System health status |
| GET | `/api/event-log` | Event log entries |
| GET | `/api/notifications` | Notifications |
| GET | `/api/notifications/unread-count` | Unread count |
| POST | `/api/error-log` | Log client errors |

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
| `role_menu_permissions` | RW | - | |
| **Sync** |
| `sync_lock` | RW | - | Sync lock management |
| `sync_sessions` | RW | - | Sync history |
| **Reference** |
| `defect_classes` | RW | R | |
| `false_call_reasons` | RW | R | |

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

---

## Cloud Sync System

The cloud sync system enables uploading inspection data from edge PostgreSQL to Supabase Cloud.

### Sync Architecture

```
┌─────────────────────┐        Sync        ┌─────────────────────┐
│  Edge PostgreSQL    │ ─────────────────▶ │  Cloud PostgreSQL   │
│  (Local/Factory)    │                    │  (Supabase Cloud)   │
│                     │                    │                     │
│  • inspection_results│                   │  • Aggregated data  │
│  • inspection_defects│                   │  • Analytics        │
│  • overrides        │                    │  • Reporting        │
│  • event_log        │                    │                     │
└─────────────────────┘                    └─────────────────────┘
```

### Synced Tables

- `inspection_results`
- `inspection_defects`
- `overrides`
- `event_log`
- `inspection_stats`
- `work_orders` (qty updates only)

### Sync Module (`lib/sync/`)

| File | Purpose |
|------|---------|
| `syncToCloud.js` | Main sync logic with batch processing |
| `syncLock.js` | Lock management to prevent concurrent syncs |
| `onlineCheck.js` | Cloud connectivity check |
| `supabaseAdmin.js` | Supabase admin client |
| `cloudImageUpload.js` | Cloud image upload |

### Sync API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sync/status` | Full sync status |
| GET | `/api/sync/check-online` | Connectivity check |
| POST | `/api/sync/trigger` | Start sync (background) |
| GET | `/api/sync/progress` | Real-time progress |
| GET | `/api/sync/history` | Recent sync sessions |
| POST | `/api/sync/force-release` | Release stuck lock |

### Sync Configuration

- Lock expires after 10 minutes
- Processes 100 records per batch
- Automatic retry on failure
- Progress tracking via SSE

---

## Testing

### Unit Tests (Jest)

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```

Coverage collected from: `lib/`, `hooks/`, `components/`, `context/`, `app/api/`

### E2E Tests (Playwright)

```bash
npm run test:e2e      # Headless
npm run test:e2e:headed # With browser
npm run test:e2e:ui   # Interactive UI
```

Reports generated in `playwright-report/`

---

## Security

| Feature | Implementation |
|---------|----------------|
| **User Auth** | `withAuth()` middleware for API routes |
| **API Key Auth** | `withApiKeyAuth()` for AI Backend routes |
| **Permission Check** | RBAC with `resource:action` permissions |
| **Input Validation** | Zod schemas for all API inputs |
| **Input Sanitization** | XSS, SQL injection prevention |
| **Password Hashing** | bcrypt with salt rounds |
| **CSRF Protection** | CSRF tokens for state-changing requests |
| **Security Headers** | X-Frame-Options, X-Content-Type-Options |

---

## Internationalization

Supported languages: **English (EN)**, **Indonesian (ID)**

```jsx
import { useI18n } from '@/hooks/useI18n'

function Component() {
  const { t, language, setLanguage } = useI18n()
  return <h1>{t('nav.dashboard')}</h1>
}
```

Translation files: `i18n/en.json`, `i18n/id.json`

---

## Design System

### INDUSIA Color Tokens

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

### HMI Design Guidelines (ISA-101)

| Rule | Specification |
|------|---------------|
| Background | Neutral gray - color only for abnormal |
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

## Documentation

| Document | Location | Description |
|----------|----------|-------------|
| API_AI_BACKEND.md | `docs/` | AI Backend API contract (30+ endpoints) |
| API_DOCUMENTATION.md | `docs/` | Internal UI API |
| DATABASE_SCHEMA.md | `docs/` | Database schema & ownership matrix |
| CLAUDE.md | `/` | Claude Code development instructions |

---

## Statistics

| Metric | Count |
|--------|-------|
| Source Files | 345+ |
| API Endpoints | 94 |
| Repositories | 27 |
| React Contexts | 6 |
| Custom Hooks | 25 |
| UI Components | 180+ |
| Translation Keys | 200+ |

---

## License

Proprietary - INDUSIA AI
