/**
 * E2E Test Helpers
 * Utility functions for Playwright E2E tests
 */

/**
 * Mock user data for testing
 */
export const mockUsers = {
  operator: {
    id: 'test-operator-1',
    name: 'Test Operator',
    email: 'operator@test.com',
    role_id: 'operator',
    sections: ['section-a'],
    status: 'active'
  },
  manager: {
    id: 'test-manager-1',
    name: 'Test Manager',
    email: 'manager@test.com',
    role_id: 'manager',
    sections: ['section-a', 'section-b'],
    status: 'active'
  },
  engineer: {
    id: 'test-engineer-1',
    name: 'Test Engineer',
    email: 'engineer@test.com',
    role_id: 'engineer',
    sections: [],
    status: 'active'
  },
  superadmin: {
    id: 'test-admin-1',
    name: 'Test Admin',
    email: 'admin@test.com',
    role_id: 'superadmin',
    sections: [],
    status: 'active'
  }
}

/**
 * Login helper that sets user in localStorage
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} role - User role to login as
 */
export async function loginAs(page, role = 'operator') {
  const user = mockUsers[role]
  if (!user) {
    throw new Error(`Unknown role: ${role}`)
  }

  await page.goto('/login')

  // Set user in localStorage (simulating successful login)
  await page.evaluate((userData) => {
    localStorage.setItem('indusia_user', JSON.stringify(userData))
  }, user)

  // Navigate to a protected page to trigger auth check
  await page.goto('/dashboard')

  // Wait for page to load
  await page.waitForLoadState('networkidle')
}

/**
 * Logout helper
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function logout(page) {
  await page.evaluate(() => {
    localStorage.removeItem('indusia_user')
  })
  await page.goto('/login')
}

/**
 * Wait for a toast/notification to appear
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string|RegExp} text - Text to look for in toast
 */
export async function waitForToast(page, text) {
  const toast = page.locator('[role="status"], [data-sonner-toast]').filter({ hasText: text })
  await toast.waitFor({ state: 'visible', timeout: 10000 })
  return toast
}

/**
 * Wait for loading state to complete
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function waitForLoad(page) {
  // Wait for any loading spinners to disappear
  await page.locator('[data-loading="true"], .animate-spin').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})

  // Wait for network to be idle
  await page.waitForLoadState('networkidle')
}

/**
 * Fill form field by label
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} label - Label text
 * @param {string} value - Value to fill
 */
export async function fillField(page, label, value) {
  const field = page.getByLabel(label, { exact: false })
  await field.fill(value)
}

/**
 * Select option from dropdown by label
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} label - Label text
 * @param {string} optionText - Option text to select
 */
export async function selectOption(page, label, optionText) {
  const select = page.getByLabel(label, { exact: false })
  await select.click()

  // Wait for options to appear
  const option = page.getByRole('option', { name: optionText })
  await option.click()
}

/**
 * Click button by text
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} text - Button text
 */
export async function clickButton(page, text) {
  await page.getByRole('button', { name: text }).click()
}

/**
 * Check if an element exists
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} selector - CSS selector
 * @returns {Promise<boolean>}
 */
export async function elementExists(page, selector) {
  const element = page.locator(selector)
  return await element.count() > 0
}

/**
 * Take a screenshot with timestamp
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} name - Screenshot name
 */
export async function screenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  await page.screenshot({ path: `test-results/screenshots/${name}-${timestamp}.png` })
}
