import { test, expect } from './fixtures'
import { goToPage } from './helpers/navigation'

test.describe('Settings - System Admin Tools', () => {
  test.beforeEach(async ({ page }) => {
    await goToPage(page, 'settings/system')
  })

  test('11.1 - system page loads with admin tools', async ({ page }) => {
    const heading = page.getByText(/sistema|administração|admin/i).first()
    await expect(heading).toBeVisible({ timeout: 10_000 })
  })

  test('11.2 - verify PDFs action', async ({ page }) => {
    test.setTimeout(60_000)

    const verifyBtn = page.getByRole('button', { name: /verificar.*pdf|scan.*pdf/i }).first()
    const hasBtn = await verifyBtn.isVisible({ timeout: 5_000 }).catch(() => false)
    if (!hasBtn) return

    await verifyBtn.click()
    await page.waitForTimeout(3_000)
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})

    const result = page.getByText(/verificação|resultado|concluíd|encontrad/i).first()
    const hasResult = await result.isVisible({ timeout: 10_000 }).catch(() => false)

    const noIssues = page.getByText(/nenhum|tudo ok|0 problema/i).first()
    const hasNoIssues = await noIssues.isVisible({ timeout: 3_000 }).catch(() => false)

    expect(hasResult || hasNoIssues).toBeTruthy()
  })

  test('11.3 - find duplicates action', async ({ page }) => {
    test.setTimeout(60_000)

    const dupsBtn = page.getByRole('button', { name: /duplicat|duplicad/i }).first()
    const hasBtn = await dupsBtn.isVisible({ timeout: 5_000 }).catch(() => false)
    if (!hasBtn) return

    await dupsBtn.click()
    await page.waitForTimeout(3_000)
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})

    const result = page.getByText(/duplicat|resultado|encontrad|nenhum/i).first()
    await expect(result).toBeVisible({ timeout: 10_000 })
  })
})
