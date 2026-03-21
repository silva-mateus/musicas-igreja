import type { Page } from '@playwright/test'
import { expect } from '../fixtures'
import fs from 'node:fs'
import path from 'node:path'

const AUTH_FILE = path.resolve(__dirname, '../../playwright/.auth/user.json')
const WS_STATE_FILE = path.resolve(__dirname, '../../playwright/.auth/workspace-state.json')

export async function ensureAuth(page: Page) {
  const loginButton = page.getByRole('button', { name: 'Entrar' }).first()
  const isLoginVisible = await loginButton.isVisible({ timeout: 2_000 }).catch(() => false)

  if (isLoginVisible) {
    const username = process.env.E2E_USERNAME || 'admin'
    const password = process.env.E2E_PASSWORD || 'admin'

    await loginButton.click()
    await page.getByPlaceholder('Digite seu usuário').fill(username)
    await page.getByPlaceholder('Digite sua senha').fill(password)
    await page.getByRole('button', { name: /^Entrar$/i }).click()
    await page.waitForTimeout(3_000)
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  }
}

export async function ensureWorkspace(page: Page) {
  if (fs.existsSync(WS_STATE_FILE)) {
    const wsData = JSON.parse(fs.readFileSync(WS_STATE_FILE, 'utf-8'))
    await page.evaluate((id: string) => {
      localStorage.setItem('cifras_nmat_active_workspace', id)
    }, wsData.id)
  }
}

export async function saveState(page: Page) {
  await page.context().storageState({ path: AUTH_FILE })
}

export async function saveWorkspaceState(page: Page) {
  const wsId = await page.evaluate(() => {
    return localStorage.getItem('cifras_nmat_active_workspace')
  })
  if (wsId) {
    fs.writeFileSync(WS_STATE_FILE, JSON.stringify({ id: wsId }), 'utf-8')
  }
}
