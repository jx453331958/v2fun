import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Bypass passcode gate — tests run against static preview with no backend.
  await page.route('**/auth/passcode-status', (route) =>
    route.fulfill({ json: { verified: true } })
  )
  // No existing session — app renders as logged-out.
  await page.route('**/auth/session', (route) =>
    route.fulfill({ json: {} })
  )
})

test.describe('V2Fun App', () => {
  test('home page loads with header and tab bar', async ({ page }) => {
    await page.goto('/')
    // Header with logo
    await expect(page.locator('text=V2Fun')).toBeVisible()
    // Tab switcher
    await expect(page.locator('button:has-text("热门")')).toBeVisible()
    await expect(page.locator('button:has-text("最新")')).toBeVisible()
    // Bottom tab bar exists
    const tabBar = page.locator('nav')
    await expect(tabBar).toBeVisible()
  })

  test('tab switching between 热门 and 最新', async ({ page }) => {
    await page.goto('/')
    const hotTab = page.locator('button:has-text("热门")')
    const latestTab = page.locator('button:has-text("最新")')

    // Hot tab should be active by default
    await expect(hotTab).toBeVisible()

    // Switch to latest
    await latestTab.click()
    await expect(latestTab).toBeVisible()

    // Switch back to hot
    await hotTab.click()
    await expect(hotTab).toBeVisible()
  })

  test('bottom navigation has correct tabs', async ({ page }) => {
    await page.goto('/')
    const nav = page.locator('nav')
    // Should have 5 tab items (home, nodes, create, notifications, profile)
    const tabLinks = nav.locator('a, button')
    await expect(tabLinks).toHaveCount(5)
  })

  test('navigate to nodes page', async ({ page }) => {
    await page.goto('/nodes')
    // Heading — "节点" also appears in the bottom tab bar label.
    await expect(page.getByRole('heading', { name: '节点' })).toBeVisible()
    // Search input should be present
    const searchInput = page.locator('input[placeholder="搜索节点..."]')
    await expect(searchInput).toBeVisible()
  })

  test('navigate to login page', async ({ page }) => {
    await page.goto('/login')
    // Heading — "登录 V2EX" also appears in the help list text below.
    await expect(page.getByRole('heading', { name: '登录 V2EX' })).toBeVisible()
    // Cookie label (auth migrated from PAT to cookie in 25e0705)
    await expect(page.locator('label:has-text("Cookie")')).toBeVisible()
    // Cookie textarea
    const cookieInput = page.locator('textarea[placeholder*="Cookie"]')
    await expect(cookieInput).toBeVisible()
    // Login button should be disabled without input
    const loginBtn = page.locator('button:has-text("登录")').last()
    await expect(loginBtn).toBeDisabled()
  })

  test('login page - button enables with cookie input', async ({ page }) => {
    await page.goto('/login')
    const cookieInput = page.locator('textarea[placeholder*="Cookie"]')
    await cookieInput.fill('test_cookie=value; other=thing')
    const loginBtn = page.locator('button:has-text("登录")').last()
    await expect(loginBtn).toBeEnabled()
  })

  test('page title is correct', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('V2Fun - V2EX Client')
  })

  test('theme-color meta tag is dark', async ({ page }) => {
    await page.goto('/')
    const themeColor = page.locator('meta[name="theme-color"]')
    await expect(themeColor).toHaveAttribute('content', '#0B0B10')
  })

  test('viewport is configured for mobile', async ({ page }) => {
    await page.goto('/')
    const viewport = page.locator('meta[name="viewport"]')
    const content = await viewport.getAttribute('content')
    expect(content).toContain('viewport-fit=cover')
    expect(content).toContain('width=device-width')
  })

  test('bottom tab navigation to nodes page', async ({ page }) => {
    await page.goto('/')
    // Click nodes tab (second button in nav — tabs are buttons, not anchors)
    const nav = page.locator('nav')
    const tabs = nav.locator('button')
    await tabs.nth(1).click()
    await expect(page).toHaveURL(/\/nodes/)
    await expect(page.getByRole('heading', { name: '节点' })).toBeVisible()
  })
})
