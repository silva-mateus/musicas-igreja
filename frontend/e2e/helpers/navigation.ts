import type { Page } from '@playwright/test'
import { expect } from '../fixtures'
import { ensureAuth } from './auth'

export async function goToPage(page: Page, pagePath: string) {
  await page.goto(`/${pagePath}`)
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

  const loginButton = page.getByRole('button', { name: 'Entrar' }).first()
  const needsAuth = await loginButton.isVisible({ timeout: 2_000 }).catch(() => false)

  if (needsAuth) {
    await ensureAuth(page)
    await page.goto(`/${pagePath}`)
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  }

  await page.waitForTimeout(500)
}

export async function waitForTableLoad(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(500)
}

export async function expectToast(page: Page, text?: string | RegExp) {
  const toast = page.locator('[data-radix-toast-viewport] li, [role="status"]').first()
  await expect(toast).toBeVisible({ timeout: 5_000 })
  if (text) {
    await expect(toast).toContainText(text)
  }
}

export async function openCreateDialog(page: Page, buttonName: string | RegExp) {
  const btn = page.getByRole('button', { name: buttonName })
  await expect(btn).toBeVisible({ timeout: 5_000 })
  await btn.click()
}

export async function submitDialog(page: Page, buttonName: string | RegExp) {
  await page.getByRole('button', { name: buttonName }).click()
}

export async function confirmDelete(page: Page) {
  await expect(page.getByText(/excluir/i).first()).toBeVisible({ timeout: 5_000 })
  await page.getByRole('button', { name: /^Excluir$/i }).click()
}

export async function expectEmptyState(page: Page, text?: string | RegExp) {
  const pattern = text || /nenhum/i
  await expect(page.getByText(pattern).first()).toBeVisible({ timeout: 5_000 })
}

export async function expectPageTitle(page: Page, title: string | RegExp) {
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 })
}
