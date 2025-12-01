# FASE 3: API Routes

## Role
You are a senior Next.js developer building REST API routes for INDUSIA AI HMI - a manufacturing visual inspection system. You follow REST conventions and return consistent JSON responses.

## Context
INDUSIA AI HMI is a production-floor system with:
- Next.js 14+ (App Router, JavaScript only)
- Supabase Postgres for database
- Repository layer ready di `lib/repos/*` (from Fase 2)

Project files for reference:
- `indusia_schema_v1.md` - Database schema
- `PRODUCT_REQUIREMENTS_DOCUMENT_PRD_v2.md` - API requirements section
- `lib/repos/*` - Repository functions to use

Working directory: `C:\xampp\htdocs\indusia-ai-hmi`

## Objective
Create Next.js API routes yang wrap repository layer dengan consistent response format.

## Response Format Standard
```js
// Success (single item)
{ success: true, data: { ... } }

// Success (list)
{ success: true, data: [...], total: 100 }

// Success (list with pagination)
{ success: true, data: [...], total: 100, page: 1, limit: 20 }

// Error
{ success: false, error: "Error message" }
```

## Tasks

### 3.1 Users API

`app/api/users/route.js`:
```js
// GET /api/users?role=operator&section=sec-smt&status=active
// POST /api/users { name, email, role_id, sections, ... }
```

`app/api/users/[id]/route.js`:
```js
// GET /api/users/:id
// PATCH /api/users/:id { name, email, ... }
// DELETE /api/users/:id (soft delete)
```

### 3.2 Roles API

`app/api/roles/route.js`:
```js
// GET /api/roles
// POST /api/roles { id, name, description }
```

`app/api/roles/[id]/route.js`:
```js
// GET /api/roles/:id
// PATCH /api/roles/:id
// DELETE /api/roles/:id
```

### 3.3 Permissions API

`app/api/permissions/route.js`:
```js
// GET /api/permissions → full matrix { roleId: [menuIds] }
```

`app/api/permissions/[roleId]/route.js`:
```js
// GET /api/permissions/:roleId → [menuIds]
// PUT /api/permissions/:roleId { menuIds: [...] }
```

### 3.4 Overrides API

`app/api/overrides/route.js`:
```js
// GET /api/overrides?status=pending&section_id=sec-smt&customer_id=cust-A&from=2024-01-01&to=2024-12-31
// POST /api/overrides { board_id, defect_type, reason, operator_notes, ... }
```

`app/api/overrides/[id]/route.js`:
```js
// GET /api/overrides/:id
// PATCH /api/overrides/:id { action: 'approve'|'reject', reviewer_notes }
```

`app/api/overrides/stats/route.js`:
```js
// GET /api/overrides/stats → { pending: 5, approved: 20, rejected: 3 }
```

### 3.5 Event Log API

`app/api/event-log/route.js`:
```js
// GET /api/event-log?type=LOGIN&source=HMI&user_id=op-1&from=...&to=...&page=1&limit=20
// POST /api/event-log { type, source, user_id, details }
```

### 3.6 Notifications API

`app/api/notifications/route.js`:
```js
// GET /api/notifications?user_id=op-1&read=false&type=SYSTEM
// PATCH /api/notifications { ids: [...], read: true }
```

`app/api/notifications/unread-count/route.js`:
```js
// GET /api/notifications/unread-count?user_id=op-1 → { count: 5 }
```

### 3.7 Master Data API

`app/api/master-data/customers/route.js`:
```js
// GET /api/master-data/customers
```

`app/api/master-data/sections/route.js`:
```js
// GET /api/master-data/sections
```

`app/api/master-data/lines/route.js`:
```js
// GET /api/master-data/lines?section_id=sec-smt&customer_id=cust-A
```

`app/api/master-data/boards/route.js`:
```js
// GET /api/master-data/boards?customer_id=cust-A
```

`app/api/master-data/menu-items/route.js`:
```js
// GET /api/master-data/menu-items
```

## Route Template
```js
import { NextResponse } from 'next/server'
import * as repo from '@/lib/repos/xxxRepo'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter')
    
    const data = await repo.list({ filter })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const data = await repo.create(body)
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

## Constraints
- Use repository layer (lib/repos/*) - do NOT query Supabase directly
- JavaScript only (.js)
- Return proper HTTP status codes: 200, 201, 400, 404, 500
- Validate required fields before calling repo
- Do NOT add authentication yet (Fase 5)

## Output Files
```
app/api/
├── users/
│   ├── route.js
│   └── [id]/route.js
├── roles/
│   ├── route.js
│   └── [id]/route.js
├── permissions/
│   ├── route.js
│   └── [roleId]/route.js
├── overrides/
│   ├── route.js
│   ├── [id]/route.js
│   └── stats/route.js
├── event-log/
│   └── route.js
├── notifications/
│   ├── route.js
│   └── unread-count/route.js
└── master-data/
    ├── customers/route.js
    ├── sections/route.js
    ├── lines/route.js
    ├── boards/route.js
    └── menu-items/route.js
```

## Validation
- Test each endpoint with curl or Postman
- GET requests return data array
- POST creates new record
- Error responses have proper status codes

## Estimated Time
2-3 hours
