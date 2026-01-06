import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Detect if using local PostgREST (no supabase in URL)
const isLocalPostgREST = supabaseUrl && !supabaseUrl.includes('supabase')

/**
 * Custom fetch for PostgREST compatibility
 * Strips /rest/v1 prefix that Supabase client adds
 */
const postgrestFetch = (url, options) => {
  // Convert URL string to URL object for manipulation
  const urlObj = new URL(url)
  
  // Remove /rest/v1 prefix from pathname
  if (urlObj.pathname.startsWith('/rest/v1')) {
    urlObj.pathname = urlObj.pathname.replace('/rest/v1', '')
  }
  
  return fetch(urlObj.toString(), options)
}

// Create client with appropriate config
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  isLocalPostgREST ? {
    db: { schema: 'public' },
    global: {
      headers: { 'Accept': 'application/json' },
      fetch: postgrestFetch
    },
    realtime: { params: { eventsPerSecond: 0 } }
  } : {}
)

// Check if properly configured
export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  (supabaseUrl.includes('supabase') || isLocalPostgREST)
)

// Export mode flags
export const isOfflineMode = isLocalPostgREST

if (isLocalPostgREST) {
  console.info('[Database] Running in OFFLINE mode (Local PostgreSQL via PostgREST)')
} else if (!isSupabaseConfigured) {
  console.warn('[Supabase] Not configured - using mock data fallbacks')
}
