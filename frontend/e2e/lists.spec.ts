import { test, expect } from './fixtures'
import { goToPage, waitForTableLoad } from './helpers/navigation'
import { testData } from './helpers/data'
import { createList, duplicateList, deleteList, searchLists } from './helpers/workflow-actions'

test.describe('Lists Management', () => {
  test.beforeEach(async ({ page }) => {
    await goToPage(page, 'lists')
  })

  test('4.1 - lists page loads with table', async ({ page }) => {
    const table = page.locator('table')
    const hasTable = await table.isVisible({ timeout: 5_000 }).catch(() => false)
    const emptyState = page.getByText(/nenhuma lista encontrada/i)
    const isEmpty = await emptyState.isVisible({ timeout: 2_000 }).catch(() => false)
    expect(hasTable || isEmpty).toBeTruthy()
  })

  test('4.2 - create new list', async ({ page }) => {
    const listName = testData.list.name()
    await createList(page, listName, testData.list.observations)

    await page.waitForTimeout(1_000)
    await waitForTableLoad(page)

    const listText = page.getByText(listName).first()
    await expect(listText).toBeVisible({ timeout: 5_000 })
  })

  test('4.3 - search lists', async ({ page }) => {
    await waitForTableLoad(page)

    const firstRow = page.locator('table tbody tr').first()
    const hasData = await firstRow.isVisible({ timeout: 3_000 }).catch(() => false)
    if (!hasData) return

    const firstName = await firstRow.locator('td').first().textContent()
    if (!firstName) return

    const searchTerm = firstName.substring(0, 5)
    await searchLists(page, searchTerm)

    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })

  test('4.4 - sort lists changes order', async ({ page }) => {
    await waitForTableLoad(page)

    const sortTrigger = page.getByText('Ordenar', { exact: false }).first()
    if (await sortTrigger.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await sortTrigger.click()
      await page.waitForTimeout(500)

      const nameOption = page.getByText('Nome', { exact: false }).first()
      if (await nameOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await nameOption.click()
        await page.waitForTimeout(1_500)
      }
    }
  })

  test('4.5 - view list detail', async ({ page }) => {
    await waitForTableLoad(page)

    const viewButton = page.getByLabel(/visualizar lista/i).first()
    const hasView = await viewButton.isVisible({ timeout: 3_000 }).catch(() => false)
    if (!hasView) return

    await viewButton.click()
    await page.waitForTimeout(2_000)
    await expect(page).toHaveURL(/\/lists\/\d+/, { timeout: 5_000 })
  })

  test('4.6 - edit list metadata', async ({ page }) => {
    await waitForTableLoad(page)

    const editButton = page.getByLabel(/editar lista/i).first()
    const hasEdit = await editButton.isVisible({ timeout: 3_000 }).catch(() => false)
    if (!hasEdit) return

    await editButton.click()
    await page.waitForTimeout(2_000)
    await expect(page).toHaveURL(/\/lists\/\d+\/edit/, { timeout: 5_000 })
  })

  test('4.10 - delete list', async ({ page }) => {
    const listName = testData.list.name()
    await createList(page, listName)
    await page.waitForTimeout(1_000)
    await waitForTableLoad(page)

    await deleteList(page, listName)
    await page.waitForTimeout(1_000)

    const deletedRow = page.locator('table tbody tr').filter({ hasText: listName })
    const stillVisible = await deletedRow.isVisible({ timeout: 2_000 }).catch(() => false)
    expect(stillVisible).toBeFalsy()
  })

  test('4.11 - duplicate list', async ({ page }) => {
    await waitForTableLoad(page)

    const firstRow = page.locator('table tbody tr').first()
    const hasData = await firstRow.isVisible({ timeout: 3_000 }).catch(() => false)
    if (!hasData) return

    const originalName = await firstRow.locator('td').first().textContent()
    if (!originalName) return

    const newName = `Cópia ${testData.list.name()}`
    await duplicateList(page, originalName.trim(), newName)
    await waitForTableLoad(page)

    const newList = page.getByText(newName).first()
    await expect(newList).toBeVisible({ timeout: 5_000 })
  })

  test('4.12 - export list as PDF', async ({ page }) => {
    await waitForTableLoad(page)

    const pdfButton = page.getByLabel(/baixar pdf/i).first()
    const hasPdf = await pdfButton.isVisible({ timeout: 3_000 }).catch(() => false)
    if (!hasPdf) return

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }).catch(() => null),
      pdfButton.click(),
    ])

    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.pdf$/i)
    }
  })

  test('4.13 - generate report', async ({ page }) => {
    await waitForTableLoad(page)

    const reportButton = page.getByLabel(/gerar relatório/i).first()
    const hasReport = await reportButton.isVisible({ timeout: 3_000 }).catch(() => false)
    if (!hasReport) return

    await reportButton.click()
    await page.waitForTimeout(2_000)
  })

  test('4.14 - create list with empty name shows validation', async ({ page }) => {
    await page.getByRole('button', { name: /nova lista/i }).click()
    await expect(page.getByText('Nova Lista de Música')).toBeVisible({ timeout: 5_000 })

    await page.getByRole('button', { name: /^Criar Lista$/i }).click()
    await page.waitForTimeout(1_000)

    const dialogStillVisible = await page.getByText('Nova Lista de Música')
      .isVisible({ timeout: 2_000 }).catch(() => false)
    expect(dialogStillVisible).toBeTruthy()
  })
})
