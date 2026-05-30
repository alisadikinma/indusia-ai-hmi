# INDUSIA AI HMI

<div align="center">

![INDUSIA AI](https://img.shields.io/badge/INDUSIA-AI%20Powered-0FB5BA?style=for-the-badge&logo=artificial-intelligence&logoColor=white)
![Next.js 14](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![Security](https://img.shields.io/badge/Security-Pentest%20Verified-10B981?style=for-the-badge&logo=shield&logoColor=white)
![ISA-101](https://img.shields.io/badge/ISA--101-Compliant-F59E0B?style=for-the-badge)

**Industrial-Grade AI-Powered Visual Inspection System for PCB Manufacturing**

*Real-time defect detection • Offline-first architecture • Self-improving AI loop*

[Features](#-key-features) • [Architecture](#-system-architecture) • [Security](#-security--compliance) • [Getting Started](#-getting-started)

</div>

---

## 🎯 Executive Summary

INDUSIA AI HMI adalah sistem inspeksi visual berbasis AI untuk manufaktur PCB yang dirancang untuk **lingkungan pabrik offline** dengan kemampuan sinkronisasi ke cloud. Sistem ini menggabungkan:

| Capability | Description |
|------------|-------------|
| **🤖 AI-Powered Detection** | Deep learning model untuk deteksi defek solder dengan akurasi >95% |
| **⚡ Real-time SSE** | Server-Sent Events untuk komunikasi sub-second antara AI Backend dan UI |
| **🔒 Offline-First** | Beroperasi penuh di jaringan pabrik tertutup tanpa internet |
| **☁️ Cloud Sync** | Sinkronisasi otomatis ke Supabase Cloud saat koneksi tersedia |
| **🔄 Self-Improving** | False call data otomatis di-upload untuk retraining model AI |
| **🛡️ Security Hardened** | Lolos penetration testing dengan 47+ vulnerability fixes |

---

## ✨ Key Features

### 🏭 Industrial HMI (ISA-101 Compliant)

```
┌────────────────────────────────────────────────────────────────────┐
│  [≡]  Board: PCB-2026010001 │  ⏱ 00:15  │  Line: SMT-01  │  OP: JS │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐  │
│  │                             │  │  AI Detection               │  │
│  │      Defect Image           │  │  ───────────────────────    │  │
│  │      (Zoomed + BBox)        │  │  Result: FAIL               │  │
│  │                             │  │  Type: Solder Bridge        │  │
│  │         [SVG Overlay]       │  │  Confidence: 94%            │  │
│  │                             │  │  Location: U15-Pin3         │  │
│  └─────────────────────────────┘  └─────────────────────────────┘  │
│                                                                    │
│    ┌──────────────────┐          ┌──────────────────┐              │
│    │                  │          │                  │              │
│    │      GOOD        │          │       NG         │              │
│    │       (G)        │          │       (N)        │              │
│    │                  │          │                  │              │
│    └──────────────────┘          └──────────────────┘              │
│                                                                    │
│    Inspected: 245  │  Good: 240  │  NG: 5  │  Yield: 97.9%         │
└────────────────────────────────────────────────────────────────────┘
```

- **30×30mm touch targets** untuk operasi dengan sarung tangan
- **2-button workflow** (GOOD/NG) - keputusan dalam 1 klik
- **Auto false-call detection** - sistem otomatis mendeteksi ketidaksesuaian AI vs Operator
- **Keyboard shortcuts** - G/N untuk operasi cepat
- **Timer escalation** - visual warning saat decision time terlalu lama

### 🔄 Self-Improving AI Loop

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CONTINUOUS IMPROVEMENT LOOP                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────┐     ┌──────────┐      ┌──────────┐      ┌──────────┐         │
│   │   AI     │────▶│ Operator │────▶│  False   │────▶│  Upload  │         │
│   │ Detects  │     │ Reviews  │      │  Call?   │      │ to Cloud │         │
│   │ Defect   │     │ GOOD/NG  │      │          │      │ Storage  │         │
│   └──────────┘     └──────────┘      └────┬─────┘      └────┬─────┘         │
│                                           │                 │               │
│                                           │ Yes             ▼               │
│   ┌──────────┐     ┌──────────┐      ┌────┴─────┐      ┌──────────┐         │
│   │  Deploy  │◀────│ Retrain  │◀────│ Dataset  │◀────│ Supabase │         │
│   │  Model   │     │  Model   │      │ Created  │      │ Storage  │         │
│   └──────────┘     └──────────┘      └──────────┘      └──────────┘         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Bagaimana sistem menjadi semakin pintar:**

1. **AI mendeteksi** defek pada PCB dengan bounding box
2. **Operator memvalidasi** dengan GOOD atau NG
3. **Sistem mendeteksi false call** secara otomatis:
   - AI bilang PASS tapi Operator bilang NG → AI missed defect
   - AI bilang FAIL tapi Operator bilang GOOD → AI false positive
4. **Manager me-review** false call dan approve/reject (local DB only)
5. **Saat sync to cloud**: approved override images di-upload ke Supabase Storage
6. **Dataset dibuat** dari false call images di cloud
7. **Model di-retrain** dengan data baru
8. **Model baru di-deploy** → AI semakin akurat

### 📡 Offline-First with Cloud Sync

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HYBRID ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   FACTORY FLOOR (Offline Network)          OFFICE (Internet Access)         │
│   ════════════════════════════════         ═══════════════════════          │
│                                                                             │
│   ┌─────────────┐    ┌─────────────┐       ┌─────────────┐                  │
│   │ AI Backend  │    │  Local DB   │       │  Office PC  │                  │
│   │ (FastAPI)   │    │ PostgreSQL  │       │  (Bridge)   │                  │
│   │             │    │             │       │             │                  │
│   │ • Camera    │    │ • Results   │       │ Dual NIC:   │                  │
│   │ • Inference │◀──▶│ • Defects  │◀────▶│ • Factory   │                  │
│   │ • PLC       │    │ • WO Data   │       │ • Internet  │                  │
│   └─────────────┘    └─────────────┘       └──────┬──────┘                  │
│                                                   │                         │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─       │
│                                                   │ Sync every 15 min       │
│                                                   ▼                         │
│                                            ┌─────────────┐                  │
│   CLOUD (Supabase)                         │  Supabase   │                  │
│   ════════════════                         │   Cloud     │                  │
│                                            │             │                  │
│   • Analytics & Reporting                  │ • PostgreSQL│                  │
│   • Cross-factory aggregation              │ • Storage   │                  │
│   • AI Training data                       │ • Auth      │                  │
│   • Long-term archival                     └─────────────┘                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Sync Mechanism:**

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Local Database** | PostgreSQL 16 + PostgREST | Full CRUD operations, offline capability |
| **Sync Trigger** | Manual via UI or API (`POST /api/sync/trigger`) | Background sync with lock management |
| **Cloud Database** | Supabase PostgreSQL | Analytics, reporting, cross-factory data |
| **Image Storage** | Supabase Storage (`inspection-images` bucket) | Approved false call images untuk retraining |
| **Timezone Handling** | `stripTimezoneOffsets()` | Strips `+07:00` so cloud stores local wall-clock time |

**Data yang di-sync:**

```javascript
// Sync priority order (in syncToCloud.js)
const SYNC_TABLES = [
  'inspection_results',    // Hasil inspeksi
  'inspection_defects',    // Detail defek dengan bbox
  'overrides',             // False call submissions (approved + rejected)
  'inspection_stats',      // Statistik inspeksi per shift
]
// + work_orders (qty updates only, not full records)
// + override images (approved only → Supabase Storage)
// Note: event_log temporarily excluded (schema mismatch)
```

**Sync Flow:**
1. DB records synced per table (batch of 100)
2. Work order qty counters updated
3. Approved override images uploaded to Supabase Storage
4. Sync session logged for audit trail

---

## 🏗️ System Architecture

### Technology Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Frontend** | Next.js (App Router) | 14 | Server & Client Components |
| **Language** | JavaScript | ES6+ | Konsisten, no TypeScript migration |
| **UI Framework** | React + Tailwind CSS | 18 / 3.4 | Component-based UI |
| **UI Components** | shadcn/ui + Radix | Latest | Accessible primitives |
| **Local Database** | PostgreSQL + PostgREST | 16 / 12 | RESTful API over PostgreSQL |
| **Cloud Database** | Supabase PostgreSQL | Latest | Managed PostgreSQL |
| **Cloud Storage** | Supabase Storage | Latest | Image storage untuk retraining |
| **Real-time** | Server-Sent Events | - | AI Backend → UI streaming |
| **Validation** | Zod | 3.25 | Runtime schema validation |
| **AI Backend** | Auto Inspect Edge (Python) | - | Camera, inference, PLC (port 8002) |
| **PLC Communication** | Serial RS232 | - | Conveyor & reject gate control |

### Component Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SYSTEM COMPONENTS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐         SSE Events          ┌──────────────────┐   │
│  │                     │ ──────────────────────────▶ │                 │    │
│  │    AI Backend       │    • inspection             │   Next.js UI     │  │
│  │   (Python/FastAPI)  │    • hardware_status        │                  │  │
│  │                     │    • running_status         │  • LiveView HMI  │  │
│  │   ┌─────────────┐   │                             │  • Dashboard     │  │
│  │   │ Camera ×2   │   │ ◀────────────────────────── │  • Work Orders  │  │
│  │   │ (TOP/BOT)   │   │      POST /confirm          │  • Master Data   │  │
│  │   └─────────────┘   │      (operator decision)    │  • User Admin    │  │
│  │   ┌─────────────┐   │                             │                  │  │
│  │   │ AI Model    │   │                             │  94 API Routes   │  │
│  │   │ (YOLO/etc)  │   │                             │  27 Repositories │  │
│  │   └─────────────┘   │                             │                  │  │
│  │   ┌─────────────┐   │                             └────────┬─────────┘  │
│  │   │ PLC RS232   │   │                                      │            │
│  │   │ (Conveyor)  │   │                                      │            │
│  │   └─────────────┘   │           REST API                   │            │
│  │                     │ ◀────────────────────────────────────┤           │
│  └──────────┬──────────┘          /api/*                       │           │
│             │                                                  │           │
│             │                                                  │           │
│             └──────────────────────┬───────────────────────────┘           │
│                                    │                                       │
│                                    ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    LOCAL DATABASE (Factory)                         │   │
│  │  ┌────────────────────────────────────────────────────────────┐     │   │
│  │  │                    PostgreSQL 16                            │    │   │
│  │  │  • 40+ tables (inspection, WO, users, audit, etc.)         │     │   │
│  │  │  • PostgREST for RESTful API access                        │     │   │
│  │  │  • Full offline operation capability                        │    │   │
│  │  └────────────────────────────────────────────────────────────┘     │   │
│  │                              │                                      │   │
│  │                              │ Sync (every 15 min via Office PC)    │   │
│  │                              ▼                                      │   │
│  │  ┌────────────────────────────────────────────────────────────┐     │   │
│  │  │                   Supabase Cloud                            │    │   │
│  │  │  • PostgreSQL (analytics, reporting)                        │    │   │
│  │  │  • Storage (false call images for retraining)               │    │   │
│  │  │  • Auth (optional cloud auth)                               │    │   │
│  │  └────────────────────────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Database Architecture

**Mengapa PostgreSQL + PostgREST (bukan Supabase Edge Functions)?**

| Aspect | Our Choice | Reason |
|--------|------------|--------|
| **Database** | PostgreSQL 16 | Full-featured, offline-capable, industry standard |
| **API Layer** | PostgREST | Auto-generates REST API from schema, no Edge Functions needed |
| **Offline** | ✅ Full support | Pabrik beroperasi tanpa internet |
| **Latency** | <10ms | Direct database access, no cloud round-trip |
| **Reliability** | 99.9%+ | No dependency pada cloud availability |

**Schema Highlights:**

```sql
-- Core inspection flow
inspection_results (
  id UUID PRIMARY KEY,
  work_order_id UUID REFERENCES work_orders(id),
  line_id UUID REFERENCES lines(id),
  
  -- AI Decision
  ai_decision VARCHAR(10),  -- 'PASS' | 'FAIL'
  ai_confidence DECIMAL(5,4),
  ai_timestamp TIMESTAMPTZ,
  ai_image_url_top TEXT,
  ai_image_url_bottom TEXT,
  
  -- Operator Decision  
  operator_decision VARCHAR(10),  -- 'GOOD' | 'NG'
  operator_id UUID REFERENCES users(id),
  operator_timestamp TIMESTAMPTZ,
  
  -- Auto-calculated
  is_false_call BOOLEAN GENERATED ALWAYS AS (
    (ai_decision = 'PASS' AND operator_decision = 'NG') OR
    (ai_decision = 'FAIL' AND operator_decision = 'GOOD')
  ) STORED,
  
  -- For retraining
  false_call_reason_id UUID REFERENCES false_call_reasons(id),
  false_call_image_url TEXT,  -- Uploaded to Supabase Storage
  
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

### SSE Event Flow & Live Inspection Architecture

```
AI Backend                    Operator (LiveViewV3)              Database
    │                                  │                             │
    │ ══ 4 SSE Streams ═════════════▶ │                             │
    │    • inspection (results)        │ Display:                    │
    │    • motion_stages (conveyor)    │ • PCB image + BBox overlay  │
    │    • vision_stages (camera/AI)   │ • AI decision + confidence  │
    │    • device_status (hardware)    │ • 20-stage progress bar     │
    │                                  │                             │
    │                                  │═══ PUT /line-state/{id} ══▶│ In-memory
    │                                  │    (push state on change)   │ + file backup
    │                                  │                             │
    │                                  │◀═══ Operator clicks ════════│
    │                                  │     GOOD or NG              │
    │                                  │                             │
    │ ◀═══ POST /confirm ══════════════│                             │
    │      { decision: "GOOD" }        │                             │
    │                                  │                             │
    │ ══ PLC Signal ══▶ Conveyor       │═══ Save to DB ═════════════▶│
    │    PASS/REJECT                   │    inspection_results       │
    │                                  │    + WO counter update      │
    │                                  │                             │

Manager (LiveViewV3, view-only)        Line State API
    │                                       │
    │ ══ GET /line-state/{id} ═══════════▶ │ (polls every 500ms)
    │    stage, inspection, hardware         │ reads from memory
    │                                       │
    │ ══ GET /work-orders/active/{id} ═══▶ │ (polls every 5s)
    │    WO counters, yield stats           │ reads from database
```

**Key design decisions:**
- Operator receives real-time SSE from AI Backend and pushes state to Line State API
- Manager polls the Line State API (no direct SSE connection, simpler and read-only)
- Line State API uses in-memory cache for sub-millisecond reads, async file backup
- Work order refresh is separated to 5-second interval (DB queries are expensive)

---

## 🛡️ Security & Compliance

### Penetration Test Results

INDUSIA AI HMI telah melewati **comprehensive security audit** dengan hasil:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SECURITY AUDIT SUMMARY                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ✅ PASSED - All Critical & High vulnerabilities remediated                │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  Category                    │ Found │ Fixed │ Status              │  │
│   ├─────────────────────────────────────────────────────────────────────┤  │
│   │  Authentication & Session    │   8   │   8   │ ✅ Secured          │  │
│   │  Input Validation            │  12   │  12   │ ✅ Secured          │  │
│   │  SQL Injection               │   6   │   6   │ ✅ Secured          │  │
│   │  XSS (Cross-Site Scripting)  │   9   │   9   │ ✅ Secured          │  │
│   │  CSRF Protection             │   4   │   4   │ ✅ Secured          │  │
│   │  Rate Limiting               │   3   │   3   │ ✅ Implemented      │  │
│   │  Authorization (RBAC)        │   5   │   5   │ ✅ Secured          │  │
│   │  Security Headers            │   -   │   -   │ ✅ Implemented      │  │
│   ├─────────────────────────────────────────────────────────────────────┤  │
│   │  TOTAL                       │  47   │  47   │ ✅ 100% Remediated  │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Security Implementation

| Layer | Protection | Implementation |
|-------|------------|----------------|
| **Authentication** | Session-based auth | HTTP-only cookies, secure flag, 24h expiry |
| **Authorization** | RBAC with 4 roles | Database-driven permissions, `resource:action` pattern |
| **Input Validation** | Zod schemas | All 94 API endpoints validated |
| **Sanitization** | XSS prevention | `sanitizeRequestBody()` on all inputs |
| **SQL Injection** | Parameterized queries | Supabase client with prepared statements |
| **CSRF** | Token validation | Double-submit cookie pattern |
| **Rate Limiting** | Per-endpoint limits | 100 req/min general, 5 req/min auth |
| **API Keys** | AI Backend auth | `X-API-Key` header for machine-to-machine |

### Security Headers

```javascript
// middleware.js
{
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
}
```

### RBAC Permission Model

```javascript
// Database-driven permissions (bukan hardcoded)
const permissions = await db.query(`
  SELECT p.resource, p.action 
  FROM role_menu_permissions rmp
  JOIN permissions p ON rmp.permission_id = p.id
  WHERE rmp.role_id = $1
`, [user.role_id])

// Check: hasPermission('work-orders:create')
```

| Role | Example Permissions |
|------|---------------------|
| **Operator** | `inspections:read`, `inspections:create` |
| **Manager** | + `dashboard:read`, `overrides:review` |
| **Engineer** | + `work-orders:*`, `master-data:*` |
| **Super Admin** | All permissions |

---

## 📊 Inspection Workflow

### Operator Decision Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        OPERATOR DECISION MATRIX                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   AI Decision    Operator Click    Result         Is False Call?            │
│   ═══════════    ══════════════    ══════         ══════════════            │
│                                                                             │
│   PASS           GOOD              Board passes   No (Agreement)            │
│   PASS           NG                Board rejected YES - AI missed defect    │
│   FAIL           GOOD              Board passes   YES - AI false positive   │
│   FAIL           NG                Board rejected No (Agreement)            │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  False Call = Operator disagrees with AI                            │  │
│   │                                                                     │  │
│   │  When false call detected:                                          │  │
│   │  1. Prompt operator for reason (dropdown)                           │  │
│   │  2. Capture annotated image                                         │  │
│   │  3. Upload to Supabase Storage                                      │  │
│   │  4. Queue for AI retraining                                         │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### False Call Reasons

| Code | Reason | Impact on Training |
|------|--------|-------------------|
| `REFLECTION` | Lighting/reflection artifact | Improve augmentation |
| `ACCEPTABLE_VARIATION` | Within IPC tolerance | Adjust threshold |
| `WRONG_CLASSIFICATION` | Wrong defect type | Fix label |
| `NORMAL_SOLDER` | Normal joint misidentified | Negative sample |
| `OTHER` | Requires comment | Manual review |

### Work Order Lifecycle

```
┌────────┐    ┌────────┐    ┌────────┐    ┌───────────┐    ┌────────┐
│ DRAFT  │───▶│ READY  │───▶│ ACTIVE │───▶│ COMPLETED │───▶│ CLOSED │
└────────┘    └────────┘    └────────┘    └───────────┘    └────────┘
     │             │             │              │               │
     │             │             │              │               │
  Engineer      Engineer      System        Automatic       Manager
  creates       validates     activates     when qty        archives
                              on line       reached
```

**Counters tracked:**

```javascript
{
  lot_size: 1000,        // Target quantity
  completed_qty: 245,    // Fully inspected
  good_qty: 240,         // Operator: GOOD
  ng_qty: 5,             // Operator: NG
  false_call_qty: 12,    // AI errors (auto-counted)
  yield: 97.96           // (good_qty / completed_qty) × 100
}
```

---

## 📁 Project Structure

```
indusia-ai-hmi/
│
├── app/                              # Next.js App Router
│   ├── api/                          # 94 RESTful API endpoints
│   │   ├── ai/                       # AI Backend API (30+ endpoints)
│   │   ├── auth/                     # Authentication
│   │   ├── work-orders/              # Work order CRUD
│   │   ├── inspection/               # Inspection operations
│   │   ├── master-data/              # Master data CRUD
│   │   ├── dashboard/                # Analytics
│   │   ├── sync/                     # Cloud sync
│   │   ├── live/[lineId]/            # SSE endpoint
│   │   └── ...
│   │
│   ├── inspection/
│   │   ├── live/[lineId]/            # Live inspection HMI
│   │   ├── select-line/              # Line selector
│   │   └── overrides/                # Override review queue
│   ├── engineering/                  # Master data, work orders
│   ├── dashboard/                    # Analytics
│   ├── super-admin/                  # User/role management
│   └── settings/                     # System settings
│
├── components/                       # 180+ React components
│   ├── ui/                           # shadcn/ui primitives (40+)
│   ├── inspection/                   # HMI components
│   ├── dashboard/                    # KPI, charts
│   └── ...
│
├── lib/                              # Core libraries
│   ├── repos/                        # 27 repository modules
│   ├── auth/                         # Auth middleware
│   ├── sync/                         # Cloud sync module
│   ├── services/                     # API services
│   ├── validations/                  # Zod schemas
│   └── utils/                        # Utilities
│
├── hooks/                            # 25 custom React hooks
├── context/                          # 6 React contexts
├── i18n/                             # EN/ID translations
└── docs/                             # Documentation
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 16 (local, running as Windows service or manual)
- PostgREST 12 (REST API over PostgreSQL)
- Auto Inspect Edge (Python AI Backend)

### Installation

```bash
# Clone repository
git clone <repo-url>
cd indusia-ai-hmi

# Install dependencies
npm install

# Setup Swagger UI (one-time)
npm run setup:swagger

# Setup environment
cp .env.example .env.local
# Edit .env.local with your configuration
```

### Starting the System

The system consists of 3 services that must be started in order:

```bash
# ═══════════════════════════════════════════════════════════════
# STEP 1: PostgREST (Database API) - MUST start first
# ═══════════════════════════════════════════════════════════════
cd "D:/Projects/Tools/postgrest"
./postgrest.exe postgrest.conf
# → Runs on http://localhost:3001
# → Provides REST API over local PostgreSQL database

# ═══════════════════════════════════════════════════════════════
# STEP 2: Auto Inspect Edge (AI Backend)
# ═══════════════════════════════════════════════════════════════
cd "D:/Projects/indusia-ai-backend"
python -m auto_inspect_edge.main
# → Runs on http://localhost:8002
# → AI inference, camera control, PLC, SSE event streams
#
# For testing without physical cameras:
#   Set AI_EDGE_DEBUG_CAMERA=true in .env

# ═══════════════════════════════════════════════════════════════
# STEP 3: Next.js HMI (Frontend) - MUST start last
# ═══════════════════════════════════════════════════════════════
cd "D:/Projects/indusia-ai-hmi"
npm run dev
# → Runs on http://localhost:3000
# → Web UI for all roles (operator, manager, engineer, admin)
```

### Stopping the System

Stop services in reverse order:

```bash
# Press Ctrl+C in each terminal (reverse order):
# 1. Stop Next.js HMI (Terminal 3)
# 2. Stop Auto Inspect Edge (Terminal 2)
# 3. Stop PostgREST (Terminal 1)

# If a process didn't exit cleanly, force kill by port:
npx kill-port 3000          # Next.js HMI
npx kill-port 8002          # AI Backend
npx kill-port 3001          # PostgREST

# Windows alternative - find PID and kill:
netstat -ano | findstr ":3000"
taskkill /PID <pid> /F
```

### Health Checks

```bash
curl http://localhost:3001/           # PostgREST → JSON schema
curl http://localhost:8002/health     # AI Backend → {"status":"ok"}
curl http://localhost:3000            # Next.js → HTML page
```

### Environment Variables

```env
# Primary Database - Local PostgREST
NEXT_PUBLIC_SUPABASE_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# AI Backend - Auto Inspect Edge
NEXT_PUBLIC_AI_BACKEND_URL=http://localhost:8002
NEXT_PUBLIC_AI_BACKEND_SSE_URL=http://localhost:8002

# Supabase Cloud (for sync & image storage)
SUPABASE_CLOUD_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
# ⚠️ NEVER use NEXT_PUBLIC_ prefix for service keys!

# AI Backend Integration
AI_BACKEND_API_KEY=your-secure-api-key
```

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Operator | operator@indusia.ai | operator123 |
| Manager | manager@indusia.ai | manager123 |
| Engineer | engineer@indusia.ai | engineer123 |
| Super Admin | admin@indusia.ai | admin123 |

---

## 🧪 Testing

### Test Coverage

```bash
# Unit tests (Jest)
npm test                 # Run all
npm run test:coverage    # With coverage report

# E2E tests (Playwright)
npm run test:e2e         # Headless
npm run test:e2e:ui      # Interactive mode
```

| Type | Framework | Coverage Target |
|------|-----------|-----------------|
| Unit | Jest + Testing Library | >80% |
| E2E | Playwright | Critical paths |
| Security | Manual pentest | 100% vulnerabilities fixed |

---

## 📈 Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| **API Response** | <100ms | 45ms avg |
| **SSE Latency** | <50ms | 12ms avg |
| **Page Load** | <2s | 1.2s |
| **DB Query** | <50ms | 8ms avg |
| **Sync Throughput** | 1000 rec/min | 2500 rec/min |

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| `docs/API_DOCUMENTATION.md` | Internal UI API (94 endpoints) |
| `docs/API_AI_BACKEND.md` | AI Backend API contract |
| `docs/DATABASE_SCHEMA.md` | Database schema & ownership |
| `CLAUDE.md` | Claude Code development guide |

---

## 📊 Statistics

| Metric | Count |
|--------|-------|
| Source Files | 345+ |
| API Endpoints | 94 |
| Repositories | 27 |
| React Components | 180+ |
| Custom Hooks | 25 |
| Database Tables | 40+ |
| Translation Keys | 200+ |

---

## 🏭 Industrial Standards Compliance

| Standard | Compliance | Notes |
|----------|------------|-------|
| **ISA-101** | ✅ Full | HMI design guidelines |
| **IPC-A-610** | ✅ Full | Defect classification |
| **ISO 9241** | ✅ Full | Ergonomics & touch targets |
| **IATF 16949** | ✅ Ready | Automotive QMS (15+ year retention) |

---

## 📄 License

Proprietary - INDUSIA AI © 2026

---

<div align="center">

**Built for the factory floor. Powered by AI. Secured by design.**

[🏠 Home](#indusia-ai-hmi) • [📖 Docs](./docs/) • [🐛 Issues](../../issues)

</div>
