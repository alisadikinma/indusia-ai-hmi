/**
 * Users Repository
 * Handles all database operations for users table
 */

import { supabase } from '@/lib/supabaseClient'
import { handleError, toCamelCase, toSnakeCase } from './index'

// Dynamic import for password utils to avoid build errors
let passwordUtils = null
async function getPasswordUtils() {
  if (!passwordUtils) {
    passwordUtils = await import('@/lib/utils/password')
  }
  return passwordUtils
}

/**
 * Remove sensitive fields from user data
 */
function sanitizeUser(user) {
  if (!user) return user
  const { password, ...safeUser } = user
  return safeUser
}

/**
 * List users with optional filters
 * @param {Object} filters - { role, section, status }
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function list(filters = {}) {
  try {
    let query = supabase.from('users').select('*')

    if (filters.role) {
      query = query.eq('role', filters.role)
    }
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.section) {
      query = query.contains('sections', [filters.section])
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    
    // Remove password from all users
    const safeData = data?.map(sanitizeUser)
    return { data: toCamelCase(safeData) }
  } catch (error) {
    return handleError(error, 'usersRepo.list')
  }
}

/**
 * Get user by ID
 * @param {string} id - User ID
 * @param {Object} options - { includePassword: false }
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function getById(id, options = {}) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    
    // SECURITY: Only include password if explicitly requested (for auth purposes)
    const userData = options.includePassword ? data : sanitizeUser(data)
    return { data: toCamelCase(userData) }
  } catch (error) {
    return handleError(error, 'usersRepo.getById')
  }
}

/**
 * Get user by email (includes password for auth)
 * @param {string} email - User email
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function getByEmail(email) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    if (error) throw error
    // Note: This returns password for authentication purposes
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'usersRepo.getByEmail')
  }
}

/**
 * Create new user (optionally hashes password if bcrypt available)
 * @param {Object} userData - User data in camelCase
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function create(userData) {
  try {
    const dbData = toSnakeCase(userData)

    // Generate ID if not provided (TEXT PK has no default)
    if (!dbData.id) {
      dbData.id = `user_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
    }

    // If email exists but user is disabled, remove the old row first
    if (dbData.email) {
      const { data: existing } = await supabase
        .from('users')
        .select('id, status')
        .eq('email', dbData.email)
        .single()
      if (existing && existing.status === 'disabled') {
        await supabase.from('users').delete().eq('id', existing.id)
      }
    }

    // Try to hash password if bcrypt is available
    if (dbData.password) {
      try {
        const { hashPassword, isHashed } = await getPasswordUtils()
        if (!isHashed(dbData.password)) {
          dbData.password = await hashPassword(dbData.password)
        }
      } catch (e) {
        // bcrypt not available, store plaintext (dev mode)
        console.warn('[usersRepo.create] Password hashing unavailable, storing plaintext')
      }
    }

    const { data, error } = await supabase
      .from('users')
      .insert(dbData)
      .select()
      .single()

    if (error) throw error

    return { data: toCamelCase(sanitizeUser(data)) }
  } catch (error) {
    return handleError(error, 'usersRepo.create')
  }
}

/**
 * Update user by ID (optionally hashes password if changed)
 * @param {string} id - User ID
 * @param {Object} userData - Fields to update in camelCase
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function update(id, userData) {
  try {
    const dbData = toSnakeCase(userData)
    
    // Try to hash password if bcrypt is available and password is being updated
    if (dbData.password) {
      try {
        const { hashPassword, isHashed } = await getPasswordUtils()
        if (!isHashed(dbData.password)) {
          dbData.password = await hashPassword(dbData.password)
        }
      } catch (e) {
        // bcrypt not available, store plaintext (dev mode)
        console.warn('[usersRepo.update] Password hashing unavailable, storing plaintext')
      }
    }
    
    const { data, error } = await supabase
      .from('users')
      .update(dbData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    
    return { data: toCamelCase(sanitizeUser(data)) }
  } catch (error) {
    return handleError(error, 'usersRepo.update')
  }
}

/**
 * Update user password
 * @param {string} id - User ID
 * @param {string} newPassword - New plaintext password
 * @returns {Promise<{ data?: boolean, error?: string }>}
 */
export async function updatePassword(id, newPassword) {
  try {
    let passwordToStore = newPassword
    
    // Try to hash password if bcrypt is available
    try {
      const { hashPassword } = await getPasswordUtils()
      passwordToStore = await hashPassword(newPassword)
    } catch (e) {
      console.warn('[usersRepo.updatePassword] Password hashing unavailable, storing plaintext')
    }
    
    const { error } = await supabase
      .from('users')
      .update({ 
        password: passwordToStore,
        must_change_password: false 
      })
      .eq('id', id)

    if (error) throw error
    return { data: true }
  } catch (error) {
    return handleError(error, 'usersRepo.updatePassword')
  }
}

/**
 * Hard delete user from database
 * Falls back to soft delete (disabled) if FK constraints prevent removal
 * @param {string} id - User ID
 * @returns {Promise<{ data?: boolean, error?: string }>}
 */
export async function remove(id) {
  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id)

    if (error) {
      // FK constraint violation — user is referenced by other records
      if (error.message?.includes('violates foreign key') || error.code === '23503') {
        // Fall back to soft delete
        const { error: softError } = await supabase
          .from('users')
          .update({ status: 'disabled' })
          .eq('id', id)
        if (softError) throw softError
        return { data: true, warning: 'User disabled (referenced by other records)' }
      }
      throw error
    }
    return { data: true }
  } catch (error) {
    return handleError(error, 'usersRepo.delete')
  }
}

export default {
  list,
  getById,
  getByEmail,
  create,
  update,
  updatePassword,
  delete: remove
}
