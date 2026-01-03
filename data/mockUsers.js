/**
 * Mock Users for Development
 * These users are used as fallback when Supabase is unavailable
 *
 * WARNING: Do not use in production! These are development-only credentials.
 */

export const mockUsers = [
  {
    id: 'user_admin',
    name: 'Admin User',
    email: 'admin@indusia.com',
    password: 'admin123',
    role_id: 'role_superadmin',
    role: 'superadmin',
    status: 'active',
    sections: ['section_smt', 'section_tht', 'section_final']
  },
  {
    id: 'user_manager',
    name: 'Manager User',
    email: 'manager@indusia.com',
    password: 'manager123',
    role_id: 'role_manager',
    role: 'manager',
    status: 'active',
    sections: ['section_smt', 'section_tht']
  },
  {
    id: 'user_operator',
    name: 'Operator User',
    email: 'operator@indusia.com',
    password: 'operator123',
    role_id: 'role_operator',
    role: 'operator',
    status: 'active',
    sections: ['section_smt']
  },
  {
    id: 'user_engineer',
    name: 'Engineer User',
    email: 'engineer@indusia.com',
    password: 'engineer123',
    role_id: 'role_engineer',
    role: 'engineer',
    status: 'active',
    sections: ['section_smt', 'section_tht', 'section_final']
  }
]

/**
 * Find mock user by email
 * @param {string} email - User email
 * @returns {object|undefined}
 */
export function findMockUserByEmail(email) {
  return mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase())
}

/**
 * Find mock user by ID
 * @param {string} id - User ID
 * @returns {object|undefined}
 */
export function findMockUserById(id) {
  return mockUsers.find(u => u.id === id)
}

/**
 * Validate mock user credentials
 * @param {string} email
 * @param {string} password
 * @returns {object|null} - User object without password, or null
 */
export function validateMockCredentials(email, password) {
  const user = mockUsers.find(u =>
    u.email.toLowerCase() === email.toLowerCase() &&
    u.password === password &&
    u.status === 'active'
  )

  if (!user) return null

  // Return user without password
  const { password: _, ...safeUser } = user
  return safeUser
}

export default mockUsers
