import { ROUTES } from './routes'
import { expect, overflowsSideways, test } from './support/test'

/*
 * Every page opens, says what it is, settles without an error, and fits
 * the screen: at 1440px and on a phone (the two projects).
 */
for (const route of ROUTES)
  test(`${route.name} opens and fits the screen`, async ({ page }) => {
    await page.goto(route.path)
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible()
    await expect(heading).not.toHaveText('')
    await page.waitForLoadState('networkidle')
    expect(await overflowsSideways(page), 'the page scrolls sideways').toBe(
      false,
    )
  })
