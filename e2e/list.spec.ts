import { GNOSIS_LIST, STAKE_LIST } from './routes'
import { expect, test } from './support/test'

/* A list's page: its header, filters, sort, layout, pages and entries. */

const entries = (page: import('@playwright/test').Page) =>
  page.getByRole('region', { name: 'Tags', exact: true })

test.describe('Standard list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GNOSIS_LIST)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Address Tags' }),
    ).toBeVisible()
  })

  test('the header names the list, its standing and what submitting costs', async ({
    page,
  }) => {
    const header = page.getByRole('region', { name: 'Address Tags' })
    await expect(header.getByText('Kleros Verified')).toBeVisible()
    await expect(
      header.getByRole('button', { name: /^Submit tag · [\d.]+ xDAI$/ }),
    ).toBeVisible()
    await expect(header).toContainText('A deposit, not a fee')
  })

  test('submitting opens the submit page', async ({ page }) => {
    await page.getByRole('button', { name: /^Submit tag/ }).click()
    await expect(page).toHaveURL(new RegExp(`${GNOSIS_LIST}/submit$`))
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Submit a tag to',
    )
  })

  test('the status menu filters the entries and keeps it in the address', async ({
    page,
  }) => {
    const status = page.getByRole('combobox', { name: /^Status:/ })
    await status.click()
    const registered = page.getByRole('option', { name: /^Registered/ })
    await expect(registered).toBeVisible()
    await registered.click()
    await expect(status).toHaveAccessibleName('Status: Registered')
    await expect(page).toHaveURL(/registered=true/)
    // A table on desktop, cards on a phone: either way the first entry.
    await expect(
      entries(page)
        .getByRole('link', { name: /^Open tag: / })
        .first(),
    ).toBeVisible()
    await expect(entries(page)).toContainText('Registered')
    await expect(entries(page)).not.toContainText('Submitted ·')
  })

  test('sort and layout change the view', async ({ page }) => {
    await page
      .getByRole('radiogroup', { name: 'Sort' })
      .getByRole('radio', { name: 'Oldest' })
      .click()
    await expect(page).toHaveURL(/oldestFirst=true/)

    await page
      .getByRole('radiogroup', { name: 'Layout' })
      .getByRole('radio', { name: 'Cards' })
      .click()
    await expect(entries(page).getByRole('table')).toHaveCount(0)
    await expect(entries(page).getByRole('link').first()).toBeVisible()
  })

  test('the sensitive-content switch flips', async ({ page }) => {
    const toggle = page.getByRole('switch', { name: 'Hide sensitive content' })
    await expect(toggle).not.toBeChecked()
    await toggle.click()
    await expect(toggle).toBeChecked()
  })

  test('the next page shows other entries', async ({ page }) => {
    const pager = page.getByRole('navigation', { name: 'Pagination' })
    await expect(
      pager.getByRole('button', { name: 'Previous page' }),
    ).toBeDisabled()
    // The first entry's name, as a table row or as a card.
    const first = entries(page)
      .getByRole('link', { name: /^Open tag: / })
      .first()
    const before = await first.getAttribute('aria-label')
    await pager.getByRole('button', { name: 'Next page' }).click()
    await expect(first).not.toHaveAttribute('aria-label', before ?? '')
    await expect(
      pager.getByRole('button', { name: 'Previous page' }),
    ).toBeEnabled()
  })

  test('an entry opens its page, and the breadcrumb leads back', async ({
    page,
  }) => {
    const open = entries(page)
      .getByRole('link', { name: /^Open tag: / })
      .first()
    const name = (await open.getAttribute('aria-label'))?.replace(
      'Open tag: ',
      '',
    )
    await open.click()
    await expect(page).toHaveURL(new RegExp(`${GNOSIS_LIST}/0x[0-9a-f]{64}$`))
    if (name)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
    await page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: 'Address Tags' })
      .click()
    await expect(page).toHaveURL(new RegExp(`${GNOSIS_LIST}$`))
  })

  test('the parameters name the governor and the arbitrator', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Parameters' }).click()
    await expect(page.getByText('Governor', { exact: true })).toBeVisible()
    await expect(page.getByText('Arbitrator', { exact: true })).toBeVisible()
  })
})

test.describe('Stake list', () => {
  test('says what is locked and counts listed entries', async ({ page }) => {
    await page.goto(STAKE_LIST)
    const header = page.getByRole('region', { name: 'Telegram Chads' })
    await expect(header).toContainText('Locked, not spent')
    await expect(header).toContainText(/Stake/)
    await expect(header).toContainText(/Listed/i)
  })
})
