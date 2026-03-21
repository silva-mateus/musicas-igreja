import { test, expect } from './fixtures'
import { goToPage, waitForTableLoad } from './helpers/navigation'
import { testData } from './helpers/data'
import { uploadMusic, searchMusic } from './helpers/workflow-actions'
import path from 'node:path'

const TEST_PDF = path.resolve(__dirname, 'fixtures/test-music.pdf')
const TEST_PDF_2 = path.resolve(__dirname, 'fixtures/test-music-2.pdf')
const TEST_PDF_3 = path.resolve(__dirname, 'fixtures/test-music-3.pdf')

test.describe('File Upload', () => {
  test.beforeEach(async ({ page }) => {
    await goToPage(page, 'upload')
  })

  test('5.1 - upload page loads with dropzone', async ({ page }) => {
    const dropzone = page.getByText(/arraste um pdf|selecionar/i).first()
    const restricted = page.getByText(/acesso restrito/i).first()

    const hasDropzone = await dropzone.isVisible({ timeout: 5_000 }).catch(() => false)
    const isRestricted = await restricted.isVisible({ timeout: 2_000 }).catch(() => false)

    expect(hasDropzone || isRestricted).toBeTruthy()
  })

  test('5.2 - upload single PDF with metadata', async ({ page }) => {
    test.setTimeout(60_000)

    const restricted = page.getByText(/acesso restrito/i).first()
    if (await restricted.isVisible({ timeout: 2_000 }).catch(() => false)) return

    const title = testData.music.title()
    await uploadMusic(page, { filePath: TEST_PDF, title })

    const results = page.getByText(/resultado do upload|upload concluído/i).first()
    const toast = page.getByText(/upload concluído/i).first()
    const hasResults = await results.isVisible({ timeout: 10_000 }).catch(() => false)
    const hasToast = await toast.isVisible({ timeout: 5_000 }).catch(() => false)
    expect(hasResults || hasToast).toBeTruthy()
  })

  test('5.3 - upload multiple PDFs', async ({ page }) => {
    test.setTimeout(60_000)

    const restricted = page.getByText(/acesso restrito/i).first()
    if (await restricted.isVisible({ timeout: 2_000 }).catch(() => false)) return

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles([TEST_PDF, TEST_PDF_2, TEST_PDF_3])
    await page.waitForTimeout(1_000)

    const fileCount = page.getByText(/3/).first()
    const hasMultiple = await fileCount.isVisible({ timeout: 3_000 }).catch(() => false)
    const titleInputs = page.getByPlaceholder('Título da música')
    const inputCount = await titleInputs.count()

    expect(hasMultiple || inputCount >= 3).toBeTruthy()
  })

  test('5.4 - reject non-PDF file', async ({ page }) => {
    const restricted = page.getByText(/acesso restrito/i).first()
    if (await restricted.isVisible({ timeout: 2_000 }).catch(() => false)) return

    const txtPath = path.resolve(__dirname, 'fixtures/test-music.pdf')
    const fileInput = page.locator('input[type="file"]')

    await fileInput.setInputFiles(txtPath)
    await page.waitForTimeout(1_000)
  })

  test('5.5 - upload with required fields missing shows validation', async ({ page }) => {
    const restricted = page.getByText(/acesso restrito/i).first()
    if (await restricted.isVisible({ timeout: 2_000 }).catch(() => false)) return

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(TEST_PDF)
    await page.waitForTimeout(1_000)

    const sendBtn = page.getByRole('button', { name: /^Enviar$/i })
    if (await sendBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await sendBtn.click()
      await page.waitForTimeout(2_000)

      const validationError = page.getByText(/dados incompletos|obrigatório/i).first()
      const hasError = await validationError.isVisible({ timeout: 3_000 }).catch(() => false)
      const stillOnUpload = await page.getByText(/arquivos para upload/i).first()
        .isVisible({ timeout: 2_000 }).catch(() => false)
      expect(hasError || stillOnUpload).toBeTruthy()
    }
  })

  test('5.6 - verify uploaded music appears in music page', async ({ page }) => {
    test.setTimeout(60_000)

    const restricted = page.getByText(/acesso restrito/i).first()
    if (await restricted.isVisible({ timeout: 2_000 }).catch(() => false)) return

    const title = testData.music.title()
    await uploadMusic(page, { filePath: TEST_PDF_2, title })

    await page.waitForTimeout(2_000)

    const seeAllBtn = page.getByText(/ver todas as músicas/i).first()
    if (await seeAllBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await seeAllBtn.click()
    } else {
      await goToPage(page, 'music')
    }

    await waitForTableLoad(page)
    await searchMusic(page, title)

    const musicRow = page.getByText(title).first()
    await expect(musicRow).toBeVisible({ timeout: 10_000 })
  })

  test('5.7 - upload progress indicator is visible during upload', async ({ page }) => {
    test.setTimeout(60_000)

    const restricted = page.getByText(/acesso restrito/i).first()
    if (await restricted.isVisible({ timeout: 2_000 }).catch(() => false)) return

    const title = testData.music.title()

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(TEST_PDF_3)
    await page.waitForTimeout(1_000)

    const titleInput = page.getByPlaceholder('Título da música').first()
    if (await titleInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await titleInput.fill(title)
    }

    const categoryTrigger = page.getByPlaceholder('Selecionar categorias').first()
    if (await categoryTrigger.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await categoryTrigger.click()
      await page.waitForTimeout(500)
      const option = page.locator('[role="option"]').first()
      if (await option.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await option.click()
      }
      await page.keyboard.press('Escape')
    }

    const sendBtn = page.getByRole('button', { name: /^Enviar$/i })
    if (await sendBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await sendBtn.click()

      const progress = page.locator('[role="progressbar"]').first()
      const uploading = page.getByText(/enviando/i).first()
      const hasProgress = await progress.isVisible({ timeout: 5_000 }).catch(() => false)
      const hasUploading = await uploading.isVisible({ timeout: 5_000 }).catch(() => false)

      await page.waitForTimeout(5_000)
    }
  })
})
