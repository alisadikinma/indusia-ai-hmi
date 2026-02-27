/**
 * Master Data Repository
 * Handles customers, sections, lines, boards, and menu items
 */

import { supabase } from '@/lib/supabaseClient'
import { handleError, toCamelCase } from './index'

/**
 * Get all customers
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function getCustomers() {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name')

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'masterDataRepo.getCustomers')
  }
}

/**
 * Get all sections
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function getSections() {
  try {
    const { data, error } = await supabase
      .from('sections')
      .select('*')
      .order('name')

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'masterDataRepo.getSections')
  }
}

/**
 * Get lines with optional filters
 * @param {Object} filters - { sectionId, customerId }
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function getLines(filters = {}) {
  try {
    let query = supabase
      .from('lines')
      .select(`
        *,
        sections (id, name),
        customers (id, name, logo_base64)
      `)

    if (filters.sectionId) {
      query = query.eq('section_id', filters.sectionId)
    }
    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId)
    }

    const { data, error } = await query.order('name')

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'masterDataRepo.getLines')
  }
}

/**
 * Get boards with optional filters
 * @param {Object} filters - { customerId }
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function getBoards(filters = {}) {
  try {
    let query = supabase
      .from('boards')
      .select(`
        *,
        customers (id, name)
      `)

    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId)
    }

    const { data, error } = await query.order('name')

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'masterDataRepo.getBoards')
  }
}

/**
 * Get all menu items
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function getMenuItems() {
  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('name')

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'masterDataRepo.getMenuItems')
  }
}

/**
 * Get customer sections (many-to-many relationship)
 * @param {string} customerId - Optional customer ID filter
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function getCustomerSections(customerId = null) {
  try {
    let query = supabase
      .from('customer_sections')
      .select(`
        customer_id,
        section_id,
        customers (id, name),
        sections (id, name)
      `)

    if (customerId) {
      query = query.eq('customer_id', customerId)
    }

    const { data, error } = await query

    if (error) throw error
    return { data: toCamelCase(data) }
  } catch (error) {
    return handleError(error, 'masterDataRepo.getCustomerSections')
  }
}

/**
 * Get sections available for a customer
 * @param {string} customerId - Customer ID
 * @returns {Promise<{ data?: Array, error?: string }>}
 */
export async function getSectionsForCustomer(customerId) {
  try {
    const { data, error } = await supabase
      .from('customer_sections')
      .select(`
        sections (*)
      `)
      .eq('customer_id', customerId)

    if (error) throw error
    return { data: toCamelCase(data.map(row => row.sections)) }
  } catch (error) {
    return handleError(error, 'masterDataRepo.getSectionsForCustomer')
  }
}

export default {
  getCustomers,
  getSections,
  getLines,
  getBoards,
  getMenuItems,
  getCustomerSections,
  getSectionsForCustomer
}
