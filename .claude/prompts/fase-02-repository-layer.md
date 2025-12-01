# FASE 2: Repository Layer

## Role
You are a senior Next.js developer building the backend for INDUSIA AI HMI - a manufacturing visual inspection system. You write clean, modular JavaScript code with proper error handling.

## Context
INDUSIA AI HMI is a production-floor system with:
- Next.js 14+ (App Router, JavaScript only)
- Supabase Postgres for database
- Existing frontend with mock data that must keep working

Project files for reference:
- `indusia_schema_v1.md` - Database schema (IMPORTANT: check table/column names)
- `PRODUCT_REQUIREMENTS_DOCUMENT_PRD_v2.md` - Full system specification
- `data/masterData.js` - Current mock data shapes to match

Working directory: `C:\xampp\htdocs\indusia-ai-hmi`

Supabase client sudah ready di `lib/supabaseClient.js` (from Fase 1).

## Objective
Create repository layer untuk isolasi database operations dari API routes. Repository pattern memudahkan testing dan maintenance.

## Tasks

### 2.1 Create Base Repository Helper
Create `lib/repos/index.js`:
```js
// Common error handler
export function handleError(error, context) {
  console.error(`[${context}]`, error)
  return { error: error.message || 'Unknown error' }
}

// Response formatter
export function formatResponse(data, error = null) {
  if (error) return { success: false, error }
  return { success: true, data }
}
```

### 2.2 Users Repository
Create `lib/repos/usersRepo.js`:

| Function | Params | Returns | Supabase Query |
|----------|--------|---------|----------------|
| `list` | `{ role, section, status }` | `users[]` | `users` table with filters |
| `getById` | `id` | `user` | `.eq('id', id).single()` |
| `getByEmail` | `email` | `user` | `.eq('email', email).single()` |
| `create` | `userData` | `user` | `.insert(userData)` |
| `update` | `id, userData` | `user` | `.update(userData).eq('id', id)` |
| `delete` | `id` | `boolean` | `.update({ status: 'disabled' })` |

Data shape must match `userProfiles` in masterData.js:
```js
{
  id, name, email, role, sections[], 
  whatsapp, status, mustChangePassword,
  notificationPreferences, createdAt
}
```

### 2.3 Roles Repository
Create `lib/repos/rolesRepo.js`:

| Function | Returns |
|----------|---------|
| `list()` | `roles[]` |
| `getById(id)` | `role` |
| `create(data)` | `role` |
| `update(id, data)` | `role` |
| `delete(id)` | `boolean` |

### 2.4 Permissions Repository
Create `lib/repos/permissionsRepo.js`:

| Function | Description |
|----------|-------------|
| `getByRole(roleId)` | Get menu_ids for role from `role_menu_permissions` |
| `setRolePermissions(roleId, menuIds[])` | Replace all permissions for role |
| `getAllPermissions()` | Get full permission matrix (all roles → menus) |

### 2.5 Overrides Repository
Create `lib/repos/overridesRepo.js`:

| Function | Params | Description |
|----------|--------|-------------|
| `list` | `{ status, section_id, customer_id, from, to }` | Filter overrides |
| `getById` | `id` | Single override with board info |
| `create` | `overrideData` | New override (status: 'pending') |
| `approve` | `id, reviewerId, reviewerName, notes` | Set status: 'approved' |
| `reject` | `id, reviewerId, reviewerName, notes` | Set status: 'rejected' |
| `getStats` | - | Count by status |

### 2.6 Event Log Repository
Create `lib/repos/eventLogRepo.js`:

| Function | Params | Description |
|----------|--------|-------------|
| `list` | `{ type, source, userId, from, to, page, limit }` | Paginated events |
| `create` | `eventData` | Insert new event |

### 2.7 Notifications Repository
Create `lib/repos/notificationsRepo.js`:

| Function | Params | Description |
|----------|--------|-------------|
| `list` | `userId, { read, type, severity }` | User's notifications |
| `markAsRead` | `id` | Set read: true |
| `markAllAsRead` | `userId` | Batch update |
| `create` | `notificationData` | New notification |
| `getUnreadCount` | `userId` | Count where read=false |

### 2.8 Master Data Repository
Create `lib/repos/masterDataRepo.js`:

| Function | Description |
|----------|-------------|
| `getCustomers()` | All customers |
| `getSections()` | All sections |
| `getLines(filters)` | Lines, optional filter by section/customer |
| `getBoards(filters)` | Boards, optional filter by customer |
| `getMenuItems()` | All menu items |

## Constraints
- JavaScript only (.js)
- Use `supabase` from `lib/supabaseClient.js`
- Column names in DB are snake_case (e.g., `created_at`)
- Return data in camelCase to match frontend expectations
- Add proper error handling with try/catch
- Do NOT modify any existing files

## Output Files
```
lib/repos/
├── index.js
├── usersRepo.js
├── rolesRepo.js
├── permissionsRepo.js
├── overridesRepo.js
├── eventLogRepo.js
├── notificationsRepo.js
└── masterDataRepo.js
```

## Validation
- Each repo can be imported without errors
- Test query: `await usersRepo.list()` returns array

## Estimated Time
2-3 hours
