import { chromium } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000'
const USERNAME = process.env.E2E_USERNAME || 'admin'
const PASSWORD = process.env.E2E_PASSWORD || 'admin'
const AUTH_FILE = path.resolve(__dirname, '../playwright/.auth/user.json')
const SESSION_FILE = path.resolve(__dirname, '../playwright/.auth/session-storage.json')
const WS_STATE_FILE = path.resolve(__dirname, '../playwright/.auth/workspace-state.json')

export default async function globalSetup() {
  const authDir = path.dirname(AUTH_FILE)
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }

  const browser = await chromium.launch()
  const context = await browser.newContext({ baseURL: BASE_URL })
  const page = await context.newPage()

  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

  const loginButton = page.getByRole('button', { name: 'Entrar' }).first()
  await loginButton.waitFor({ state: 'visible', timeout: 10_000 })
  await loginButton.click()

  await page.getByPlaceholder('Digite seu usuário').fill(USERNAME)
  await page.getByPlaceholder('Digite sua senha').fill(PASSWORD)
  await page.getByRole('button', { name: /^Entrar$/i }).click()

  await page.waitForTimeout(3_000)
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

  const changePasswordHeading = page.getByText('Alterar Senha')
  if (await changePasswordHeading.isVisible({ timeout: 2_000 }).catch(() => false)) {
    const newPassword = process.env.E2E_NEW_PASSWORD || PASSWORD
    await page.getByPlaceholder('Digite a nova senha').fill(newPassword)
    await page.getByPlaceholder('Confirme a nova senha').fill(newPassword)
    await page.getByRole('button', { name: 'Alterar Senha' }).click()
    await page.waitForTimeout(2_000)
  }

  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(2_000)

  const hasUser = await page.evaluate((prefix) => {
    return !!localStorage.getItem(`${prefix}_user`)
  }, 'cifras_nmat_auth')

  if (!hasUser) {
    throw new Error('Global setup: auth user not found in localStorage after login')
  }

  const wsId = await page.evaluate(() => {
    return localStorage.getItem('cifras_nmat_active_workspace')
  })
  if (wsId) {
    fs.writeFileSync(WS_STATE_FILE, JSON.stringify({ id: wsId }), 'utf-8')
  }

  await page.context().storageState({ path: AUTH_FILE })

  const sessionData = await page.evaluate(() => {
    const entries: Record<string, string> = {}
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)!
      entries[key] = sessionStorage.getItem(key)!
    }
    return entries
  })
  fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2))

  await browser.close()
}
