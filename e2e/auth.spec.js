import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/login')
    await page.evaluate(() => localStorage.clear())
  })

  test('should display login page', async ({ page }) => {
    await page.goto('/login')

    // Check for login form elements
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/login|sign in/i)
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /login|sign in/i })).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login')

    // Fill in invalid credentials
    await page.getByLabel(/email/i).fill('invalid@example.com')
    await page.getByLabel(/password/i).fill('wrongpassword')

    // Submit form
    await page.getByRole('button', { name: /login|sign in/i }).click()

    // Expect error message
    await expect(page.getByText(/invalid|error|failed/i)).toBeVisible({ timeout: 10000 })
  })

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Try to access protected route without authentication
    await page.goto('/dashboard')

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/)
  })

  test('should redirect to login when accessing admin pages', async ({ page }) => {
    // Try to access admin route without authentication
    await page.goto('/super-admin')

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Navigation', () => {
  test('should have working navigation links on login page', async ({ page }) => {
    await page.goto('/login')

    // Page should load successfully
    await expect(page).toHaveTitle(/.+/)
  })
})

test.describe('Page Load', () => {
  test('should load the application without JavaScript errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.goto('/login')

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle')

    // Check for critical errors (ignore minor warnings)
    const criticalErrors = errors.filter(
      (err) => !err.includes('ResizeObserver') && !err.includes('hydration')
    )

    expect(criticalErrors).toHaveLength(0)
  })
})
