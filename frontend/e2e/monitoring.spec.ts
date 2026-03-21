import { test, expect } from './fixtures'
import { goToPage } from './helpers/navigation'

test.describe('Monitoring', () => {
  test('10.1 - monitoring page loads', async ({ page }) => {
    await goToPage(page, 'settings/monitoring')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const heading = page.getByText(/monitoramento|monitoring|eventos|sistema/i).first()
    await expect(heading).toBeVisible({ timeout: 10_000 })
  })

  test('10.2 - alert configs page loads', async ({ page }) => {
    await goToPage(page, 'settings/alert-configs')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const heading = page.getByText(/alertas|configuração|alert/i).first()
    await expect(heading).toBeVisible({ timeout: 10_000 })
  })
})
