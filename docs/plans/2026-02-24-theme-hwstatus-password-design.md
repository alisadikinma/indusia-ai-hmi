# Design: Theme Default + HW Status Recovery + Change Password

**Date:** 2026-02-24
**Status:** Draft

---

## Task 1: Dark/Light Mode — Default Light + Global Toggle

### Problem
- Current default is dark mode; user wants light mode as default
- Theme toggle only exists on inspection pages (HeaderInfoBar)
- All other pages (Dashboard, Engineering, Admin, etc.) have no toggle

### Solution

1. **ThemeContext.jsx** — Change default from `'dark'` to `'light'`
2. **TopNav.jsx** — Add Sun/Moon toggle button (right side, before notification bell)
3. **HeaderInfoBar.jsx** — Remove duplicate toggle (now global in TopNav)
4. **Login page** — Already has useTheme(); logo switching works. No change needed.

### Data Integration Map

| Component | Data Source | Existing? | Notes |
|-----------|-----------|-----------|-------|
| ThemeContext | localStorage `indusia_theme` | Yes | Change default only |
| TopNav toggle | useTheme() hook | Yes | Add button UI |
| Logo switching | ThemeContext isDark | Yes | Already in 3 files |
| CSS variables | globals.css html.light | Yes | Already defined |

---

## Task 2: PLC/Camera Auto-Recovery Bug Fix

### Problem
When machine stops, PLC status shows OFF. When machine restarts, PLC/Camera don't auto-recover to ON — requires browser refresh.

### Root Cause
In `useLiveInspection.js`, `runProcess()` preserves stale OFFLINE hardware status:
```js
cameras: prev.cameras.length > 0
  ? prev.cameras  // ← KEEPS STALE OFFLINE DATA
  : [{ id: 'cam-01', name: 'Inspection Camera', status: 'ONLINE' }]
```

### Solution

1. **runProcess()** — Always force ONLINE status on RUN (don't preserve stale data)
2. **handleHardwareStatus()** — Verify SSE device_status events always update state correctly
3. **SSE reconnection** — Ensure hardware status refreshes when SSE stream reconnects after backend restart

### Data Integration Map

| Component | Data Source | Existing? | Notes |
|-----------|-----------|-----------|-------|
| hardwareStatus state | SSE device_status stream | Yes | Fix stale data handling |
| CAM/PLC chips | effectiveHardwareStatus | Yes | No change needed (reads state) |
| SSE connection | aiBackendService | Yes | Verify reconnect works |

---

## Task 3: Change Password (Self-Service + Admin Reset)

### Problem
- No UI for users to change their own password
- Super-admin "Reset Password" button calls missing API endpoint

### Solution

#### 3A: Self-Service Change Password
1. **New modal component** — `ChangePasswordModal.jsx` in `components/common/`
   - Fields: current password, new password, confirm password
   - Calls existing `POST /api/auth/change-password`
   - Password requirements: min 8 chars, uppercase, lowercase, number
2. **TopNav user dropdown** — Add "Change Password" menu item (all roles)

#### 3B: Admin Reset Password
1. **New API route** — `app/api/users/[id]/reset-password/route.js`
   - Superadmin only (permission: `users:update`)
   - Generates or accepts new password
   - Hashes with bcrypt via existing `lib/utils/password.js`
2. **useUsers hook** — `resetPassword()` already calls this endpoint; just needs backend

### Data Integration Map

| Component | Data Source | Existing? | Notes |
|-----------|-----------|-----------|-------|
| Change password API | /api/auth/change-password | Yes | Already implemented |
| Reset password API | /api/users/:id/reset-password | NO | Must create |
| Password hashing | lib/utils/password.js | Yes | hashPassword, verifyPassword |
| User dropdown | TopNav.jsx | Yes | Add menu item |
| useUsers hook | resetPassword() | Yes | Endpoint missing |
| Zod validation | lib/validations/schemas.js | Partial | Add changePasswordSchema |

---

## Implementation Order

1. Task 1 (Theme) — smallest, foundation for visual testing
2. Task 3 (Password) — new feature, independent of other tasks
3. Task 2 (HW Status) — bug fix, needs live backend for testing
