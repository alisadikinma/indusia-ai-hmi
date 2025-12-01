# FASE 5: Auth Integration

## Role
You are a senior Next.js developer implementing authentication for INDUSIA AI HMI - a manufacturing system requiring role-based access control. You implement secure auth flows without breaking existing functionality.

## Context
INDUSIA AI HMI is a production-floor system with:
- Next.js 14+ (App Router, JavaScript only)
- Supabase Postgres (users table with password column for dev)
- Existing `AuthContext.jsx` using localStorage
- Role-based access: operator, manager, engineer, superadmin

Project files for reference:
- `contexts/AuthContext.jsx` - Current localStorage-based auth
- `indusia_schema_v1.md` - Users table structure
- `lib/repos/usersRepo.js` - User queries

Working directory: `C:\xampp\htdocs\indusia-ai-hmi`

## Objective
Integrate authentication dengan API, replacing localStorage-based auth while maintaining same context interface.

## Tasks

### 5.1 Create Auth API Routes

`app/api/auth/login/route.js`:
```js
// POST /api/auth/login
// Body: { email, password }
// Response: { success, data: { user, token } }
// 
// Steps:
// 1. Find user by email
// 2. Compare password (plaintext for dev, hash for prod)
// 3. Check user.status === 'active'
// 4. Return user data with role info
```

`app/api/auth/logout/route.js`:
```js
// POST /api/auth/logout
// Clear any server-side session
// Response: { success: true }
```

`app/api/auth/me/route.js`:
```js
// GET /api/auth/me
// Get current user from session/token
// Response: { success, data: user } or 401
```

`app/api/auth/change-password/route.js`:
```js
// POST /api/auth/change-password
// Body: { userId, currentPassword, newPassword }
// Response: { success: true }
```

### 5.2 Update AuthContext
Modify `contexts/AuthContext.jsx`:

Keep same interface:
```js
{
  user: null | { id, name, email, role, sections, ... },
  isAuthenticated: boolean,
  isLoading: boolean,
  login: async (email, password) => { success, error? },
  logout: async () => void,
  hasPermission: (menuId) => boolean,
  refreshUser: async () => void
}
```

Changes:
- Replace localStorage with API calls
- Store minimal session info in localStorage (just for persistence)
- Fetch full user data from `/api/auth/me` on mount
- Call `/api/auth/login` for login
- Call `/api/auth/logout` for logout

### 5.3 Create Auth Middleware (Optional)
Create `middleware.js` at project root:

```js
import { NextResponse } from 'next/server'

export function middleware(request) {
  // Protected routes that require auth
  const protectedPaths = ['/dashboard', '/inspection', '/admin', '/engineering']
  
  const isProtected = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )
  
  if (isProtected) {
    // Check for auth token/session
    // Redirect to /login if not authenticated
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
}
```

### 5.4 Create Login Page Enhancement
If `app/login/page.js` exists, ensure it:
- Uses AuthContext's login function
- Shows loading state
- Handles errors gracefully
- Redirects on success

## Auth Flow
```
1. User visits protected page
2. Middleware checks session
3. If no session → redirect to /login
4. User enters credentials
5. POST /api/auth/login
6. On success → store session, redirect to dashboard
7. On subsequent visits → GET /api/auth/me to restore user
```

## Session Strategy (Dev)
For development, use simple approach:
- Store `userId` in localStorage after login
- On mount, fetch `/api/auth/me?userId=xxx`
- For production, migrate to proper JWT or Supabase Auth

## Constraints
- Keep EXACT same AuthContext interface
- Existing components using AuthContext must work unchanged
- Do NOT implement full Supabase Auth yet (future enhancement)
- Password comparison is plaintext for dev (noted in users table)
- Add proper error messages for UX

## Output Files
```
app/api/auth/
├── login/route.js
├── logout/route.js
├── me/route.js
└── change-password/route.js

contexts/
└── AuthContext.jsx (modify)

middleware.js (optional)
```

## Validation Checklist
- [ ] Login with valid credentials works
- [ ] Login with invalid credentials shows error
- [ ] Logout clears session
- [ ] Protected pages redirect to login when not authenticated
- [ ] User persists across page refresh
- [ ] Role-based permissions still work

## Estimated Time
1-2 hours
