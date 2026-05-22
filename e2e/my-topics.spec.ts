import { test, expect } from '@playwright/test'

const MOCK_MEMBER = {
  id: 1, username: 'testuser', url: '', website: '', twitter: '', psn: '',
  github: '', btc: '', location: '', tagline: 'Test tagline', bio: '',
  avatar_mini: '', avatar_normal: '', avatar_large: '', avatar: '',
  created: 1000000,
}

test.describe('My Topics feature', () => {
  test('/my-topics when not logged in redirects to /login', async ({ page }) => {
    await page.route('**/auth/passcode-status', (route) =>
      route.fulfill({ json: { verified: true } })
    )
    await page.route('**/auth/session', (route) =>
      route.fulfill({ json: {} })
    )

    await page.goto('/my-topics')
    await page.waitForURL(/\/login/)
    await expect(page.getByRole('heading', { name: '登录 V2EX' })).toBeVisible()
  })

  test('desktop sidebar shows 我的主题 nav item when logged in', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })

    await page.route('**/auth/passcode-status', (route) =>
      route.fulfill({ json: { verified: true } })
    )
    await page.route('**/auth/session', (route) =>
      route.fulfill({ json: { member: MOCK_MEMBER } })
    )

    await page.goto('/')

    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()
    await expect(sidebar.locator('button:has-text("我的主题")')).toBeVisible()
  })

  test('desktop 我的主题 nav item navigates to /my-topics', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })

    await page.route('**/auth/passcode-status', (route) =>
      route.fulfill({ json: { verified: true } })
    )
    await page.route('**/auth/session', (route) =>
      route.fulfill({ json: { member: MOCK_MEMBER } })
    )
    await page.route('**/api/members/show.json*', (route) =>
      route.fulfill({ json: MOCK_MEMBER })
    )
    await page.route('**/web/member/testuser/topics*', (route) =>
      route.fulfill({ json: { success: true, result: [], totalPages: 1 } })
    )

    await page.goto('/')
    await page.click('aside button:has-text("我的主题")')
    await expect(page).toHaveURL(/\/my-topics/)
  })

  test('desktop sidebar 我的主题 is hidden when logged out', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })

    await page.route('**/auth/passcode-status', (route) =>
      route.fulfill({ json: { verified: true } })
    )
    await page.route('**/auth/session', (route) =>
      route.fulfill({ json: {} })
    )

    await page.goto('/')
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()
    await expect(sidebar.locator('button:has-text("我的主题")')).not.toBeVisible()
  })
})
