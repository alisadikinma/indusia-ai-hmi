# FASE 4: Hook Migration

## Role
You are a senior React developer migrating hooks from mock data to real API calls for INDUSIA AI HMI. You ensure backward compatibility and graceful degradation when API fails.

## Context
INDUSIA AI HMI is a production-floor system with:
- Next.js 14+ (App Router, JavaScript only)
- Existing frontend hooks using mock data
- API routes ready di `app/api/*` (from Fase 3)

Project files for reference:
- `hooks/useUsers.js` - Current mock implementation
- `hooks/useRoles.js` - Current mock implementation
- `hooks/usePermissions.js` - Current mock implementation
- `hooks/useEventLog.js` - Current mock implementation
- `contexts/NotificationContext.jsx` - Current mock implementation
- `data/masterData.js` - Mock data shapes

Working directory: `C:\xampp\htdocs\indusia-ai-hmi`

## Objective
Migrate existing hooks ke API calls dengan mandatory fallback ke mock data. UI HARUS tetap bekerja tanpa perubahan.

## Critical Rule: Fallback Pattern
```js
const fetchData = async () => {
  try {
    const res = await fetch('/api/endpoint')
    if (!res.ok) throw new Error('API failed')
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return json.data
  } catch (error) {
    console.warn('API failed, using mock data:', error.message)
    return mockData // REQUIRED fallback
  }
}
```

## Tasks

### 4.1 Migrate useUsers Hook
Edit `hooks/useUsers.js`:

Current return shape (MUST KEEP SAME):
```js
{
  users: [],
  loading: boolean,
  error: null | string,
  getUserById: (id) => user,
  createUser: async (data) => user,
  updateUser: async (id, data) => user,
  deleteUser: async (id) => boolean,
  refreshUsers: async () => void
}
```

API endpoints:
- GET `/api/users` → list
- POST `/api/users` → create
- PATCH `/api/users/:id` → update
- DELETE `/api/users/:id` → delete

### 4.2 Migrate useRoles Hook
Edit `hooks/useRoles.js`:

Current return shape (MUST KEEP SAME):
```js
{
  roles: [],
  loading: boolean,
  error: null | string,
  getRoleById: (id) => role,
  createRole: async (data) => role,
  updateRole: async (id, data) => role,
  deleteRole: async (id) => boolean
}
```

### 4.3 Migrate usePermissions Hook
Edit `hooks/usePermissions.js`:

Current return shape (MUST KEEP SAME):
```js
{
  permissions: { roleId: [menuIds] },
  loading: boolean,
  hasPermission: (roleId, menuId) => boolean,
  setRolePermissions: async (roleId, menuIds) => void,
  getPermissionsByRole: (roleId) => [menuIds]
}
```

### 4.4 Migrate useEventLog Hook
Edit `hooks/useEventLog.js`:

Current return shape (MUST KEEP SAME):
```js
{
  events: [],
  loading: boolean,
  error: null | string,
  filters: { type, source, userId, dateRange },
  setFilters: (filters) => void,
  logEvent: async (eventData) => event,
  refreshEvents: async () => void,
  // Pagination if exists
  page: number,
  totalPages: number,
  setPage: (page) => void
}
```

### 4.5 Migrate NotificationContext
Edit `contexts/NotificationContext.jsx`:

Current context value (MUST KEEP SAME):
```js
{
  notifications: [],
  unreadCount: number,
  loading: boolean,
  markAsRead: async (id) => void,
  markAllAsRead: async () => void,
  refreshNotifications: async () => void
}
```

### 4.6 Create NEW useOverrides Hook
Create `hooks/useOverrides.js`:

```js
export function useOverrides(initialFilters = {}) {
  return {
    overrides: [],
    loading: boolean,
    error: null | string,
    filters: { status, section_id, customer_id, dateRange },
    setFilters: (filters) => void,
    stats: { pending: 0, approved: 0, rejected: 0 },
    createOverride: async (data) => override,
    approveOverride: async (id, notes) => override,
    rejectOverride: async (id, notes) => override,
    refreshOverrides: async () => void
  }
}
```

### 4.7 Create NEW useMasterData Hook
Create `hooks/useMasterData.js`:

```js
export function useMasterData() {
  return {
    customers: [],
    sections: [],
    lines: [],
    boards: [],
    menuItems: [],
    loading: boolean,
    error: null | string,
    getLinesBySection: (sectionId) => lines[],
    getBoardsByCustomer: (customerId) => boards[],
    refreshMasterData: async () => void
  }
}
```

## Constraints
- Keep EXACT same return shapes - UI must work without changes
- Mock data fallback is MANDATORY
- Do NOT delete mock data imports (keep as fallback)
- Add loading states
- Add error handling
- Use SWR or simple useState/useEffect pattern

## Files to Modify
```
hooks/
├── useUsers.js (modify)
├── useRoles.js (modify)
├── usePermissions.js (modify)
├── useEventLog.js (modify)
├── useOverrides.js (create NEW)
└── useMasterData.js (create NEW)

contexts/
└── NotificationContext.jsx (modify)
```

## Validation Checklist
- [ ] All existing pages render without errors
- [ ] Console shows "API failed, using mock data" when API down
- [ ] Console shows no errors when API working
- [ ] Loading states display correctly
- [ ] CRUD operations work through API
- [ ] Fallback to mock when API fails

## Estimated Time
2-3 hours
