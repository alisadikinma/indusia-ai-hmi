# FASE 10: Validation & Security

## Role
You are a senior security-focused developer implementing input validation and security hardening for INDUSIA AI HMI - ensuring data integrity and protection against common vulnerabilities.

## Context
INDUSIA AI HMI is a production-floor system with:
- Next.js 14+ (App Router, JavaScript only)
- Multiple user roles with different permissions
- Sensitive manufacturing data
- Must prevent unauthorized access and data corruption

Working directory: `C:\xampp\htdocs\indusia-ai-hmi`

## Objective
Implement comprehensive input validation, API security, and role-based access control enforcement.

## Tasks

### 10.1 Install Validation Library
```bash
npm install zod
```

### 10.2 Create Validation Schemas
Create `lib/validations/schemas.js`:
```js
import { z } from 'zod'

// User schemas
export const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  role_id: z.string().min(1),
  sections: z.array(z.string()).default([]),
  whatsapp: z.string().optional(),
  password: z.string().min(6).optional()
})

export const updateUserSchema = createUserSchema.partial()

// Role schemas
export const createRoleSchema = z.object({
  id: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(100),
  description: z.string().optional()
})

// Override schemas
export const createOverrideSchema = z.object({
  board_id: z.string().min(1),
  defect_type: z.string().min(1),
  location: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(),
  reason: z.string().min(1),
  operator_notes: z.string().optional(),
  operator_id: z.string().min(1),
  operator_name: z.string().min(1),
  section_id: z.string().min(1),
  customer_id: z.string().min(1)
})

export const reviewOverrideSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reviewer_id: z.string().min(1),
  reviewer_name: z.string().min(1),
  reviewer_notes: z.string().optional()
})

// Notification schemas
export const createNotificationSchema = z.object({
  type: z.enum(['SYSTEM', 'WORKFLOW']),
  category: z.string().min(1),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
  user_id: z.string().optional(),
  section_id: z.string().optional(),
  line_id: z.string().optional(),
  source: z.string().optional()
})

// Event log schemas
export const createEventSchema = z.object({
  type: z.string().min(1),
  source: z.string().min(1),
  user_id: z.string().optional(),
  user_name: z.string().optional(),
  role_id: z.string().optional(),
  section_id: z.string().optional(),
  details: z.record(z.any()).optional()
})

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(6),
  confirm_password: z.string().min(6)
}).refine(data => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password']
})

// Image upload schemas
export const imageUploadSchema = z.object({
  override_id: z.string().min(1),
  section_id: z.string().min(1),
  board_id: z.string().min(1),
  user_id: z.string().min(1)
})

// Model deployment schemas
export const deployModelSchema = z.object({
  user_id: z.string().min(1)
})

// Query params schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
})

export const overrideFiltersSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  section_id: z.string().optional(),
  customer_id: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
})
```

### 10.3 Validation Helper
Create `lib/validations/validate.js`:
```js
import { ZodError } from 'zod'

export function validate(schema, data) {
  try {
    return { success: true, data: schema.parse(data) }
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
      return { success: false, errors }
    }
    throw error
  }
}

export function validateOrThrow(schema, data) {
  const result = validate(schema, data)
  if (!result.success) {
    const error = new Error('Validation failed')
    error.statusCode = 400
    error.code = 'VALIDATION_ERROR'
    error.details = result.errors
    throw error
  }
  return result.data
}

// Middleware-style validator for API routes
export function withValidation(schema) {
  return async (request) => {
    const body = await request.json()
    return validateOrThrow(schema, body)
  }
}
```

### 10.4 Apply Validation to API Routes

Example update for `app/api/users/route.js`:
```js
import { NextResponse } from 'next/server'
import { createUserSchema } from '@/lib/validations/schemas'
import { validate } from '@/lib/validations/validate'
import * as usersRepo from '@/lib/repos/usersRepo'

export async function POST(request) {
  try {
    const body = await request.json()
    
    // Validate input
    const validation = validate(createUserSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 }
      )
    }
    
    const user = await usersRepo.create(validation.data)
    return NextResponse.json({ success: true, data: user }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

### 10.5 Role-Based Access Control Middleware
Create `lib/auth/rbac.js`:
```js
// Permission definitions
export const PERMISSIONS = {
  // User management
  'users:read': ['superadmin', 'manager'],
  'users:create': ['superadmin'],
  'users:update': ['superadmin'],
  'users:delete': ['superadmin'],
  
  // Role management
  'roles:read': ['superadmin'],
  'roles:create': ['superadmin'],
  'roles:update': ['superadmin'],
  'roles:delete': ['superadmin'],
  
  // Override management
  'overrides:read': ['operator', 'manager', 'engineer', 'superadmin'],
  'overrides:create': ['operator'],
  'overrides:review': ['manager', 'superadmin'],
  
  // Model management
  'models:read': ['engineer', 'superadmin'],
  'models:deploy': ['engineer', 'superadmin'],
  
  // System
  'system:read': ['manager', 'engineer', 'superadmin'],
  'admin:access': ['superadmin']
}

export function hasPermission(userRole, permission) {
  const allowedRoles = PERMISSIONS[permission]
  if (!allowedRoles) return false
  return allowedRoles.includes(userRole)
}

export function requirePermission(permission) {
  return async (request, user) => {
    if (!user) {
      throw { statusCode: 401, message: 'Unauthorized' }
    }
    
    if (!hasPermission(user.role_id, permission)) {
      throw { statusCode: 403, message: 'Forbidden: Insufficient permissions' }
    }
    
    return true
  }
}
```

### 10.6 Auth Middleware for API Routes
Create `lib/auth/apiAuth.js`:
```js
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from './rbac'

export async function getAuthUser(request) {
  // Get user from session/token
  const authHeader = request.headers.get('authorization')
  const userId = request.headers.get('x-user-id') // or from cookie/session
  
  if (!userId) {
    return null
  }
  
  const supabase = await createClient()
  const { data: user } = await supabase
    .from('users')
    .select('id, name, email, role_id, sections, status')
    .eq('id', userId)
    .single()
  
  if (!user || user.status !== 'active') {
    return null
  }
  
  return user
}

export function withAuth(permission = null) {
  return (handler) => {
    return async (request, context) => {
      const user = await getAuthUser(request)
      
      if (!user) {
        return Response.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }
      
      if (permission && !hasPermission(user.role_id, permission)) {
        return Response.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        )
      }
      
      // Add user to request context
      request.user = user
      
      return handler(request, context)
    }
  }
}
```

### 10.7 Apply Auth to Protected Routes

Example for `app/api/users/route.js`:
```js
import { withAuth } from '@/lib/auth/apiAuth'

async function handleGET(request) {
  // request.user is available here
  const users = await usersRepo.list()
  return Response.json({ success: true, data: users })
}

async function handlePOST(request) {
  const body = await request.json()
  // ... validation and create
}

export const GET = withAuth('users:read')(handleGET)
export const POST = withAuth('users:create')(handlePOST)
```

### 10.8 Section-Based Access Control
Create `lib/auth/sectionAccess.js`:
```js
// Check if user has access to specific section
export function canAccessSection(user, sectionId) {
  // Superadmin can access all
  if (user.role_id === 'superadmin') return true
  
  // Check if section is in user's assigned sections
  return user.sections?.includes(sectionId)
}

export function filterBySection(user, data, sectionField = 'section_id') {
  if (user.role_id === 'superadmin') return data
  
  return data.filter(item => 
    user.sections?.includes(item[sectionField])
  )
}
```

### 10.9 SQL Injection Prevention
Already handled by Supabase client, but add sanitization:

Create `lib/utils/sanitize.js`:
```js
// Sanitize string for display (prevent XSS)
export function sanitizeHTML(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Sanitize object keys (prevent prototype pollution)
export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj
  
  const dangerous = ['__proto__', 'constructor', 'prototype']
  const clean = {}
  
  for (const key of Object.keys(obj)) {
    if (!dangerous.includes(key)) {
      clean[key] = sanitizeObject(obj[key])
    }
  }
  
  return clean
}

// Validate ID format (prevent injection via IDs)
export function isValidId(id) {
  if (!id) return false
  // Allow alphanumeric, dash, underscore
  return /^[a-zA-Z0-9_-]+$/.test(id)
}
```

### 10.10 Rate Limiting (Simple Implementation)
Create `lib/rateLimit.js`:
```js
const requests = new Map()

export function rateLimit(options = {}) {
  const {
    windowMs = 60 * 1000, // 1 minute
    max = 100 // requests per window
  } = options
  
  return async (request) => {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const key = `${ip}:${request.url}`
    
    const now = Date.now()
    const windowStart = now - windowMs
    
    // Clean old entries
    const current = requests.get(key) || []
    const recent = current.filter(time => time > windowStart)
    
    if (recent.length >= max) {
      return {
        allowed: false,
        retryAfter: Math.ceil((recent[0] + windowMs - now) / 1000)
      }
    }
    
    recent.push(now)
    requests.set(key, recent)
    
    return { allowed: true }
  }
}

// Apply to route
export function withRateLimit(options) {
  const limiter = rateLimit(options)
  
  return (handler) => {
    return async (request, context) => {
      const result = await limiter(request)
      
      if (!result.allowed) {
        return Response.json(
          { success: false, error: 'Too many requests' },
          { 
            status: 429,
            headers: { 'Retry-After': result.retryAfter.toString() }
          }
        )
      }
      
      return handler(request, context)
    }
  }
}
```

### 10.11 Security Headers
Create `middleware.js` (or update existing):
```js
import { NextResponse } from 'next/server'

export function middleware(request) {
  const response = NextResponse.next()
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // CORS for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }
  
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
```

### 10.12 Audit Sensitive Actions
Create `lib/audit.js`:
```js
import { supabase } from '@/lib/supabaseClient'

const SENSITIVE_ACTIONS = [
  'users:create',
  'users:update',
  'users:delete',
  'roles:update',
  'permissions:update',
  'models:deploy',
  'overrides:review'
]

export async function auditLog(action, user, details) {
  if (!SENSITIVE_ACTIONS.includes(action)) return
  
  await supabase.from('event_log').insert({
    id: `audit_${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: `AUDIT_${action.toUpperCase().replace(':', '_')}`,
    source: 'SECURITY',
    user_id: user?.id,
    user_name: user?.name,
    role_id: user?.role_id,
    details: {
      action,
      ...details,
      ip: details.ip || 'unknown',
      user_agent: details.userAgent || 'unknown'
    }
  })
}
```

## Constraints
- All user input must be validated before processing
- All protected routes must check authentication
- Role-based permissions must be enforced
- Sensitive actions must be audited
- No raw SQL queries (use Supabase client)

## Output Files
```
lib/validations/
├── schemas.js
└── validate.js

lib/auth/
├── rbac.js
├── apiAuth.js
└── sectionAccess.js

lib/utils/
└── sanitize.js

lib/
├── rateLimit.js
└── audit.js

middleware.js (update)

app/api/**/route.js (update all with validation)
```

## Validation Checklist
- [ ] All POST/PUT/PATCH routes validate input
- [ ] Invalid input returns 400 with error details
- [ ] Protected routes return 401 without auth
- [ ] Role mismatch returns 403
- [ ] Section access enforced
- [ ] Rate limiting prevents abuse
- [ ] Security headers present
- [ ] Sensitive actions audited

## Estimated Time
3-4 hours
