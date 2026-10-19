import { expect, test } from '@playwright/test'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const out = (name: string) => fileURLToPath(new URL(`../docs/evidence/screenshots/e2e/${name}.png`, import.meta.url))
// The server writes emails to repo-root data/outbox whatever DB_PATH is; remember what was there so afterAll removes only ours.
const outbox = fileURLToPath(new URL('../data/outbox', import.meta.url))
const list = () => (existsSync(outbox) ? readdirSync(outbox) : [])
let before: string[] = []
test.beforeAll(() => { before = list() })
test.afterAll(() => {
  const created = list().filter((f) => !before.includes(f))
  console.log(`outbox files created by this run (deleted): ${created.join(', ') || 'none'}`)
  for (const f of created) rmSync(`${outbox}/${f}`)
})

test('user and admin walkthrough with screenshots', async ({ page }) => {
  const switchTo = async (name: string) => {
    await page.getByRole('combobox', { name: 'Switch user' }).click()
    await page.getByRole('option', { name }).click()
    await expect(page.getByText(`${name} (`)).toBeVisible()
  }

  // Anna: My alerts
  await page.goto('/')
  await expect(page.getByText('Anna (HU)')).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Admin' })).toBeVisible()
  await page.getByRole('tab', { name: 'My alerts' }).click()
  await page.screenshot({ path: out('1-my-alerts'), fullPage: true })

  // Bence: no Admin tab; Channels; test toast
  await switchTo('Bence')
  await expect(page.getByRole('tab', { name: 'Admin' })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Channels' }).click()
  await page.getByRole('button', { name: 'Send test' }).first().click()
  await expect(page.getByText('Test sent')).toBeVisible()
  await page.screenshot({ path: out('2-channels'), fullPage: true })

  // Anna: Admin, inject HU 0.6 then NP 1.0
  await switchTo('Anna')
  await page.getByRole('tab', { name: 'Admin' }).click()

  const slider = page.getByRole('slider')
  const inject = async (title: string, country: string, sev: 'Home' | 'End' | number, toast: string, shot?: string) => {
    await page.getByRole('button', { name: 'Inject event' }).click()
    await page.getByLabel('Title').fill(title)
    await page.getByLabel('Country (ISO2)').fill(country)
    await slider.focus()
    if (typeof sev === 'number') {
      await page.keyboard.press('Home')
      for (let i = 0; i < sev; i++) await page.keyboard.press('ArrowRight') // 0.05 per step
    } else await page.keyboard.press(sev)
    if (shot) await page.screenshot({ path: out(shot) })
    await page.getByRole('button', { name: 'Inject', exact: true }).click()
    await expect(page.getByText(toast)).toBeVisible()
  }
  await inject('E2E flood in Budapest', 'HU', 12, '2 deliveries created', '6-inject-dialog')
  await inject('E2E earthquake in Nepal', 'NP', 'End', '3 deliveries created')

  await page.getByRole('tab', { name: 'Deliveries' }).click()
  await expect(page.getByText('critical override').first()).toBeVisible()
  await page.screenshot({ path: out('4-admin-deliveries'), fullPage: true })

  await page.getByRole('tab', { name: 'Sources' }).click()
  await expect(page.getByRole('switch')).toHaveCount(5)
  await page.screenshot({ path: out('5-admin-sources'), fullPage: true })

  // Bence: History now shows the deliveries he received
  await switchTo('Bence')
  await page.getByRole('tab', { name: 'History' }).click()
  await expect(page.getByText('E2E flood in Budapest')).toBeVisible()
  await page.screenshot({ path: out('3-history'), fullPage: true })

  // Anna again: Admin tab is back
  await switchTo('Anna')
  await expect(page.getByRole('tab', { name: 'Admin' })).toBeVisible()
})
