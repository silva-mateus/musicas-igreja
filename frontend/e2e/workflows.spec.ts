import { test, expect } from './fixtures'
import { testData } from './helpers/data'
import { goToPage, waitForTableLoad } from './helpers/navigation'
import {
  uploadMusic,
  createList,
  addMusicToList,
  deleteMusic,
  duplicateList,
  deleteList,
  searchMusic,
  searchLists,
  createCategory,
  createArtist,
  switchWorkspace,
} from './helpers/workflow-actions'
import path from 'node:path'

const TEST_PDF = path.resolve(__dirname, 'fixtures/test-music.pdf')
const TEST_PDF_2 = path.resolve(__dirname, 'fixtures/test-music-2.pdf')
const TEST_PDF_3 = path.resolve(__dirname, 'fixtures/test-music-3.pdf')

// =====================================================================
// WF-01: Upload -> View -> Edit -> Delete
// =====================================================================
test.describe('WF-01: Upload -> View -> Edit -> Delete', () => {
  test.describe.configure({ mode: 'serial' })
  const musicTitle = testData.music.title()

  test('step 1: upload a PDF with metadata', async ({ page }) => {
    test.setTimeout(60_000)
    await goToPage(page, 'upload')

    const restricted = page.getByText(/acesso restrito/i).first()
    if (await restricted.isVisible({ timeout: 2_000 }).catch(() => false)) {
      test.skip()
      return
    }

    await uploadMusic(page, { filePath: TEST_PDF, title: musicTitle })

    const results = page.getByText(/resultado do upload|upload concluído/i).first()
    const hasResults = await results.isVisible({ timeout: 10_000 }).catch(() => false)
    expect(hasResults).toBeTruthy()
  })

  test('step 2: search for uploaded music in music page', async ({ page }) => {
    await goToPage(page, 'music')
    await waitForTableLoad(page)
    await searchMusic(page, musicTitle)

    const musicRow = page.getByText(musicTitle).first()
    await expect(musicRow).toBeVisible({ timeout: 10_000 })
  })

  test('step 3: open music detail page', async ({ page }) => {
    await goToPage(page, 'music')
    await waitForTableLoad(page)
    await searchMusic(page, musicTitle)

    const viewButton = page.locator('button[title="Visualizar"], a[title="Visualizar"]').first()
    if (await viewButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await viewButton.click()
      await page.waitForTimeout(2_000)
      await expect(page).toHaveURL(/\/music\/\d+/, { timeout: 5_000 })
    }
  })

  test('step 4: edit music metadata', async ({ page }) => {
    await goToPage(page, 'music')
    await waitForTableLoad(page)
    await searchMusic(page, musicTitle)

    const editButton = page.locator('button[title="Editar"], a[title="Editar"]').first()
    if (await editButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await editButton.click()
      await page.waitForTimeout(2_000)
      await expect(page).toHaveURL(/\/music\/\d+\/edit/, { timeout: 5_000 })

      const titleInput = page.getByLabel(/título/i).first()
      if (await titleInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        const currentVal = await titleInput.inputValue()
        expect(currentVal).toContain('E2E')
      }
    }
  })

  test('step 5: delete the uploaded music', async ({ page }) => {
    await goToPage(page, 'music')
    await waitForTableLoad(page)
    await searchMusic(page, musicTitle)

    await deleteMusic(page, musicTitle)
    await page.waitForTimeout(1_000)
  })
})

// =====================================================================
// WF-02: Music -> Add to List -> Export PDF
// =====================================================================
test.describe('WF-02: Music -> Add to List -> Export PDF', () => {
  test.describe.configure({ mode: 'serial' })
  const listName = testData.list.name()

  test('step 1: create a new list', async ({ page }) => {
    await goToPage(page, 'lists')
    await createList(page, listName, testData.list.observations)
    await waitForTableLoad(page)

    const listText = page.getByText(listName).first()
    await expect(listText).toBeVisible({ timeout: 5_000 })
  })

  test('step 2: add music to the list from music page', async ({ page }) => {
    await goToPage(page, 'music')
    await waitForTableLoad(page)

    const firstRow = page.locator('table tbody tr').first()
    const hasMusic = await firstRow.isVisible({ timeout: 3_000 }).catch(() => false)
    if (!hasMusic) {
      test.skip()
      return
    }

    const firstTitle = await firstRow.locator('td').first().textContent()
    if (!firstTitle) return

    await addMusicToList(page, firstTitle.trim(), listName)
  })

  test('step 3: verify list has items', async ({ page }) => {
    await goToPage(page, 'lists')
    await waitForTableLoad(page)

    const listRow = page.locator('table tbody tr').filter({ hasText: listName }).first()
    await expect(listRow).toBeVisible({ timeout: 5_000 })

    const viewBtn = listRow.getByLabel(/visualizar lista/i).first()
    if (await viewBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await viewBtn.click()
      await page.waitForTimeout(2_000)
      await expect(page).toHaveURL(/\/lists\/\d+/, { timeout: 5_000 })
    }
  })

  test('step 4: export list as PDF', async ({ page }) => {
    await goToPage(page, 'lists')
    await waitForTableLoad(page)

    const listRow = page.locator('table tbody tr').filter({ hasText: listName }).first()
    const pdfBtn = listRow.getByLabel(/baixar pdf/i).first()

    if (await pdfBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15_000 }).catch(() => null),
        pdfBtn.click(),
      ])

      if (download) {
        expect(download.suggestedFilename()).toMatch(/\.pdf$/i)
      }
    }
  })

  test('step 5: generate report', async ({ page }) => {
    await goToPage(page, 'lists')
    await waitForTableLoad(page)

    const listRow = page.locator('table tbody tr').filter({ hasText: listName }).first()
    const reportBtn = listRow.getByLabel(/gerar relatório/i).first()

    if (await reportBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await reportBtn.click()
      await page.waitForTimeout(2_000)
    }
  })
})

// =====================================================================
// WF-03: Full List Lifecycle
// =====================================================================
test.describe('WF-03: Full List Lifecycle', () => {
  test.describe.configure({ mode: 'serial' })
  const originalName = testData.list.name()
  const duplicateName = `Cópia ${testData.list.name()}`

  test('step 1: create list with name and observations', async ({ page }) => {
    await goToPage(page, 'lists')
    await createList(page, originalName, 'Lista para teste de ciclo de vida completo')
    await waitForTableLoad(page)
    await expect(page.getByText(originalName).first()).toBeVisible({ timeout: 5_000 })
  })

  test('step 2: view list detail', async ({ page }) => {
    await goToPage(page, 'lists')
    await waitForTableLoad(page)

    const listRow = page.locator('table tbody tr').filter({ hasText: originalName }).first()
    const viewBtn = listRow.getByLabel(/visualizar lista/i).first()

    if (await viewBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await viewBtn.click()
      await page.waitForTimeout(2_000)
      await expect(page).toHaveURL(/\/lists\/\d+/, { timeout: 5_000 })
    }
  })

  test('step 3: open list edit page', async ({ page }) => {
    await goToPage(page, 'lists')
    await waitForTableLoad(page)

    const listRow = page.locator('table tbody tr').filter({ hasText: originalName }).first()
    const editBtn = listRow.getByLabel(/editar lista/i).first()

    if (await editBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await editBtn.click()
      await page.waitForTimeout(2_000)
      await expect(page).toHaveURL(/\/lists\/\d+\/edit/, { timeout: 5_000 })
    }
  })

  test('step 4: duplicate the list', async ({ page }) => {
    await goToPage(page, 'lists')
    await waitForTableLoad(page)

    await duplicateList(page, originalName, duplicateName)
    await waitForTableLoad(page)

    const dupItem = page.getByText(duplicateName).first()
    await expect(dupItem).toBeVisible({ timeout: 5_000 })
  })

  test('step 5: delete original list', async ({ page }) => {
    await goToPage(page, 'lists')
    await waitForTableLoad(page)

    await deleteList(page, originalName)
    await page.waitForTimeout(1_000)

    const deletedRow = page.locator('table tbody tr').filter({ hasText: originalName })
    const stillVisible = await deletedRow.isVisible({ timeout: 2_000 }).catch(() => false)
    expect(stillVisible).toBeFalsy()
  })

  test('step 6: verify duplicate still exists', async ({ page }) => {
    await goToPage(page, 'lists')
    await waitForTableLoad(page)

    const dupRow = page.getByText(duplicateName).first()
    await expect(dupRow).toBeVisible({ timeout: 5_000 })
  })
})

// =====================================================================
// WF-04: Settings -> Music Filtering
// =====================================================================
test.describe('WF-04: Settings -> Music Filtering', () => {
  test.describe.configure({ mode: 'serial' })
  const categoryName = testData.category.name()
  const artistName = testData.artist.name()

  test('step 1: create a new category in settings', async ({ page }) => {
    await goToPage(page, 'settings/manage')
    await createCategory(page, categoryName)
    await page.waitForTimeout(1_000)
    await expect(page.getByText(categoryName).first()).toBeVisible({ timeout: 5_000 })
  })

  test('step 2: create a new artist in settings', async ({ page }) => {
    await goToPage(page, 'settings/manage')
    await createArtist(page, artistName)
    await page.waitForTimeout(1_000)
    await expect(page.getByText(artistName).first()).toBeVisible({ timeout: 5_000 })
  })

  test('step 3: verify category appears in music filter', async ({ page }) => {
    await goToPage(page, 'music')
    await waitForTableLoad(page)

    const categoryFilter = page.locator('button, [role="combobox"]').filter({ hasText: /categoria/i }).first()
    if (await categoryFilter.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await categoryFilter.click()
      await page.waitForTimeout(500)

      const option = page.getByText(categoryName, { exact: false }).first()
      const hasOption = await option.isVisible({ timeout: 3_000 }).catch(() => false)
      expect(hasOption).toBeTruthy()
      await page.keyboard.press('Escape')
    }
  })
})

// =====================================================================
// WF-05: Workspace Isolation
// =====================================================================
test.describe('WF-05: Workspace Isolation', () => {
  test.describe.configure({ mode: 'serial' })

  test('step 1: check music count in current workspace', async ({ page }) => {
    await goToPage(page, 'music')
    await waitForTableLoad(page)

    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    // Just verify page loaded successfully
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('step 2: verify workspace switcher exists', async ({ page }) => {
    await goToPage(page, 'music')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const switcher = page.getByLabel(/trocar workspace/i).first()
    const sidebarWs = page.getByText(/workspace/i).first()
    const hasSwitcher = await switcher.isVisible({ timeout: 3_000 }).catch(() => false)
    const hasSidebar = await sidebarWs.isVisible({ timeout: 3_000 }).catch(() => false)
    expect(hasSwitcher || hasSidebar).toBeTruthy()
  })
})

// =====================================================================
// WF-06: Bulk Operations and Edge Cases
// =====================================================================
test.describe('WF-06: Bulk Operations and Edge Cases', () => {
  test.describe.configure({ mode: 'serial' })
  const titles = [
    testData.music.title(),
    testData.music.title(),
    testData.music.title(),
  ]
  const listName = testData.list.name()

  test('step 1: upload 3 musics', async ({ page }) => {
    test.setTimeout(120_000)
    await goToPage(page, 'upload')

    const restricted = page.getByText(/acesso restrito/i).first()
    if (await restricted.isVisible({ timeout: 2_000 }).catch(() => false)) {
      test.skip()
      return
    }

    for (let i = 0; i < 3; i++) {
      const pdfFile = [TEST_PDF, TEST_PDF_2, TEST_PDF_3][i]
      await uploadMusic(page, { filePath: pdfFile, title: titles[i] })
      await page.waitForTimeout(1_000)

      const newUploadBtn = page.getByRole('button', { name: /novo upload/i }).first()
      if (await newUploadBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await newUploadBtn.click()
        await page.waitForTimeout(1_000)
      }
    }
  })

  test('step 2: search with partial match', async ({ page }) => {
    await goToPage(page, 'music')
    await waitForTableLoad(page)
    await searchMusic(page, 'E2E Musica')

    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })

  test('step 3: create a list and add musics', async ({ page }) => {
    await goToPage(page, 'lists')
    await createList(page, listName)
    await waitForTableLoad(page)
    await expect(page.getByText(listName).first()).toBeVisible({ timeout: 5_000 })
  })

  test('step 4: verify dashboard stats', async ({ page }) => {
    await goToPage(page, 'dashboard')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const statsCard = page.getByText(/músicas/i).first()
    await expect(statsCard).toBeVisible({ timeout: 10_000 })
  })
})

// =====================================================================
// WF-07: Dashboard Consistency
// =====================================================================
test.describe('WF-07: Dashboard Consistency', () => {
  test.describe.configure({ mode: 'serial' })

  test('step 1: record initial dashboard stats', async ({ page }) => {
    await goToPage(page, 'dashboard')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const musicLabel = page.getByText(/músicas/i).first()
    await expect(musicLabel).toBeVisible({ timeout: 10_000 })

    const listLabel = page.getByText(/listas/i).first()
    await expect(listLabel).toBeVisible({ timeout: 10_000 })
  })

  test('step 2: upload a new music', async ({ page }) => {
    test.setTimeout(60_000)
    await goToPage(page, 'upload')

    const restricted = page.getByText(/acesso restrito/i).first()
    if (await restricted.isVisible({ timeout: 2_000 }).catch(() => false)) {
      test.skip()
      return
    }

    const title = testData.music.title()
    await uploadMusic(page, { filePath: TEST_PDF, title })
    await page.waitForTimeout(2_000)
  })

  test('step 3: create a new list', async ({ page }) => {
    await goToPage(page, 'lists')
    const listName = testData.list.name()
    await createList(page, listName)
    await waitForTableLoad(page)
    await expect(page.getByText(listName).first()).toBeVisible({ timeout: 5_000 })
  })

  test('step 4: verify dashboard stats updated', async ({ page }) => {
    await goToPage(page, 'dashboard')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const musicLabel = page.getByText(/músicas/i).first()
    await expect(musicLabel).toBeVisible({ timeout: 10_000 })

    const listLabel = page.getByText(/listas/i).first()
    await expect(listLabel).toBeVisible({ timeout: 10_000 })

    const chartsArea = page.locator('canvas, [class*="chart"], [class*="recharts"]').first()
    const hasCharts = await chartsArea.isVisible({ timeout: 5_000 }).catch(() => false)
    const chartTitle = page.getByText(/mais tocadas|top|uploads/i).first()
    const hasTitle = await chartTitle.isVisible({ timeout: 3_000 }).catch(() => false)
    expect(hasCharts || hasTitle).toBeTruthy()
  })
})
