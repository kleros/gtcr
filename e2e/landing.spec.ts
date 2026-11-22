import { expect, test } from './support/test'

/* The landing page: its title, its money, its theme switch and its links. */

test('the title reads as one sentence and its word runs once', async ({
  page,
}) => {
  // Every word the page shows, from the first parse on: a loaded runner can
  // be slower than the word's first move.
  await page.addInitScript(() => {
    const seen: string[] = []
    Object.assign(window, { wordsSeen: seen })
    new MutationObserver(() => {
      const text =
        document.querySelector('[data-rotating-word]')?.textContent ?? ''
      if (text && seen.at(-1) !== text) seen.push(text)
    }).observe(document, {
      subtree: true,
      childList: true,
      characterData: true,
    })
  })
  await page.goto('/landing/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
    'Verify tokens, contracts, domains and more, or earn by keeping lists clean.',
  )
  const word = page.locator('[data-rotating-word]')
  await expect(word).toHaveText('anything,', { timeout: 15_000 })
  expect(
    await page.evaluate(
      () => (window as unknown as { wordsSeen: string[] }).wordsSeen,
    ),
  ).toEqual([
    'tokens,',
    'contracts,',
    'domains,',
    'addresses,',
    'markets,',
    'documents,',
    'anything,',
  ])
})

test('under reduced motion the word stays', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/landing/')
  const word = page.locator('[data-rotating-word]')
  await expect(word).toHaveText('tokens,')
  await page.waitForTimeout(2500)
  await expect(word).toHaveText('tokens,')
})

test('the money card shows the dashboard’s two totals, in its order', async ({
  page,
}) => {
  await page.goto('/landing/')
  const money = page.locator('[data-money]')
  await expect(money.locator('.money-row h2')).toHaveText([
    'Passed through Curate',
    'Bounties won',
  ])
  await expect(money).toContainText(/\$\d/)
  // No coin and no chain on the landing (DESIGN.md).
  await expect(money).not.toContainText(/xDAI|ETH\b|Gnosis|Ethereum/)
})

test('the theme switch applies a theme and the app keeps it', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the theme switch is hidden on phones')
  await page.goto('/landing/')
  await page
    .locator('[data-theme-switch]')
    .getByRole('radio', { name: /^Light/ })
    .click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.goto('/browse')
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'light')
})

test('its links lead into the app', async ({ page }) => {
  await page.goto('/landing/')
  await expect(
    page.getByRole('link', { name: 'Open the app' }),
  ).toHaveAttribute('href', '/')
  await page.getByRole('link', { name: 'Explore lists' }).first().click()
  await expect(page).toHaveURL(/\/browse$/)
})
