/**
 * Password Utility
 * Handles password hashing and verification
 * Falls back to plaintext comparison if bcrypt is not available
 */

let bcrypt = null

// Try to load bcrypt, but don't fail if not available
try {
  bcrypt = require('bcrypt')
} catch (e) {
  console.warn('[password] bcrypt not installed, using plaintext comparison (NOT FOR PRODUCTION)')
}

const SALT_ROUNDS = 12

/**
 * Hash a plaintext password
 * @param {string} plainPassword - The plaintext password
 * @returns {Promise<string>} - The hashed password (or plaintext if bcrypt unavailable)
 */
export async function hashPassword(plainPassword) {
  if (bcrypt) {
    return bcrypt.hash(plainPassword, SALT_ROUNDS)
  }
  // Fallback: return plaintext (NOT FOR PRODUCTION)
  console.warn('[password] bcrypt not available, storing plaintext password')
  return plainPassword
}

/**
 * Verify a password against a hash
 * @param {string} plainPassword - The plaintext password to verify
 * @param {string} storedPassword - The stored hash/password to compare against
 * @returns {Promise<boolean>} - True if password matches
 */
export async function verifyPassword(plainPassword, storedPassword) {
  if (!storedPassword) return false
  
  // Check if stored password is a bcrypt hash
  const isBcryptHash = storedPassword.startsWith('$2')
  
  if (isBcryptHash && bcrypt) {
    // Use bcrypt comparison
    return bcrypt.compare(plainPassword, storedPassword)
  }
  
  if (isBcryptHash && !bcrypt) {
    // Hash detected but bcrypt not available
    console.warn('[password] bcrypt hash detected but bcrypt not installed')
    return false
  }
  
  // Plaintext comparison (legacy/dev mode)
  return plainPassword === storedPassword
}

/**
 * Check if a password is already hashed (bcrypt format)
 * @param {string} password - The password to check
 * @returns {boolean} - True if already hashed
 */
export function isHashed(password) {
  return password && password.startsWith('$2')
}

/**
 * Check if bcrypt is available
 * @returns {boolean}
 */
export function isBcryptAvailable() {
  return bcrypt !== null
}

export default {
  hashPassword,
  verifyPassword,
  isHashed,
  isBcryptAvailable
}
