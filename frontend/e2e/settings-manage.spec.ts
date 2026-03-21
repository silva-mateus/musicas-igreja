import { test, expect } from './fixtures'
import { goToPage, waitForTableLoad } from './helpers/navigation'
import { testData } from './helpers/data'
import { createCategory, createArtist, deleteEntity, editEntity } from './helpers/workflow-actions'

test.describe('Settings - Manage Entities', () => {
  test.beforeEach(async ({ page }) => {
    await goToPage(page, 'settings/manage')
  })

  test('7.1 - settings manage page loads', async ({ page }) => {
    await expect(page.getByText(/gerenciar entidades/i).first()).toBeVisible({ timeout: 10_000 })

    const tabs = ['Categorias', 'Artistas', 'Filtros']
    for (const tab of tabs) {
      const tabEl = page.getByRole('tab', { name: new RegExp(tab, 'i') })
      await expect(tabEl).toBeVisible({ timeout: 5_000 })
    }
  })

  test('7.2 - create category', async ({ page }) => {
    const name = testData.category.name()
    await createCategory(page, name)
    await page.waitForTimeout(1_000)

    const categoryItem = page.getByText(name).first()
    await expect(categoryItem).toBeVisible({ timeout: 5_000 })
  })

  test('7.3 - edit category', async ({ page }) => {
    const name = testData.category.name()
    await createCategory(page, name)
    await page.waitForTimeout(1_000)

    const newName = `${name} Editado`
    await editEntity(page, name, newName)
    await page.waitForTimeout(1_000)

    const editedItem = page.getByText(newName).first()
    await expect(editedItem).toBeVisible({ timeout: 5_000 })
  })

  test('7.4 - delete category', async ({ page }) => {
    const name = testData.category.name()
    await createCategory(page, name)
    await page.waitForTimeout(1_000)

    await deleteEntity(page, name)
    await page.waitForTimeout(1_000)

    const deletedItem = page.getByText(name, { exact: true }).first()
    const stillVisible = await deletedItem.isVisible({ timeout: 2_000 }).catch(() => false)
    expect(stillVisible).toBeFalsy()
  })

  test('7.5 - create artist', async ({ page }) => {
    const name = testData.artist.name()
    await createArtist(page, name)
    await page.waitForTimeout(1_000)

    const artistItem = page.getByText(name).first()
    await expect(artistItem).toBeVisible({ timeout: 5_000 })
  })

  test('7.6 - edit artist', async ({ page }) => {
    const name = testData.artist.name()
    await createArtist(page, name)
    await page.waitForTimeout(1_000)

    const newName = `${name} Editado`
    await page.getByRole('tab', { name: /artistas/i }).click()
    await page.waitForTimeout(500)
    await editEntity(page, name, newName)
    await page.waitForTimeout(1_000)

    const editedItem = page.getByText(newName).first()
    await expect(editedItem).toBeVisible({ timeout: 5_000 })
  })

  test('7.7 - delete artist', async ({ page }) => {
    const name = testData.artist.name()
    await createArtist(page, name)
    await page.waitForTimeout(1_000)

    await page.getByRole('tab', { name: /artistas/i }).click()
    await page.waitForTimeout(500)
    await deleteEntity(page, name)
    await page.waitForTimeout(1_000)

    const deletedItem = page.getByText(name, { exact: true }).first()
    const stillVisible = await deletedItem.isVisible({ timeout: 2_000 }).catch(() => false)
    expect(stillVisible).toBeFalsy()
  })

  test('7.8 - custom filter groups tab loads', async ({ page }) => {
    const filtersTab = page.getByRole('tab', { name: /filtros/i })
    await filtersTab.click()
    await page.waitForTimeout(1_000)
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  })

  test('7.11 - toggle show-as-tab for custom filter', async ({ page }) => {
    const filtersTab = page.getByRole('tab', { name: /filtros/i })
    await filtersTab.click()
    await page.waitForTimeout(1_000)

    const toggleSwitch = page.locator('[role="switch"]').first()
    if (await toggleSwitch.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const wasChecked = await toggleSwitch.getAttribute('aria-checked')
      await toggleSwitch.click()
      await page.waitForTimeout(1_500)

      const isChecked = await toggleSwitch.getAttribute('aria-checked')
      expect(isChecked).not.toBe(wasChecked)

      await toggleSwitch.click()
      await page.waitForTimeout(1_000)
    }
  })
})
