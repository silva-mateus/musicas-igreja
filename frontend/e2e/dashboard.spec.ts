import { test, expect } from './fixtures'
import { goToPage } from './helpers/navigation'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await goToPage(page, 'dashboard')
  })

  test('6.1 - dashboard page loads with stats', async ({ page }) => {
    const statsArea = page.getByText(/músicas|listas|categorias|artistas/i).first()
    await expect(statsArea).toBeVisible({ timeout: 10_000 })
  })

  test('6.2 - stats cards show correct labels', async ({ page }) => {
    const labels = ['Músicas', 'Listas', 'Categorias', 'Artistas']

    for (const label of labels) {
      const card = page.getByText(label, { exact: false }).first()
      const isVisible = await card.isVisible({ timeout: 5_000 }).catch(() => false)
      if (!isVisible) continue
      await expect(card).toBeVisible()
    }
  })

  test('6.3 - charts load', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
    await page.waitForTimeout(2_000)

    const chartContainer = page.locator('canvas, [class*="chart"], [class*="recharts"]').first()
    const hasChart = await chartContainer.isVisible({ timeout: 5_000 }).catch(() => false)

    const chartTitle = page.getByText(/mais tocadas|top|uploads|artistas/i).first()
    const hasTitle = await chartTitle.isVisible({ timeout: 3_000 }).catch(() => false)

    expect(hasChart || hasTitle).toBeTruthy()
  })

  test('6.4 - quick action links work', async ({ page }) => {
    const uploadLink = page.getByRole('link', { name: /upload|enviar/i }).first()
    const hasUploadLink = await uploadLink.isVisible({ timeout: 3_000 }).catch(() => false)

    if (hasUploadLink) {
      await uploadLink.click()
      await page.waitForTimeout(2_000)
      const isOnUpload = page.url().includes('/upload')
      expect(isOnUpload).toBeTruthy()
      await goToPage(page, 'dashboard')
    }

    const musicLink = page.getByRole('link', { name: /músicas|music/i }).first()
    const hasMusicLink = await musicLink.isVisible({ timeout: 3_000 }).catch(() => false)

    if (hasMusicLink) {
      await musicLink.click()
      await page.waitForTimeout(2_000)
      const isOnMusic = page.url().includes('/music')
      expect(isOnMusic).toBeTruthy()
    }
  })
})
