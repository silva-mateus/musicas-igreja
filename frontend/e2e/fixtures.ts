import { test as base } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const SESSION_FILE = path.resolve(__dirname, '../playwright/.auth/session-storage.json')

export const test = base.extend({
  page: async ({ page }, use) => {
    if (fs.existsSync(SESSION_FILE)) {
      const sessionData: Record<string, string> = JSON.parse(
        fs.readFileSync(SESSION_FILE, 'utf-8')
      )
      await page.addInitScript((data) => {
        for (const [key, value] of Object.entries(data)) {
          window.sessionStorage.setItem(key, value)
        }
      }, sessionData)
    }
    await use(page)
  },
})

export { expect } from '@playwright/test'
