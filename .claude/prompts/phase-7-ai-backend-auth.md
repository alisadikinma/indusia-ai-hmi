# Phase 7: AI Backend Authentication & Infrastructure

## Objective
Create authentication middleware dan directory structure untuk AI Backend API integration.

---

## Context

AI Backend (Python/FastAPI) akan berkomunikasi dengan Next.js melalui REST API menggunakan API Key authentication. Semua endpoint `/api/ai/*` harus:
1. Validate X-API-Key header
2. Return consistent response format
3. Log access untuk audit

---

## Task 1: Create API Key Authentication Middleware

### 1.1 `lib/auth/apiKeyAuth.js`

```javascript
/**
 * API Key Authentication for AI Backend
 *
 * Usage:
 *   export const POST = withApiKeyAuth(handlePOST)
 */

import { NextResponse } from 'next/server'

/**
 * Validate API key from X-API-Key header
 */
export function validateApiKey(request) {
  const apiKey = request.headers.get('x-api-key')
  const validKey = process.env.AI_BACKEND_API_KEY

  if (!validKey) {
    console.error('AI_BACKEND_API_KEY not configured')
    return { valid: false, error: 'Server configuration error' }
  }

  if (!apiKey) {
    return { valid: false, error: 'API key required' }
  }

  if (apiKey !== validKey) {
    return { valid: false, error: 'Invalid API key' }
  }

  return { valid: true }
}

/**
 * HOC wrapper for API key protected routes
 */
export function withApiKeyAuth(handler) {
  return async (request, context) => {
    const validation = validateApiKey(request)

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
          code: 'AUTH_REQUIRED'
        },
        { status: 401 }
      )
    }

    // Add metadata to request
    request.apiKeyAuth = true
    request.authType = 'api-key'

    return handler(request, context)
  }
}

/**
 * Combined auth: API key OR user session
 * Useful for endpoints accessed by both AI Backend and UI
 */
export function withApiKeyOrUserAuth(handler) {
  return async (request, context) => {
    // Try API key first
    const apiKeyValidation = validateApiKey(request)
    if (apiKeyValidation.valid) {
      request.apiKeyAuth = true
      request.authType = 'api-key'
      return handler(request, context)
    }

    // Fall back to user auth
    const userId = request.headers.get('x-user-id')
    if (userId) {
      request.user = { id: userId }
      request.authType = 'user'
      return handler(request, context)
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      },
      { status: 401 }
    )
  }
}
```

---

## Task 2: Create Common Response Helpers

### 2.1 `lib/utils/apiResponse.js`

```javascript
/**
 * Standardized API Response helpers for AI Backend API
 */

import { NextResponse } from 'next/server'

/**
 * Success response with data
 */
export function successResponse(data, meta = null, status = 200) {
  const response = { success: true, data }
  if (meta) response.meta = meta
  return NextResponse.json(response, { status })
}

/**
 * Created response (201)
 */
export function createdResponse(data) {
  return successResponse(data, null, 201)
}

/**
 * Error response
 */
export function errorResponse(error, code = 'INTERNAL_ERROR', status = 500, details = null) {
  const response = {
    success: false,
    error,
    code
  }
  if (details) response.details = details
  return NextResponse.json(response, { status })
}

/**
 * Not found response (404)
 */
export function notFoundResponse(resource = 'Resource') {
  return errorResponse(`${resource} not found`, 'NOT_FOUND', 404)
}

/**
 * Validation error response (400)
 */
export function validationErrorResponse(errors) {
  return errorResponse('Validation failed', 'VALIDATION_ERROR', 400, { errors })
}

/**
 * Duplicate entry response (409)
 */
export function duplicateResponse(field = 'entry') {
  return errorResponse(`Duplicate ${field}`, 'DUPLICATE_ENTRY', 409)
}

/**
 * Paginated response
 */
export function paginatedResponse(data, { total, page, limit }) {
  return successResponse(data, {
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit)
  })
}
```

---

## Task 3: Update Environment Configuration

### 3.1 Update `.env.example`

Add these variables:

```env
# AI Backend Integration
AI_BACKEND_API_KEY=your-secure-api-key-here
AI_BACKEND_URL=http://localhost:8001

# AI Backend SSE (consumed by UI)
NEXT_PUBLIC_AI_BACKEND_SSE_URL=http://localhost:8001/sse
```

---

## Task 4: Create Directory Structure

Create these empty files as placeholders:

```
app/api/ai/
├── inspections/
│   ├── route.js
│   └── [id]/
│       └── route.js
├── models/
│   ├── route.js
│   └── [id]/
│       └── route.js
├── dataset-images/
│   ├── route.js
│   ├── bulk/
│   │   └── route.js
│   └── [id]/
│       └── route.js
├── training-datasets/
│   ├── route.js
│   └── [id]/
│       ├── route.js
│       └── images/
│           └── route.js
├── training-jobs/
│   ├── route.js
│   └── [id]/
│       ├── route.js
│       └── cancel/
│           └── route.js
├── training-metrics/
│   ├── route.js
│   └── bulk/
│       └── route.js
├── sample-images/
│   ├── route.js
│   └── [id]/
│       └── route.js
├── defect-classes/
│   ├── route.js
│   └── [id]/
│       └── route.js
├── false-call-reasons/
│   └── route.js
└── system-status/
    └── route.js
```

---

## Verification Checklist

- [ ] `lib/auth/apiKeyAuth.js` created with `withApiKeyAuth` wrapper
- [ ] `lib/utils/apiResponse.js` created with response helpers
- [ ] `.env.example` updated with AI Backend variables
- [ ] Directory structure created under `app/api/ai/`
- [ ] Test API key validation with curl:
  ```bash
  curl -H "X-API-Key: test-key" http://localhost:3000/api/ai/system-status
  ```
