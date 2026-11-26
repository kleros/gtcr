import { expect, test } from './support/test'

/* The dashboard: its title, its figures, the chart's range and its links. */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('the title reads as one sentence to a screen reader', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
    'Verify tokens, contracts, domains and more, or earn by keeping lists clean.',
  )
})

test('the hero shows both money totals in dollars', async ({ page }) => {
  for (const label of ['Passed through Curate', 'Bounties won']) {
    const block = page.locator('[data-money]').filter({ hasText: label })
    await expect(block).toBeVisible()
    await expect(block).toContainText(/\$\d/)
  }
})

test('the live strip counts entries, lists and requests', async ({ page }) => {
  for (const label of ['Entries', 'Lists', 'Open requests', 'In court now'])
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
  await expect(
    page.getByRole('status').filter({ hasText: 'Live' }),
  ).toBeVisible()
})

test('the chart switches range and says what it shows', async ({ page }) => {
  const range = page.getByRole('radiogroup', { name: 'Chart range' })
  const legend = page.getByRole('list', { name: 'Chart series' })
  // It opens on 6M (round 16).
  await expect(range.getByRole('radio', { name: '6M' })).toBeChecked()
  await expect(legend).toContainText('last 6 months')

  await range.getByRole('radio', { name: '30D' }).click()
  await expect(range.getByRole('radio', { name: '30D' })).toBeChecked()
  await expect(legend).toContainText('Per day')

  await range.getByRole('radio', { name: '3Y' }).click()
  await expect(legend).toContainText('Per month')

  // Top curators follow the chart's range (round 8).
  await expect(
    page.getByRole('region', { name: 'Top curators' }),
  ).toContainText('last 3 years')
})

test('a top curator opens their profile', async ({ page }) => {
  const curators = page.getByRole('region', { name: 'Top curators' })
  const first = curators.getByRole('link').first()
  const href = await first.getAttribute('href')
  expect(href).toMatch(/^\/address\/0x[0-9a-f]{40}$/)
  await first.click()
  await expect(page).toHaveURL(new RegExp(`${href}$`))
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

test('the board opens under its own heading, its requests counted in their panel', async ({
  page,
}) => {
  const open = page.getByRole('region', { name: 'Open for verification' })
  await expect(open.getByRole('heading', { level: 2 })).toHaveText(
    'Open for verification',
  )
  const submissions = open.getByRole('region', { name: 'Recent submissions' })
  await expect(
    submissions.getByRole('img', {
      name: /requests open now, in their challenge window$/,
    }),
  ).toBeVisible()
  await expect(submissions).toContainText('Up for grabs')
})

test('a list chip filters the open requests and leads on to its list', async ({
  page,
}) => {
  const submissions = page.getByRole('region', { name: 'Recent submissions' })
  const chips = submissions.getByRole('group', {
    name: "Show one list's requests",
  })
  await expect(chips.getByRole('button').first()).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const chip = chips.getByRole('button').nth(1)
  const title = (await chip.getAttribute('title')) ?? ''
  expect(title).not.toBe('')
  await chip.click()
  await expect(chip).toHaveAttribute('aria-pressed', 'true')

  // Its own page, filtered to what can be challenged, is a click away.
  const all = submissions.getByRole('link', {
    name: new RegExp(`^All [\\d,]+\\+? in ${escapeRegExp(title)}`),
  })
  await expect(all).toHaveAttribute(
    'href',
    /^\/tcr\/\d+\/0x[0-9a-f]{40}\?submitted=true&removalRequested=true/,
  )
  // Every row left is that list's: its link is under the list's address.
  const list = new URL((await all.getAttribute('href')) ?? '', 'http://x')
    .pathname
  const rows = submissions
    .getByRole('list', { name: /^Requests in their challenge window/ })
    .getByRole('listitem')
  await expect(rows.first()).toBeVisible()
  for (const row of await rows.all())
    await expect(row.getByRole('link')).toHaveAttribute(
      'href',
      new RegExp(`^${escapeRegExp(list)}/`),
    )

  await all.click()
  await expect(
    page.getByRole('combobox', { name: /^Status:/ }),
  ).not.toHaveAccessibleName('Status: All')
})

test('the hero leaves out what is up for grabs under $2,000', async ({
  page,
}) => {
  // The recording's pool is $720 (24 requests of 30 xDAI): under the gate.
  await expect(
    page.locator('[data-money]').filter({ hasText: 'Bounties won' }),
  ).toContainText(/\$\d/)
  await expect(page.locator('[data-money]')).toHaveCount(2)
  await expect(page.getByText('Up for grabs now')).toHaveCount(0)
})

test('the buttons under the title go to Browse and the launch page', async ({
  page,
}) => {
  await page
    .getByRole('main')
    .getByRole('link', { name: 'Explore lists' })
    .click()
  await expect(page).toHaveURL(/\/browse$/)
  await page.goBack()
  await page
    .getByRole('main')
    .getByRole('link', { name: 'Launch a list' })
    .click()
  await expect(page).toHaveURL(/\/launch\/\d+$/)
})
