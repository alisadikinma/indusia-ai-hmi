/**
 * Section-Based Access Control for INDUSIA AI HMI
 * Ensures users can only access data from their assigned sections
 */

/**
 * Check if user has access to a specific section
 * @param {Object} user - The user object with role_id and sections
 * @param {string} sectionId - The section ID to check access for
 * @returns {boolean} True if user can access the section
 */
export function canAccessSection(user, sectionId) {
  if (!user) return false
  if (!sectionId) return true // No section restriction

  // Superadmin can access all sections
  if (user.role_id === 'superadmin') return true

  // Engineer can access all sections (for data analysis)
  if (user.role_id === 'engineer') return true

  // Check if section is in user's assigned sections
  if (!user.sections || !Array.isArray(user.sections)) return false

  return user.sections.includes(sectionId)
}

/**
 * Check if user has access to any of the specified sections
 * @param {Object} user - The user object
 * @param {string[]} sectionIds - Array of section IDs
 * @returns {boolean} True if user can access any of the sections
 */
export function canAccessAnySections(user, sectionIds) {
  if (!user) return false
  if (!sectionIds || sectionIds.length === 0) return true

  // Superadmin and engineer can access all
  if (user.role_id === 'superadmin' || user.role_id === 'engineer') return true

  return sectionIds.some(sectionId => canAccessSection(user, sectionId))
}

/**
 * Filter an array of items by section access
 * @param {Object} user - The user object
 * @param {Array} data - Array of items to filter
 * @param {string} sectionField - The field name containing section ID (default: 'section_id')
 * @returns {Array} Filtered array containing only accessible items
 */
export function filterBySection(user, data, sectionField = 'section_id') {
  if (!user) return []
  if (!data || !Array.isArray(data)) return []

  // Superadmin and engineer can see all
  if (user.role_id === 'superadmin' || user.role_id === 'engineer') {
    return data
  }

  // Filter by user's sections
  if (!user.sections || !Array.isArray(user.sections)) {
    return []
  }

  return data.filter(item => {
    const itemSection = item[sectionField]
    // Include items without section (global) or in user's sections
    return !itemSection || user.sections.includes(itemSection)
  })
}

/**
 * Get section filter for database queries
 * @param {Object} user - The user object
 * @returns {string[] | null} Array of allowed section IDs or null for all access
 */
export function getSectionFilter(user) {
  if (!user) return []

  // Superadmin and engineer have unrestricted access
  if (user.role_id === 'superadmin' || user.role_id === 'engineer') {
    return null // null means no filter (all sections)
  }

  // Return user's assigned sections
  return user.sections || []
}

/**
 * Apply section filter to Supabase query
 * @param {Object} query - Supabase query builder
 * @param {Object} user - The user object
 * @param {string} sectionField - The field name for section (default: 'section_id')
 * @returns {Object} Modified query with section filter
 */
export function applySectionFilter(query, user, sectionField = 'section_id') {
  const allowedSections = getSectionFilter(user)

  // No filter needed for superadmin/engineer
  if (allowedSections === null) {
    return query
  }

  // No sections assigned - return empty result
  if (allowedSections.length === 0) {
    return query.in(sectionField, ['__none__']) // Force empty result
  }

  // Filter to user's sections
  return query.in(sectionField, allowedSections)
}

/**
 * Validate that user can create/modify data for a section
 * @param {Object} user - The user object
 * @param {string} sectionId - The target section ID
 * @throws {Error} If user cannot access the section
 */
export function validateSectionAccess(user, sectionId) {
  if (!canAccessSection(user, sectionId)) {
    const error = new Error('Access denied: You do not have permission for this section')
    error.statusCode = 403
    error.code = 'SECTION_ACCESS_DENIED'
    error.details = {
      requiredSection: sectionId,
      userSections: user?.sections || []
    }
    throw error
  }
}

/**
 * Get user's primary section (first assigned section)
 * @param {Object} user - The user object
 * @returns {string | null} Primary section ID or null
 */
export function getPrimarySection(user) {
  if (!user || !user.sections || user.sections.length === 0) {
    return null
  }
  return user.sections[0]
}

/**
 * Check if user is assigned to multiple sections
 * @param {Object} user - The user object
 * @returns {boolean} True if user has multiple sections
 */
export function hasMultipleSections(user) {
  return user?.sections?.length > 1
}

/**
 * Get section access summary for logging/debugging
 * @param {Object} user - The user object
 * @returns {Object} Section access summary
 */
export function getSectionAccessSummary(user) {
  if (!user) {
    return { hasAccess: false, sections: [], isUnrestricted: false }
  }

  const isUnrestricted = user.role_id === 'superadmin' || user.role_id === 'engineer'

  return {
    hasAccess: true,
    sections: user.sections || [],
    isUnrestricted,
    sectionCount: user.sections?.length || 0,
    role: user.role_id
  }
}
