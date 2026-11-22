import { expect, test } from './support/test'

/* Launching a list: the choice of kind, then each wizard's first steps. */

test.describe('launch page', () => {
  test('the chain links switch the page between chains', async ({ page }) => {
    await page.goto('/launch/100')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Launch a list on Gnosis',
    )
    await page
      .getByRole('navigation', { name: 'Deploy on' })
      .getByRole('link', { name: 'Ethereum' })
      .click()
    await expect(page).toHaveURL(/\/launch\/1$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Launch a list on Ethereum',
    )
  })

  for (const [kind, path, title] of [
    ['Standard', '/factory/100', 'Create a Standard list'],
    ['Stake', '/factory-permanent/100', 'Create a Stake list'],
  ] as const)
    test(`choosing ${kind} leads to its wizard`, async ({ page }) => {
      await page.goto('/launch/100')
      // The radio is drawn under its card's pill, which takes the click.
      await page
        .getByRole('radio', { name: `Choose ${kind} list` })
        .check({ force: true })
      await page.getByRole('link', { name: `Create a ${kind} list` }).click()
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    })
})

test.describe('list wizard', () => {
  test('the name is required, shows in the preview, and the draft is kept', async ({
    page,
  }) => {
    await page.goto('/factory/100')
    const name = page.getByRole('textbox', { name: 'Name' })
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(
      page.getByText(/required|name the list/i).first(),
    ).toBeVisible()

    await name.fill('E2E socks')
    const preview = page.getByRole('complementary', { name: 'Preview' })
    await expect(preview).toContainText('E2E socks')

    // The draft is saved a second after typing stops.
    await expect
      .poll(() =>
        page.evaluate(() =>
          Object.keys(localStorage).some(
            (key) =>
              key.startsWith('tcrState@') &&
              !!localStorage.getItem(key)?.includes('E2E socks'),
          ),
        ),
      )
      .toBe(true)
    await page.reload()
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue(
      'E2E socks',
    )

    await page.getByRole('button', { name: 'Next' }).click()
    await expect(
      page.getByRole('textbox', { name: 'Description' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Previous' }).click()
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue(
      'E2E socks',
    )
  })

  test('the preview shows what each side sends, and the court', async ({
    page,
  }) => {
    await page.goto('/factory/100')
    const preview = page.getByRole('complementary', { name: 'Preview' })
    const sends = (who: string) =>
      preview.getByRole('img', {
        name: new RegExp(`^${who} sends [\\d.]+ xDAI: `),
      })
    await expect(sends('Submitter')).toBeVisible()
    await expect(sends('Challenger')).toBeVisible()
    await preview.getByRole('radio', { name: 'Removal' }).click()
    await expect(sends('Removal requester')).toBeVisible()
    await expect(preview).toContainText('Kleros court')
  })

  test('the kind switch moves between the two wizards', async ({ page }) => {
    await page.goto('/factory/100')
    // A link to the other wizard more than a choice: it navigates.
    await page
      .getByRole('radiogroup', { name: 'List type' })
      .getByRole('radio', { name: 'Stake' })
      .click()
    await expect(page).toHaveURL(/\/factory-permanent\/100$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Create a Stake list',
    )
  })
})
