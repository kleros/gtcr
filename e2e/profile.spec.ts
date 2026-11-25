import { CURATOR } from './routes'
import { expect, test } from './support/test'

/* Curator profiles: a governor's lists, and an active curator's record. */

test('a governor’s profile lists the lists it governs', async ({ page }) => {
  await page.goto(CURATOR)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(
    page.getByText('Governor', { exact: true }).first(),
  ).toBeVisible()
  await expect(page.getByText(/^Governed lists/).first()).toBeVisible()
  const governed = page.getByRole('link', { name: /Address Tags/ }).first()
  await expect(governed).toBeVisible()
})

test('an active curator’s profile has their activity, searchable', async ({
  page,
}) => {
  // The most active curator of the dashboard's chart range.
  await page.goto('/')
  await page
    .getByRole('region', { name: 'Top curators' })
    .getByRole('link')
    .first()
    .click()
  await expect(page).toHaveURL(/\/address\/0x[0-9a-f]{40}$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  const search = page
    .getByRole('searchbox')
    .or(page.getByRole('textbox', { name: /Search/ }))
    .first()
  await expect(search).toBeVisible()
  await search.fill('zzzz-no-such-entry')
  await expect(page).toHaveURL(/q=zzzz-no-such-entry/)
  // The field's own clear button, and the empty state's.
  const clear = page.getByRole('button', { name: 'Clear search' })
  await expect(clear).toHaveCount(2)
  await clear.last().click()
  await expect(page).not.toHaveURL(/q=/)
})
