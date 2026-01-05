/**
 * Authenticated Fetch Utility
 * Wraps fetch to automatically include authentication headers
 */

/**
 * Get auth headers from localStorage
 * @returns {Object} Headers object with auth info
 */
export function getAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  }

  // Get user ID from localStorage
  if (typeof window !== 'undefined') {
    let userId = localStorage.getItem('indusia_user_id')
    
    // Fallback: try to get from indusia_user object
    if (!userId) {
      try {
        const storedUser = localStorage.getItem('indusia_user')
        if (storedUser) {
          const parsed = JSON.parse(storedUser)
          userId = parsed.id
          // Also save for future use
          if (userId) localStorage.setItem('indusia_user_id', userId)
        }
      } catch (e) {
        console.warn('[authFetch] Failed to parse stored user')
      }
    }
    
    if (userId) {
      headers['x-user-id'] = userId
    }
  }

  return headers
}

/**
 * Authenticated fetch wrapper
 * Automatically includes x-user-id header from localStorage
 * 
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export async function authFetch(url, options = {}) {
  const headers = {
    ...getAuthHeaders(),
    ...options.headers,
  }

  return fetch(url, {
    ...options,
    headers,
  })
}

/**
 * GET request with auth
 * @param {string} url - The URL to fetch
 * @returns {Promise<Response>}
 */
export async function authGet(url) {
  return authFetch(url, { method: 'GET' })
}

/**
 * POST request with auth
 * @param {string} url - The URL to fetch
 * @param {Object} data - Body data
 * @returns {Promise<Response>}
 */
export async function authPost(url, data) {
  return authFetch(url, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * PATCH request with auth
 * @param {string} url - The URL to fetch
 * @param {Object} data - Body data
 * @returns {Promise<Response>}
 */
export async function authPatch(url, data) {
  return authFetch(url, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

/**
 * DELETE request with auth
 * @param {string} url - The URL to fetch
 * @returns {Promise<Response>}
 */
export async function authDelete(url) {
  return authFetch(url, { method: 'DELETE' })
}

export default {
  authFetch,
  authGet,
  authPost,
  authPatch,
  authDelete,
  getAuthHeaders,
}
