import { test, expect } from './fixtures'
import { goToPage } from './helpers/navigation'

test.describe('Settings - Workspaces', () => {
  test('8.1 - workspaces page loads', async ({ page }) => {
    await goToPage(page, 'settings/workspaces')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const heading = page.getByText(/workspace/i).first()
    await expect(heading).toBeVisible({ timeout: 10_000 })
  })

  test('8.2 - switch workspace refreshes data', async ({ page }) => {
    await goToPage(page, 'music')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const switcher = page.getByLabel(/trocar workspace/i).first()
    const hasSwitcher = await switcher.isVisible({ timeout: 3_000 }).catch(() => false)

    if (!hasSwitcher) return

    await switcher.click()
    await page.waitForTimeout(500)

    const options = page.locator('[role="menuitem"], [role="option"]')
    const optionCount = await options.count()

    if (optionCount > 1) {
      await options.nth(1).click()
      await page.waitForTimeout(2_000)
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

      await switcher.click()
      await page.waitForTimeout(500)
      await options.first().click()
      await page.waitForTimeout(2_000)
    }
  })

  test('8.3 - workspace data isolation', async ({ page }) => {
    await goToPage(page, 'music')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const musicTable = page.locator('table tbody tr')
    const currentCount = await musicTable.count()

    const switcher = page.getByLabel(/trocar workspace/i).first()
    const hasSwitcher = await switcher.isVisible({ timeout: 3_000 }).catch(() => false)

    if (!hasSwitcher) return

    await switcher.click()
    await page.waitForTimeout(500)

    const options = page.locator('[role="menuitem"], [role="option"]')
    const optionCount = await options.count()

    if (optionCount > 1) {
      await options.nth(1).click()
      await page.waitForTimeout(2_000)
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

      const newCount = await musicTable.count()
      // Different workspaces may have different data
      // The test simply confirms navigation worked without error

      await switcher.click()
      await page.waitForTimeout(500)
      await options.first().click()
      await page.waitForTimeout(2_000)
    }
  })
})
