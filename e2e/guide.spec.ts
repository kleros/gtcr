import { expect, test } from './support/test'

/*
 * The guide offers the agent skill before any scrolling, lists it second in
 * its contents, right after the lifecycle, and copies the prompt it shows.
 */

test.describe('guide', () => {
  test('offers the agent skill before any scrolling', async ({ page }) => {
    await page.goto('/guide')
    await expect(
      page.getByText('Give your agent the Kleros Curate skill'),
    ).toBeInViewport()

    await page.getByRole('link', { name: 'Get the skill' }).click()
    await expect(page).toHaveURL(/\/guide#agents$/)
    const section = page.locator('#agents')
    await expect(section).toBeFocused()
    await expect(
      section.getByRole('heading', { level: 2, name: 'Same rules for agents' }),
    ).toBeInViewport()
  })

  test('lists the skill second in its contents', async ({ page }) => {
    await page.goto('/guide')
    const entries = page
      .getByRole('navigation', { name: 'On this page' })
      .getByRole('link')
    await expect(entries.nth(0)).toContainText('The lifecycle')
    await expect(entries.nth(1)).toContainText('Agents and skills')
  })

  test('copies the prompt it shows', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/guide#agents')
    const section = page.locator('#agents')
    const prompt = (await section.locator('code').textContent()) ?? ''
    expect(prompt).toContain('https://curate.kleros.io/llms-full.txt')

    await section.getByRole('button', { name: 'Copy prompt' }).click()
    await expect(section.getByRole('button', { name: 'Copied' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      prompt,
    )
  })
})
