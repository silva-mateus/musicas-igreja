import { test, expect } from './fixtures'

test.describe('Sections coverage smoke', () => {
  test('should access main app sections', async ({ page }) => {
    const routes = [
      '/music',
      '/lists',
      '/upload',
      '/dashboard',
    ]

    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
      const response = await page.evaluate(() => document.readyState)
      expect(response).toBe('complete')
      const loginModal = page.getByText('Entrar no Sistema')
      const isLoginModal = await loginModal.isVisible({ timeout: 1_000 }).catch(() => false)
      expect(isLoginModal).toBeFalsy()
    }
  })

  test('should access settings sections', async ({ page }) => {
    const routes = [
      '/settings/manage',
      '/settings/workspaces',
      '/settings/users',
      '/settings/roles',
    ]

    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
      const loginModal = page.getByText('Entrar no Sistema')
      const isLoginModal = await loginModal.isVisible({ timeout: 1_000 }).catch(() => false)
      expect(isLoginModal).toBeFalsy()
    }
  })

  test('should access admin and monitoring sections', async ({ page }) => {
    const routes = [
      '/settings/monitoring',
      '/settings/alert-configs',
      '/settings/system',
    ]

    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
      const loginModal = page.getByText('Entrar no Sistema')
      const isLoginModal = await loginModal.isVisible({ timeout: 1_000 }).catch(() => false)
      expect(isLoginModal).toBeFalsy()
    }
  })
})
