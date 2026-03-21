import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Authentication', () => {
  test.describe.configure({ mode: 'serial' })

  test('1.1 - login modal appears on protected routes', async ({ page }) => {
    const routes = ['/music', '/lists', '/dashboard', '/upload']

    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
      const loginButton = page.getByRole('button', { name: 'Entrar' }).first()
      await expect(loginButton).toBeVisible({ timeout: 10_000 })
    }
  })

  test('1.2 - login with valid credentials redirects to app', async ({ page }) => {
    const username = process.env.E2E_USERNAME || 'admin'
    const password = process.env.E2E_PASSWORD || 'admin'

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const loginButton = page.getByRole('button', { name: 'Entrar' }).first()
    await expect(loginButton).toBeVisible({ timeout: 10_000 })
    await loginButton.click()

    await page.getByPlaceholder('Digite seu usuário').fill(username)
    await page.getByPlaceholder('Digite sua senha').fill(password)
    await page.getByRole('button', { name: /^Entrar$/i }).click()

    await page.waitForTimeout(3_000)
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const hasUser = await page.evaluate(() => {
      return !!localStorage.getItem('cifras_nmat_auth_user')
    })
    expect(hasUser).toBeTruthy()
  })

  test('1.3 - login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const loginButton = page.getByRole('button', { name: 'Entrar' }).first()
    await expect(loginButton).toBeVisible({ timeout: 10_000 })
    await loginButton.click()

    await page.getByPlaceholder('Digite seu usuário').fill('invaliduser')
    await page.getByPlaceholder('Digite sua senha').fill('wrongpassword')
    await page.getByRole('button', { name: /^Entrar$/i }).click()

    await page.waitForTimeout(2_000)

    const errorVisible = await page.getByText(/erro|inválid|incorret|falha/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false)
    const stillOnLogin = await page.getByPlaceholder('Digite seu usuário')
      .isVisible({ timeout: 2_000 }).catch(() => false)

    expect(errorVisible || stillOnLogin).toBeTruthy()
  })

  test('1.4 - login with empty fields shows validation', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const loginButton = page.getByRole('button', { name: 'Entrar' }).first()
    await expect(loginButton).toBeVisible({ timeout: 10_000 })
    await loginButton.click()

    await page.getByRole('button', { name: /^Entrar$/i }).click()
    await page.waitForTimeout(1_000)

    const formStillVisible = await page.getByPlaceholder('Digite seu usuário')
      .isVisible({ timeout: 2_000 }).catch(() => false)
    expect(formStillVisible).toBeTruthy()
  })

  test('1.6 - root redirects or shows content', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBeLessThan(500)
  })
})
