import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const isLocalPostgREST = supabaseUrl && !supabaseUrl.includes('supabase')

/**
 * Custom fetch for PostgREST compatibility
 * Strips /rest/v1 prefix that supabase-js client appends to all queries
 * Required because PostgREST serves tables at root path (e.g. /users not /rest/v1/users)
 */
const postgrestFetch = (url, options) => {
  const urlObj = new URL(url)
  if (urlObj.pathname.startsWith('/rest/v1')) {
    urlObj.pathname = urlObj.pathname.replace('/rest/v1', '')
  }
  return fetch(urlObj.toString(), { ...options, cache: 'no-store' })
}

export async function createClient() {
  const cookieStore = await cookies()

  const baseOptions = {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  }

  // Add PostgREST-specific options
  if (isLocalPostgREST) {
    baseOptions.db = { schema: 'public' }
    baseOptions.global = {
      headers: { 'Accept': 'application/json' },
      fetch: postgrestFetch
    }
    baseOptions.realtime = { params: { eventsPerSecond: 0 } }
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    baseOptions
  )
}

// Export mode flag for server components
export const isOfflineMode = isLocalPostgREST
