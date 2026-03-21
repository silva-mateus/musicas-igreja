import type { Page } from '@playwright/test'
import { expect } from '../fixtures'
import path from 'node:path'

function fixturePath(filename: string) {
  return path.resolve(__dirname, '../fixtures', filename)
}

// ─── Upload ─────────────────────────────────────────────────────────

export async function uploadMusic(page: Page, opts: {
  filePath?: string
  title: string
  artist?: string
  category?: string
}) {
  const pdfPath = opts.filePath || fixturePath('test-music.pdf')

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(pdfPath)
  await page.waitForTimeout(1_000)

  const titleInput = page.getByPlaceholder('Título da música')
  await expect(titleInput.first()).toBeVisible({ timeout: 5_000 })
  await titleInput.first().fill(opts.title)

  if (opts.artist) {
    const artistInput = page.getByPlaceholder('Digite para usar um novo artista ou selecione um existente').first()
    if (await artistInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await artistInput.fill(opts.artist)
      await page.waitForTimeout(500)
      const option = page.getByText(opts.artist, { exact: false }).first()
      if (await option.isVisible({ timeout: 1_500 }).catch(() => false)) {
        await option.click()
      }
    }
  }

  if (opts.category) {
    const categoryTrigger = page.getByPlaceholder('Selecionar categorias').first()
    if (await categoryTrigger.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await categoryTrigger.click()
      await page.waitForTimeout(500)
      const option = page.getByText(opts.category, { exact: false }).first()
      if (await option.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await option.click()
      }
      await page.keyboard.press('Escape')
    }
  }

  await page.getByRole('button', { name: /^Enviar$/i }).click()
  await page.waitForTimeout(3_000)
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
}

export async function uploadMultipleMusics(page: Page, files: Array<{
  filePath?: string
  title: string
}>) {
  const paths = files.map(f => f.filePath || fixturePath('test-music.pdf'))

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(paths)
  await page.waitForTimeout(1_000)

  for (let i = 0; i < files.length; i++) {
    const titleInputs = page.getByPlaceholder('Título da música')
    const input = titleInputs.nth(i)
    if (await input.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await input.fill(files[i].title)
    }
  }
}

// ─── Lists ──────────────────────────────────────────────────────────

export async function createList(page: Page, name: string, observations?: string) {
  await page.getByRole('button', { name: /nova lista/i }).click()
  await expect(page.getByText('Nova Lista de Música')).toBeVisible({ timeout: 5_000 })
  await page.getByPlaceholder('Ex: Missa Dominical').fill(name)
  if (observations) {
    await page.getByPlaceholder('Descreva o propósito').fill(observations)
  }
  await page.getByRole('button', { name: /^Criar Lista$/i }).click()
  await page.waitForTimeout(2_000)
}

export async function duplicateList(page: Page, listName: string, newName: string) {
  const row = page.locator('table tbody tr').filter({ hasText: listName }).first()
  await expect(row).toBeVisible({ timeout: 5_000 })

  const dupBtn = row.locator('button').filter({ has: page.locator('[class*="Copy"]') }).first()
  const dupByLabel = row.getByLabel(/duplicar lista/i).first()
  const target = await dupByLabel.isVisible({ timeout: 1_000 }).catch(() => false) ? dupByLabel : dupBtn
  await target.click()

  await expect(page.getByText('Duplicar Lista')).toBeVisible({ timeout: 5_000 })
  const nameInput = page.getByPlaceholder('Digite o nome da nova lista')
  await nameInput.clear()
  await nameInput.fill(newName)
  await page.getByRole('button', { name: /^Duplicar Lista$/i }).click()
  await page.waitForTimeout(2_000)
}

export async function deleteList(page: Page, listName: string) {
  const row = page.locator('table tbody tr').filter({ hasText: listName }).first()
  await expect(row).toBeVisible({ timeout: 5_000 })

  const delByLabel = row.getByLabel(/excluir lista/i).first()
  if (await delByLabel.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await delByLabel.click()
  } else {
    const delBtn = row.locator('button').filter({ has: page.locator('[class*="Trash"]') }).first()
    await delBtn.click()
  }

  await expect(page.getByText('Excluir Lista')).toBeVisible({ timeout: 5_000 })
  await page.getByRole('button', { name: /^Excluir$/i }).click()
  await page.waitForTimeout(2_000)
}

export async function addMusicToList(page: Page, musicTitle: string, listName: string) {
  const row = page.locator('table tbody tr').filter({ hasText: musicTitle }).first()
  await expect(row).toBeVisible({ timeout: 5_000 })

  const menuBtn = row.locator('button').last()
  await menuBtn.click()
  await page.waitForTimeout(500)

  const addOption = page.getByText(/adicionar à lista/i).first()
  await expect(addOption).toBeVisible({ timeout: 3_000 })
  await addOption.click()

  await expect(page.getByText('Adicionar à Lista')).toBeVisible({ timeout: 5_000 })
  await page.waitForTimeout(1_000)

  const listOption = page.getByText(listName, { exact: false }).first()
  await expect(listOption).toBeVisible({ timeout: 5_000 })
  await listOption.click()

  await page.getByRole('button', { name: /^Adicionar$/i }).click()
  await page.waitForTimeout(2_000)
}

export async function exportListPdf(page: Page, listName: string) {
  const row = page.locator('table tbody tr').filter({ hasText: listName }).first()
  await expect(row).toBeVisible({ timeout: 5_000 })

  const pdfBtn = row.getByLabel(/baixar pdf/i).first()
  if (await pdfBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await pdfBtn.click()
  }
  await page.waitForTimeout(2_000)
}

export async function generateListReport(page: Page, listName: string) {
  const row = page.locator('table tbody tr').filter({ hasText: listName }).first()
  await expect(row).toBeVisible({ timeout: 5_000 })

  const reportBtn = row.getByLabel(/gerar relatório/i).first()
  if (await reportBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await reportBtn.click()
  }
  await page.waitForTimeout(2_000)
}

// ─── Music Actions ──────────────────────────────────────────────────

export async function deleteMusic(page: Page, musicTitle: string) {
  const row = page.locator('table tbody tr').filter({ hasText: musicTitle }).first()
  await expect(row).toBeVisible({ timeout: 5_000 })

  const menuBtn = row.locator('button').last()
  await menuBtn.click()
  await page.waitForTimeout(500)

  const deleteOption = page.getByText(/excluir/i).first()
  if (await deleteOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await deleteOption.click()
    await page.waitForTimeout(500)
    const confirmBtn = page.getByRole('button', { name: /^Excluir$/i })
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click()
    }
    await page.waitForTimeout(2_000)
  }
}

export async function searchMusic(page: Page, query: string) {
  const searchInput = page.getByPlaceholder('Título da música...')
  await expect(searchInput).toBeVisible({ timeout: 5_000 })
  await searchInput.clear()
  await searchInput.fill(query)
  await page.waitForTimeout(1_500)
}

export async function searchLists(page: Page, query: string) {
  const searchInput = page.getByPlaceholder('Buscar listas por nome...')
  await expect(searchInput).toBeVisible({ timeout: 5_000 })
  await searchInput.clear()
  await searchInput.fill(query)
  await page.waitForTimeout(1_500)
}

// ─── Settings ───────────────────────────────────────────────────────

export async function createCategory(page: Page, name: string) {
  const categoriesTab = page.getByRole('tab', { name: /categorias/i })
  await categoriesTab.click()
  await page.waitForTimeout(500)

  await page.getByLabel(/adicionar nova entidade/i).click()
  await expect(page.getByText(/adicionar categoria/i)).toBeVisible({ timeout: 5_000 })
  await page.getByPlaceholder('Digite o nome...').fill(name)
  await page.getByRole('button', { name: /^Adicionar$/i }).click()
  await page.waitForTimeout(1_500)
}

export async function createArtist(page: Page, name: string) {
  const artistsTab = page.getByRole('tab', { name: /artistas/i })
  await artistsTab.click()
  await page.waitForTimeout(500)

  await page.getByLabel(/adicionar nova entidade/i).click()
  await expect(page.getByText(/adicionar artista/i)).toBeVisible({ timeout: 5_000 })
  await page.getByPlaceholder('Digite o nome...').fill(name)
  await page.getByRole('button', { name: /^Adicionar$/i }).click()
  await page.waitForTimeout(1_500)
}

export async function deleteEntity(page: Page, entityName: string) {
  const row = page.locator('li, tr, [class*="flex"]').filter({ hasText: entityName }).first()
  await expect(row).toBeVisible({ timeout: 5_000 })
  await row.getByTitle('Excluir').click()
  await expect(page.getByText(/excluir/i).first()).toBeVisible({ timeout: 5_000 })
  await page.getByRole('button', { name: /^Excluir$/i }).click()
  await page.waitForTimeout(1_500)
}

export async function editEntity(page: Page, entityName: string, newName: string) {
  const row = page.locator('li, tr, [class*="flex"]').filter({ hasText: entityName }).first()
  await expect(row).toBeVisible({ timeout: 5_000 })
  await row.getByTitle('Editar nome').click()
  await expect(page.getByText(/editar/i).first()).toBeVisible({ timeout: 5_000 })
  await page.getByPlaceholder('Digite o novo nome...').fill(newName)
  await page.getByRole('button', { name: /^Salvar$/i }).click()
  await page.waitForTimeout(1_500)
}

// ─── Workspace ──────────────────────────────────────────────────────

export async function switchWorkspace(page: Page, workspaceName: string) {
  const switcher = page.getByLabel(/trocar workspace/i).first()
  if (await switcher.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await switcher.click()
    await page.waitForTimeout(500)
    const option = page.getByText(workspaceName, { exact: false }).first()
    await expect(option).toBeVisible({ timeout: 3_000 })
    await option.click()
    await page.waitForTimeout(2_000)
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  }
}
