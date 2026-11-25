import { GNOSIS_LIST } from './routes'
import { expect, test } from './support/test'

/* Submitting an entry: the form follows the list's fields and checks them. */

test.beforeEach(async ({ page }) => {
  await page.goto(`${GNOSIS_LIST}/submit`)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Submit a tag to',
  )
})

test('the form has the list’s fields and counts the required ones', async ({
  page,
}) => {
  for (const field of [
    'Contract Address',
    'Public Name Tag',
    'Project Name',
    'UI/Website Link',
    'Public Note',
  ])
    await expect(page.getByRole('textbox', { name: field })).toBeVisible()
  const progress = page.getByRole('progressbar', {
    name: 'Required fields filled',
  })
  await expect(progress).toContainText('0 of 5 required')
  await page.getByRole('textbox', { name: 'Public Name Tag' }).fill('Test tag')
  await expect(progress).toContainText('1 of 5 required')
})

test('the preview reads what is typed', async ({ page }) => {
  await page
    .getByRole('textbox', { name: 'Public Name Tag' })
    .fill('Curate e2e tag')
  await expect(
    page.getByText('Curate e2e tag', { exact: true }).first(),
  ).toBeVisible()
})

test('a malformed address is refused at the field', async ({ page }) => {
  const address = page.getByRole('textbox', { name: 'Contract Address' })
  await address.fill('0x1234')
  await address.blur()
  // The field's own message, tied to it. The column hints show at all times
  // and mention a "format", so a looser pattern passed with no check at all.
  await expect(
    page.getByText('Enter a valid address for the selected chain.', {
      exact: true,
    }),
  ).toBeVisible()
  await expect(address).toHaveAttribute('aria-invalid', 'true')
  await expect(address).toHaveAccessibleDescription(
    /^Enter a valid address for the selected chain\./,
  )
})

test('the cost is shown in full before anything is signed', async ({
  page,
}) => {
  const next = page.getByRole('group', { name: 'What happens next' })
  await expect(next).toContainText(/You send now/)
  await expect(next).toContainText('Base deposit')
  await expect(next).toContainText('Arbitration cost')
})
