import { GNOSIS_ENTRY, GNOSIS_LIST, STAKE_ENTRY } from './routes'
import { expect, test } from './support/test'

/* Entry pages: what an entry is, who sent it, and what a reader can do. */

test.describe('Standard entry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GNOSIS_ENTRY)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('the facts name the submitter and the item, and the details are listed', async ({
    page,
  }) => {
    const overview = page.getByRole('region', { name: /overview$/ })
    await expect(overview.getByText('By', { exact: true })).toBeVisible()
    // A person opens their Curate profile, not the explorer.
    await expect(
      overview
        .getByRole('link', { name: /^0x[0-9a-fA-F]{4}…[0-9a-fA-F]{4}$/ })
        .first(),
    ).toHaveAttribute('href', /^\/address\/0x[0-9a-f]{40}$/)
    await expect(
      overview.getByRole('button', { name: /, copy item ID$/ }),
    ).toBeVisible()
    await expect(
      overview.getByRole('heading', { level: 2, name: 'Full details' }),
    ).toBeVisible()
  })

  test('the item ID is copied on a click, and the page says so', async ({
    page,
    context,
    isMobile,
  }) => {
    test.skip(isMobile, 'clipboard permissions are desktop Chrome’s')
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const copy = page.getByRole('button', { name: /, copy item ID$/ })
    await copy.click()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toMatch(/^0x[0-9a-f]{64}$/)
    expect(GNOSIS_ENTRY.endsWith(copied)).toBe(true)
  })

  test('the history lists each request and folds', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 2, name: 'History' }),
    ).toBeVisible()
    const request = page.getByRole('button', { name: /^1st request/ }).first()
    await expect(request).toHaveAttribute('aria-expanded', 'true')
    await request.click()
    await expect(request).toHaveAttribute('aria-expanded', 'false')
  })

  test('the evidence form asks for a title before anything is sent', async ({
    page,
  }) => {
    const form = page.getByRole('region', { name: 'Add evidence' })
    await expect(form.getByRole('textbox', { name: 'Title' })).toBeVisible()
    await expect(
      form.getByRole('textbox', { name: 'Description' }),
    ).toBeVisible()
  })
})

test('an entry in its challenge window offers the bounty and a challenge', async ({
  page,
}) => {
  // Whichever entry the list shows first among those open to challenge,
  // so a new recording finds one too.
  await page.goto(`${GNOSIS_LIST}?submitted=true&oldestFirst=true`)
  await page
    .getByRole('region', { name: 'Tags', exact: true })
    .getByRole('link', { name: /^Open tag: / })
    .first()
    .click()
  const action = page.getByRole('region', { name: 'What you can do' })
  await expect(action).toContainText(/Earn\s*[\d.,]+\s*xDAI/)
  await expect(action).toContainText('if jurors agree, you get')
  await expect(
    action.getByRole('button', { name: /^Challenge (submission|removal) · / }),
  ).toBeVisible()
})

test('a Stake entry says what can be done and that a wallet is needed', async ({
  page,
}) => {
  await page.goto(STAKE_ENTRY)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const action = page.getByRole('region', { name: 'What you can do' })
  await expect(action.getByRole('status')).toContainText(/Connect a wallet/)
  await expect(action.getByRole('button', { name: 'Connect' })).toBeVisible()
})
