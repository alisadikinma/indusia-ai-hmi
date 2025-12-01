# FASE 9: Real-time & Error Handling

## Role
You are a senior Next.js developer implementing real-time features and robust error handling for INDUSIA AI HMI - ensuring reliable operation in factory floor environment with unstable network.

## Context
INDUSIA AI HMI is a production-floor system with:
- Next.js 14+ (App Router, JavaScript only)
- Supabase Realtime for live updates
- Factory environment: unstable network, must not crash
- Multiple users need synchronized data

Working directory: `C:\xampp\htdocs\indusia-ai-hmi`

## Objective
Implement real-time subscriptions untuk live updates dan comprehensive error handling untuk production stability.

## Tasks

### 9.1 Supabase Realtime Setup

Create `lib/realtime/subscriptions.js`:
```js
import { supabase } from '@/lib/supabaseClient'

// Subscribe to override changes (for Manager queue)
export function subscribeToOverrides(callback, filters = {}) {
  const channel = supabase
    .channel('overrides-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'overrides',
        filter: filters.section_id 
          ? `section_id=eq.${filters.section_id}` 
          : undefined
      },
      (payload) => {
        callback(payload.eventType, payload.new, payload.old)
      }
    )
    .subscribe()
  
  return () => supabase.removeChannel(channel)
}

// Subscribe to notifications (for current user)
export function subscribeToNotifications(userId, callback) {
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        callback(payload.new)
      }
    )
    .subscribe()
  
  return () => supabase.removeChannel(channel)
}

// Subscribe to system health events
export function subscribeToSystemHealth(callback) {
  const channel = supabase
    .channel('system-health')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'system_events'
      },
      (payload) => {
        callback(payload.new)
      }
    )
    .subscribe()
  
  return () => supabase.removeChannel(channel)
}

// Subscribe to model deployments
export function subscribeToModelChanges(callback) {
  const channel = supabase
    .channel('model-changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'ai_models',
        filter: 'is_active=eq.true'
      },
      (payload) => {
        callback(payload.new)
      }
    )
    .subscribe()
  
  return () => supabase.removeChannel(channel)
}
```

### 9.2 Real-time Hook
Create `hooks/useRealtime.js`:
```js
import { useEffect, useRef } from 'react'
import * as subscriptions from '@/lib/realtime/subscriptions'

export function useRealtimeOverrides(onUpdate, filters = {}) {
  const unsubscribeRef = useRef(null)
  
  useEffect(() => {
    unsubscribeRef.current = subscriptions.subscribeToOverrides(
      (eventType, newData, oldData) => {
        onUpdate({ eventType, newData, oldData })
      },
      filters
    )
    
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [filters.section_id])
}

export function useRealtimeNotifications(userId, onNewNotification) {
  useEffect(() => {
    if (!userId) return
    
    const unsubscribe = subscriptions.subscribeToNotifications(
      userId,
      onNewNotification
    )
    
    return unsubscribe
  }, [userId])
}

export function useRealtimeSystemHealth(onHealthUpdate) {
  useEffect(() => {
    const unsubscribe = subscriptions.subscribeToSystemHealth(onHealthUpdate)
    return unsubscribe
  }, [])
}
```

### 9.3 Update NotificationContext with Realtime
Modify `contexts/NotificationContext.jsx`:
```js
// Add realtime subscription
useEffect(() => {
  if (!user?.id) return
  
  const unsubscribe = subscribeToNotifications(user.id, (newNotif) => {
    setNotifications(prev => [newNotif, ...prev])
    setUnreadCount(prev => prev + 1)
    
    // Show toast notification
    toast({
      title: newNotif.title,
      description: newNotif.message,
      variant: newNotif.severity === 'CRITICAL' ? 'destructive' : 'default'
    })
  })
  
  return unsubscribe
}, [user?.id])
```

### 9.4 Global Error Boundary
Create `components/ErrorBoundary.jsx`:
```jsx
'use client'
import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  
  componentDidCatch(error, errorInfo) {
    // Log to error reporting service
    console.error('Error caught by boundary:', error, errorInfo)
    
    // Send to backend for logging
    fetch('/api/error-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: window.location.href,
        timestamp: new Date().toISOString()
      })
    }).catch(() => {})
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
            <h1 className="text-2xl font-bold text-red-600 mb-4">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-4">
              An error occurred. Please refresh the page or contact support.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="btn btn-primary"
              >
                Refresh Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false })}
                className="btn btn-outline"
              >
                Try Again
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <pre className="mt-4 p-2 bg-gray-100 text-xs overflow-auto">
                {this.state.error?.stack}
              </pre>
            )}
          </div>
        </div>
      )
    }
    
    return this.props.children
  }
}
```

### 9.5 Wrap App with Error Boundary
Modify `app/layout.js`:
```jsx
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  )
}
```

### 9.6 API Error Handler
Create `lib/apiErrorHandler.js`:
```js
export class APIError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message)
    this.statusCode = statusCode
    this.code = code
  }
}

export function handleAPIError(error) {
  console.error('[API Error]', error)
  
  if (error instanceof APIError) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      statusCode: error.statusCode
    }
  }
  
  // Supabase errors
  if (error?.code) {
    const supabaseErrors = {
      'PGRST116': { message: 'Record not found', status: 404 },
      '23505': { message: 'Duplicate record', status: 409 },
      '23503': { message: 'Referenced record not found', status: 400 },
      '42501': { message: 'Permission denied', status: 403 }
    }
    
    const mapped = supabaseErrors[error.code]
    if (mapped) {
      return {
        success: false,
        error: mapped.message,
        code: error.code,
        statusCode: mapped.status
      }
    }
  }
  
  return {
    success: false,
    error: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
    statusCode: 500
  }
}

// Wrapper for API routes
export function withErrorHandling(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context)
    } catch (error) {
      const { error: message, statusCode } = handleAPIError(error)
      return Response.json(
        { success: false, error: message },
        { status: statusCode }
      )
    }
  }
}
```

### 9.7 Error Logging API
Create `app/api/error-log/route.js`:
```js
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function POST(request) {
  try {
    const errorData = await request.json()
    
    // Log to database
    await supabase.from('event_log').insert({
      id: `err_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'CLIENT_ERROR',
      source: 'HMI',
      details: errorData
    })
    
    // In production, also send to external service (Sentry, etc.)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to log error:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
```

### 9.8 Network Status Hook
Create `hooks/useNetworkStatus.js`:
```js
import { useState, useEffect } from 'react'

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [wasOffline, setWasOffline] = useState(false)
  
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      if (wasOffline) {
        // Trigger data refresh
        window.dispatchEvent(new Event('network-restored'))
      }
    }
    
    const handleOffline = () => {
      setIsOnline(false)
      setWasOffline(true)
    }
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [wasOffline])
  
  return { isOnline, wasOffline }
}
```

### 9.9 Offline Banner Component
Create `components/OfflineBanner.jsx`:
```jsx
'use client'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus()
  
  if (isOnline) return null
  
  return (
    <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 z-50">
      ⚠️ You are offline. Some features may not work.
    </div>
  )
}
```

### 9.10 Toast Notification System
Create `components/ui/Toast.jsx` (if not exists):
```jsx
'use client'
import { createContext, useContext, useState } from 'react'

const ToastContext = createContext()

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  
  const addToast = (toast) => {
    const id = Date.now()
    setToasts(prev => [...prev, { ...toast, id }])
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
  }
  
  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }
  
  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`p-4 rounded-lg shadow-lg ${
            toast.variant === 'destructive' 
              ? 'bg-red-500 text-white' 
              : 'bg-white border'
          }`}
        >
          <div className="font-semibold">{toast.title}</div>
          <div className="text-sm">{toast.description}</div>
        </div>
      ))}
    </div>
  )
}
```

## Constraints
- Realtime subscriptions must cleanup on unmount
- Error boundary should not break entire app
- Network issues should be handled gracefully
- All errors logged for debugging
- Toast notifications for user feedback

## Output Files
```
lib/realtime/
└── subscriptions.js

lib/
└── apiErrorHandler.js

hooks/
├── useRealtime.js
└── useNetworkStatus.js

components/
├── ErrorBoundary.jsx
├── OfflineBanner.jsx
└── ui/Toast.jsx

app/api/error-log/
└── route.js

contexts/
└── NotificationContext.jsx (modify)

app/
└── layout.js (modify)
```

## Validation Checklist
- [ ] Override changes appear in real-time for managers
- [ ] New notifications appear without refresh
- [ ] System health updates live
- [ ] Error boundary catches component errors
- [ ] API errors return consistent format
- [ ] Network offline shows banner
- [ ] Network restore triggers refresh
- [ ] Toast notifications work
- [ ] Errors logged to database

## Estimated Time
2-3 hours
