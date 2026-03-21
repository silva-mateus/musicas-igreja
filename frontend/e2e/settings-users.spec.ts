import { test, expect } from './fixtures'
import { goToPage } from './helpers/navigation'

test.describe('Settings - Users & Roles', () => {
  test('9.1 - users page loads with user list', async ({ page }) => {
    await goToPage(page, 'settings/users')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const heading = page.getByText(/usuários|gerenciar/i).first()
    await expect(heading).toBeVisible({ timeout: 10_000 })

    const table = page.locator('table')
    const userList = page.locator('[class*="card"], [class*="list"]')
    const hasTable = await table.isVisible({ timeout: 3_000 }).catch(() => false)
    const hasList = await userList.first().isVisible({ timeout: 3_000 }).catch(() => false)
    expect(hasTable || hasList).toBeTruthy()
  })

  test('9.2 - roles page loads with role list', async ({ page }) => {
    await goToPage(page, 'settings/roles')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const heading = page.getByText(/roles|papéis|permissões|cargos/i).first()
    await expect(heading).toBeVisible({ timeout: 10_000 })
  })

  test('9.3 - permission-based UI visibility', async ({ page }) => {
    await goToPage(page, 'music')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const uploadButton = page.getByRole('link', { name: /upload/i }).first()
    const hasUpload = await uploadButton.isVisible({ timeout: 3_000 }).catch(() => false)
    // Admin user should see upload link
    expect(hasUpload).toBeTruthy()
  })
})
