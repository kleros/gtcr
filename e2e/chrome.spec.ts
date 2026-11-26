import { LIST_OF_LISTS, RETIRED_CLASSIC_LIST } from './routes'
import { expect, test } from './support/test'

/*
 * The app's frame: navigation, the theme, the skip link, and the pages a
 * wrong address leads to.
 */

test.describe('navigation', () => {
  test('the main navigation leads to each section', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'phones navigate from the menu (next test)')
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Main' })
    await nav.getByRole('link', { name: 'Browse' }).click()
    await expect(page).toHaveURL(/\/browse$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lists')

    await nav.getByRole('link', { name: 'Launch a list' }).click()
    await expect(page).toHaveURL(/\/launch\/\d+$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Launch a list on',
    )

    await page.getByRole('link', { name: 'Kleros Curate, dashboard' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'or earn by keeping lists clean',
    )
  })

  test('phones navigate from the menu', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the menu replaces the navigation on phones')
    await page.goto('/')
    await page.getByRole('button', { name: 'Open menu' }).click()
    // The menu's entries are links; the desktop navigation is hidden.
    await page
      .getByRole('link', { name: 'Browse', exact: true })
      .filter({ visible: true })
      .click()
    await expect(page).toHaveURL(/\/browse$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lists')
  })

  test('the skip link moves focus to the page content', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'a keyboard feature')
    await page.goto('/browse')
    // The page's own content first: the route is loaded on demand, and a
    // main that mounts after the jump takes the focus with it.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lists')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to content' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#main')).toBeFocused()
  })
})

test.describe('theme', () => {
  test('a chosen theme applies at once and is kept', async ({ page }) => {
    await page.goto('/browse')
    const menu = page.getByRole('combobox', { name: /^Theme:/ })
    await menu.click()
    await page.getByRole('option', { name: /^Light/ }).click()
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'light')
    await expect(menu).toHaveAccessibleName('Theme: Light')

    await page.reload()
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'light')

    await page.getByRole('combobox', { name: /^Theme:/ }).click()
    await page.getByRole('option', { name: /^Kleros/ }).click()
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'kleros')
  })

  test('System follows the device', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'light')
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'dark')
  })

  test('?cv-theme previews a theme without keeping it', async ({ page }) => {
    await page.goto('/?cv-theme=kleros')
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'kleros')
    // Leave the page once it has started up: leaving it mid-start aborts
    // the wallet kit's own requests, and the Coinbase SDK logs the aborted
    // Cross-Origin-Opener-Policy check as an error.
    await page.waitForLoadState('networkidle')
    await page.goto('/')
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'dark')
  })
})

test.describe('wrong addresses', () => {
  test('a missing page says so and leads home', async ({ page }) => {
    await page.goto('/no-such-page')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeVisible()
    await expect(page.getByText('/no-such-page')).toBeVisible()
    await page.getByRole('link', { name: 'Go to the dashboard' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('a retired Classic list points to the current list of lists', async ({
    page,
  }) => {
    await page.goto(RETIRED_CLASSIC_LIST)
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Classic lists are retired',
      }),
    ).toBeVisible()
    await page
      .getByRole('link', { name: 'Go to the current list of lists' })
      .click()
    await expect(page).toHaveURL(new RegExp(`${LIST_OF_LISTS}$`))
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})
