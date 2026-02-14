import { test, expect } from '@playwright/test'

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
    await expect(page.locator('text=节点')).toBeVisible()
    // Search input should be present
    const searchInput = page.locator('input[placeholder="搜索节点..."]')
    await expect(searchInput).toBeVisible()
  })

  test('navigate to login page', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('text=登录 V2EX')).toBeVisible()
    await expect(page.locator('text=Personal Access Token')).toBeVisible()
    // Token input
    const tokenInput = page.locator('textarea[placeholder*="Token"]')
    await expect(tokenInput).toBeVisible()
    // Login button should be disabled without token
    const loginBtn = page.locator('button:has-text("登录")').last()
    await expect(loginBtn).toBeDisabled()
  })

  test('login page - button enables with token input', async ({ page }) => {
    await page.goto('/login')
    const tokenInput = page.locator('textarea[placeholder*="Token"]')
    await tokenInput.fill('test-token-value')
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
    // Click nodes tab (second tab in nav)
    const nav = page.locator('nav')
    const tabs = nav.locator('a')
    // Navigate to nodes (second link)
    await tabs.nth(1).click()
    await expect(page).toHaveURL(/\/nodes/)
    await expect(page.getByRole('heading', { name: '节点' })).toBeVisible()
  })
})
