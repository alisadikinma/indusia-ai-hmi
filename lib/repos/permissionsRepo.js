/**
 * Permissions Repository
 * Handles role_menu_permissions table operations
 */

import { supabase } from '@/lib/supabaseClient'
import { handleError, toCamelCase } from './index'

/**
 * Get menu permissions for a specific role
 * @param {string} roleId - Role ID
 * @returns {Promise<{ data?: string[], error?: string }>}
 */
export async function getByRole(roleId) {
  try {
    const { data, error } = await supabase
      .from('role_menu_permissions')
      .select('menu_id')
      .eq('role_id', roleId)

    if (error) throw error
    return { data: data.map(row => row.menu_id) }
  } catch (error) {
    return handleError(error, 'permissionsRepo.getByRole')
  }
}

/**
 * Set permissions for a role (replace all existing)
 * @param {string} roleId - Role ID
 * @param {string[]} menuIds - Array of menu IDs to grant
 * @returns {Promise<{ data?: boolean, error?: string }>}
 */
export async function setRolePermissions(roleId, menuIds) {
  try {
    // Delete existing permissions for this role
    const { error: deleteError } = await supabase
      .from('role_menu_permissions')
      .delete()
      .eq('role_id', roleId)

    if (deleteError) throw deleteError

    // Insert new permissions if any
    if (menuIds.length > 0) {
      const newPermissions = menuIds.map(menuId => ({
        role_id: roleId,
        menu_id: menuId
      }))

      const { error: insertError } = await supabase
        .from('role_menu_permissions')
        .insert(newPermissions)

      if (insertError) throw insertError
    }

    return { data: true }
  } catch (error) {
    return handleError(error, 'permissionsRepo.setRolePermissions')
  }
}

/**
 * Get full permission matrix (all roles with their menu permissions)
 * @returns {Promise<{ data?: Object, error?: string }>}
 */
export async function getAllPermissions() {
  try {
    const { data, error } = await supabase
      .from('role_menu_permissions')
      .select(`
        role_id,
        menu_id,
        roles (id, name),
        menu_items (id, name, path)
      `)

    if (error) throw error

    // Group by role
    const permissionMatrix = data.reduce((acc, row) => {
      const roleId = row.role_id
      if (!acc[roleId]) {
        acc[roleId] = {
          roleId,
          roleName: row.roles?.name,
          menuIds: []
        }
      }
      acc[roleId].menuIds.push(row.menu_id)
      return acc
    }, {})

    return { data: toCamelCase(Object.values(permissionMatrix)) }
  } catch (error) {
    return handleError(error, 'permissionsRepo.getAllPermissions')
  }
}

/**
 * Check if role has permission to access a menu
 * @param {string} roleId - Role ID
 * @param {string} menuId - Menu ID
 * @returns {Promise<{ data?: boolean, error?: string }>}
 */
export async function hasPermission(roleId, menuId) {
  try {
    const { data, error } = await supabase
      .from('role_menu_permissions')
      .select('id')
      .eq('role_id', roleId)
      .eq('menu_id', menuId)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows
    return { data: !!data }
  } catch (error) {
    return handleError(error, 'permissionsRepo.hasPermission')
  }
}

export default {
  getByRole,
  setRolePermissions,
  getAllPermissions,
  hasPermission
}
