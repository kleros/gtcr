import { expect, test } from './support/test'

/* Browse: which lists, the search, the kind filter and the layout. */

const listLinks = (page: import('@playwright/test').Page) =>
  page.getByRole('region', { name: 'All lists' }).getByRole('link')

test.beforeEach(async ({ page }) => {
  await page.goto('/browse')
  await expect(listLinks(page).first()).toBeVisible()
  // The order settles as each list's activity arrives.
  await page.waitForLoadState('networkidle')
})

test('opens on the Kleros Verified lists, each carrying the seal', async ({
  page,
}) => {
  const which = page.getByRole('radiogroup', { name: 'Which lists' })
  await expect(
    which.getByRole('radio', { name: 'Kleros Verified' }),
  ).toBeChecked()
  const links = listLinks(page)
  const count = await links.count()
  expect(count).toBeGreaterThan(0)
  for (let i = 0; i < Math.min(count, 5); i++)
    await expect(
      links.nth(i).getByRole('img', { name: 'Kleros Verified' }),
    ).toBeVisible()
})

test('Community shows the lists without the seal, and says so in the link', async ({
  page,
}) => {
  await page
    .getByRole('radiogroup', { name: 'Which lists' })
    .getByRole('radio', { name: 'Community' })
    .click()
  await expect(page).toHaveURL(/trust=community/)
  const first = listLinks(page).first()
  await expect(first).toBeVisible()
  await expect(first.getByRole('img', { name: 'Kleros Verified' })).toHaveCount(
    0,
  )
  await page.reload()
  await expect(page.getByRole('radio', { name: 'Community' })).toBeChecked()
})

test('the search narrows the lists as you type', async ({ page }) => {
  const before = await listLinks(page).count()
  await page.getByRole('textbox', { name: 'Search lists' }).fill('Tokens')
  await expect(listLinks(page).first()).toContainText('Tokens')
  expect(await listLinks(page).count()).toBeLessThan(before)
  for (const text of await listLinks(page).allTextContents())
    expect(text.toLowerCase()).toContain('tokens')
})

test('the kind filter keeps one kind of list', async ({ page }) => {
  await page
    .getByRole('radiogroup', { name: 'Which lists' })
    .getByRole('radio', { name: 'All' })
    .click()
  const kinds = page.getByRole('group', { name: 'List type' })
  const stake = kinds.getByRole('button', { name: 'Stake' })
  await stake.click()
  await expect(stake).toHaveAttribute('aria-pressed', 'true')
  await page.waitForLoadState('networkidle')
  const links = listLinks(page)
  await expect(links.first()).toBeVisible()
  for (const text of await links.allTextContents())
    expect(text).toContain('Stake')
})

test('a list opens its own page', async ({ page }) => {
  const first = listLinks(page).first()
  const href = await first.getAttribute('href')
  expect(href).toMatch(/^\/tcr\/\d+\/0x[0-9a-f]{40}$/)
  await first.click()
  await expect(page).toHaveURL(new RegExp(`${href}`))
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('the layout choice is kept', async ({ page }) => {
  const layout = page.getByRole('radiogroup', { name: 'Layout' })
  const cards = layout.getByRole('radio', { name: 'Cards' })
  await cards.click()
  await expect(cards).toBeChecked()
  await page.reload()
  await expect(
    page.getByRole('radiogroup', { name: 'Layout' }).getByRole('radio', {
      name: 'Cards',
    }),
  ).toBeChecked()
})
