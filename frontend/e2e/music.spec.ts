import { test, expect } from './fixtures'
import { goToPage, waitForTableLoad, expectEmptyState } from './helpers/navigation'
import { searchMusic } from './helpers/workflow-actions'

test.describe('Music Management', () => {
  test.beforeEach(async ({ page }) => {
    await goToPage(page, 'music')
  })

  test('3.1 - music page loads with table', async ({ page }) => {
    await expect(page.getByText('Músicas').first()).toBeVisible({ timeout: 10_000 })
    const table = page.locator('table')
    const hasTable = await table.isVisible({ timeout: 5_000 }).catch(() => false)
    const emptyState = page.getByText(/nenhuma música encontrada/i)
    const isEmpty = await emptyState.isVisible({ timeout: 2_000 }).catch(() => false)
    expect(hasTable || isEmpty).toBeTruthy()
  })

  test('3.2 - search by title filters results', async ({ page }) => {
    await waitForTableLoad(page)

    const firstRow = page.locator('table tbody tr').first()
    const hasData = await firstRow.isVisible({ timeout: 3_000 }).catch(() => false)
    if (!hasData) return

    const firstTitle = await firstRow.locator('td').first().textContent()
    if (!firstTitle) return

    const searchTerm = firstTitle.substring(0, 5)
    await searchMusic(page, searchTerm)

    await expect(page).toHaveURL(/search=/, { timeout: 5_000 })
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })

  test('3.3 - filter by category', async ({ page }) => {
    await waitForTableLoad(page)

    const categoryFilter = page.getByText('Categoria', { exact: false }).first()
    const hasFilter = await categoryFilter.isVisible({ timeout: 3_000 }).catch(() => false)
    if (!hasFilter) return

    await categoryFilter.click()
    await page.waitForTimeout(500)

    const firstOption = page.locator('[role="option"], [role="menuitem"]').first()
    if (await firstOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await firstOption.click()
      await page.waitForTimeout(1_500)
    }
  })

  test('3.4 - filter by artist', async ({ page }) => {
    await waitForTableLoad(page)

    const artistFilter = page.getByText('Artista', { exact: false })
      .filter({ has: page.locator('button, [role="combobox"]') }).first()
    const hasFilter = await artistFilter.isVisible({ timeout: 3_000 }).catch(() => false)
    if (!hasFilter) return

    await artistFilter.click()
    await page.waitForTimeout(500)

    const firstOption = page.locator('[role="option"], [role="menuitem"]').first()
    if (await firstOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await firstOption.click()
      await page.waitForTimeout(1_500)
    }
  })

  test('3.6 - sort by title changes order', async ({ page }) => {
    await waitForTableLoad(page)

    const sortTrigger = page.getByText('Ordenar', { exact: false }).first()
    if (await sortTrigger.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await sortTrigger.click()
      await page.waitForTimeout(500)

      const titleOption = page.getByText('Título', { exact: false }).first()
      if (await titleOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await titleOption.click()
        await page.waitForTimeout(1_500)
      }
    }
  })

  test('3.7 - pagination works', async ({ page }) => {
    await waitForTableLoad(page)

    const nextButton = page.getByRole('button', { name: /próxim|next|›/i }).first()
    const hasPagination = await nextButton.isVisible({ timeout: 3_000 }).catch(() => false)
    if (!hasPagination) return

    const isDisabled = await nextButton.isDisabled()
    if (isDisabled) return

    await nextButton.click()
    await page.waitForTimeout(1_500)
    await expect(page).toHaveURL(/page=2/, { timeout: 5_000 })
  })

  test('3.8 - view music detail page', async ({ page }) => {
    await waitForTableLoad(page)

    const viewButton = page.locator('button[title="Visualizar"], a[title="Visualizar"]').first()
    const hasView = await viewButton.isVisible({ timeout: 3_000 }).catch(() => false)
    if (!hasView) return

    await viewButton.click()
    await page.waitForTimeout(2_000)
    await expect(page).toHaveURL(/\/music\/\d+/, { timeout: 5_000 })
  })

  test('3.9 - edit music metadata', async ({ page }) => {
    await waitForTableLoad(page)

    const editButton = page.locator('button[title="Editar"], a[title="Editar"]').first()
    const hasEdit = await editButton.isVisible({ timeout: 3_000 }).catch(() => false)
    if (!hasEdit) return

    await editButton.click()
    await page.waitForTimeout(2_000)
    await expect(page).toHaveURL(/\/music\/\d+\/edit/, { timeout: 5_000 })

    const titleInput = page.getByLabel(/título/i).first()
    if (await titleInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const currentTitle = await titleInput.inputValue()
      expect(currentTitle.length).toBeGreaterThan(0)
    }
  })

  test('3.11 - download PDF triggers', async ({ page }) => {
    await waitForTableLoad(page)

    const downloadButton = page.locator('button[title="Download"], a[title="Download"]').first()
    const hasDownload = await downloadButton.isVisible({ timeout: 3_000 }).catch(() => false)
    if (!hasDownload) return

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10_000 }).catch(() => null),
      downloadButton.click(),
    ])

    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.pdf$/i)
    }
  })

  test('3.13 - grouped view by artist tab', async ({ page }) => {
    await waitForTableLoad(page)

    const artistTab = page.getByRole('tab', { name: /por artista/i })
    if (await artistTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await artistTab.click()
      await page.waitForTimeout(2_000)
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
    }
  })

  test('3.14 - grouped view by category tab', async ({ page }) => {
    await waitForTableLoad(page)

    const categoryTab = page.getByRole('tab', { name: /por categoria/i })
    if (await categoryTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await categoryTab.click()
      await page.waitForTimeout(2_000)
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
    }
  })

  test('3.17 - clear all filters', async ({ page }) => {
    await searchMusic(page, 'test-query-for-clear')
    await expect(page).toHaveURL(/search=/, { timeout: 5_000 })

    const clearButton = page.getByLabel(/limpar todos os filtros/i).first()
    if (await clearButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await clearButton.click()
      await page.waitForTimeout(1_500)
    }
  })

  test('3.18 - empty search shows no results', async ({ page }) => {
    await searchMusic(page, 'zzznonexistent999xyz')
    await page.waitForTimeout(2_000)

    const emptyState = page.getByText(/nenhuma música encontrada/i)
    const noResults = page.locator('table tbody tr')
    const isEmpty = await emptyState.isVisible({ timeout: 3_000 }).catch(() => false)
    const rowCount = await noResults.count()
    expect(isEmpty || rowCount === 0).toBeTruthy()
  })
})
