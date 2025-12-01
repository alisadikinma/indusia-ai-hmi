# INDUSIA AI HMI System

Sistem Human-Machine Interface (HMI) untuk visual inspection manufacturing, dibangun dengan Next.js dan Supabase.

---

## 🎯 Overview

INDUSIA AI HMI adalah platform end-to-end untuk inspeksi visual di lantai produksi, terdiri dari:

- **Operator HMI** — UI inspeksi & submit false call override
- **Manager Console** — Review & approve/reject override
- **Engineering Console** — Dataset & model management
- **Admin Panel** — RBAC (roles, menu, permissions)
- **System Health Monitoring** — Status AI model, edge device, cameras
- **Notifications & Event Logs** — Tracking semua aktivitas sistem

---

## 🛠 Tech Stack

| Layer       | Technology                          |
| ----------- | ----------------------------------- |
| Frontend    | Next.js 13.5 (App Router), React 18 |
| Styling     | Tailwind CSS, shadcn/ui (Radix)     |
| State       | React Context, Custom Hooks         |
| Database    | Supabase (Postgres + pgvector)      |
| Auth        | Supabase Auth (planned)             |
| AI Training | FastAPI + Modal.com (separate)      |
| i18n        | Custom (ID/EN)                      |

---

## 📁 Struktur Folder

```
hmi-dashboard/
├── app/                    # Next.js App Router pages
│   ├── engineering/        # Master data management
│   ├── event-log/          # Event log viewer
│   ├── inspection/         # Overrides & inspection result
│   ├── login/              # Login page
│   ├── settings/           # Sync settings
│   ├── super-admin/        # Users, roles, permissions
│   ├── layout.js           # Root layout
│   └── page.js             # Dashboard
│
├── components/
│   ├── common/             # Reusable UI (Card, Badge, etc)
│   ├── event-log/          # Event log components
│   ├── help/               # Help overlay & shortcuts
│   ├── inspection/         # Override modals
│   ├── layout/             # SideNav, TopNav
│   ├── notifications/      # Notification drawer & bell
│   ├── sync/               # Sync progress & queue
│   ├── system/             # System health bar & chips
│   └── ui/                 # shadcn/ui primitives
│
├── context/                # React contexts
│   ├── AuthContext.jsx
│   ├── HelpOverlayContext.jsx
│   ├── I18nContext.jsx
│   ├── NotificationContext.jsx
│   └── SystemHealthContext.jsx
│
├── data/                   # Mock data (akan diganti API)
│   ├── masterData.js
│   ├── mockEvents.js
│   └── mockNotifications.js
│
├── hooks/                  # Custom hooks
│   ├── useEventLog.js
│   ├── useNotifications.js
│   ├── usePermissions.js
│   ├── useRoles.js
│   ├── useUsers.js
│   └── ...
│
├── i18n/                   # Translation files
│   ├── en.json
│   └── id.json
│
├── lib/                    # Utilities & Supabase client
│   └── utils.ts
│
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm atau yarn
- Supabase project (untuk production)

### Installation

```bash
# Clone repository
git clone <repo-url>
cd hmi-dashboard

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### Environment Variables

Buat file `.env` dengan:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Run Development Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

---

## 📜 Available Scripts

| Script          | Deskripsi                   |
| --------------- | --------------------------- |
| `npm run dev`   | Start development server    |
| `npm run build` | Build untuk production      |
| `npm run start` | Start production server     |
| `npm run lint`  | Jalankan ESLint             |
| `npm run typecheck` | Check TypeScript errors |

---

## 👥 User Roles

| Role        | Capabilities                                   |
| ----------- | ---------------------------------------------- |
| Operator    | Inspeksi UI, submit false call override        |
| Manager     | Review overrides, approve/reject               |
| Engineer    | Dataset, model management, sync                |
| Super Admin | Full access, user/role/menu permissions        |

---

## 📦 Core Modules

### 1. Override Workflow
```
Operator submit → pending → Manager review → approved/rejected
```

### 2. System Health
Monitoring komponen: AI model, edge server, cameras, sync pipeline.  
Status: `ok` | `warning` | `error` | `degraded` | `offline`

### 3. Event Log
Track semua aktivitas: login, override, sync jobs, training events.

### 4. Notifications
Trigger dari: system events, workflow events, override updates.

---

## 🗄 Database Schema

Full schema ada di `indusia_schema_v1.md`. Tabel utama:

- `customers`, `sections`, `lines`, `boards` — Master data
- `users`, `roles`, `role_menu_permissions` — RBAC
- `overrides` — Override submissions
- `notifications`, `event_log` — Tracking
- `system_events` — Health monitoring
- `override_embeddings`, `kb_articles` — Semantic search (future)

---

## 🔮 Roadmap

1. [ ] Migrasi hooks dari mock → Supabase API
2. [ ] Repository layer (`lib/repos/`)
3. [ ] API routes (`app/api/`)
4. [ ] FastAPI microservice untuk AI training
5. [ ] Modal.com integration
6. [ ] AI Assistant dengan semantic search

---

## 📚 Documentation

- **PRD**: `PRODUCT_REQUIREMENTS_DOCUMENT_PRD_v2.md`
- **Schema**: `indusia_schema_v1.md`

---

## 📄 License

Proprietary — INDUSIA AI
