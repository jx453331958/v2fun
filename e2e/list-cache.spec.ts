import { test, expect } from '@playwright/test'

function generateTopics(page: number, count = 20) {
  return Array.from({ length: count }, (_, i) => ({
    id: (page - 1) * 20 + i + 1,
    title: `Page ${page} Topic ${i + 1}`,
    url: `https://www.v2ex.com/t/${(page - 1) * 20 + i + 1}`,
    content: '',
    content_rendered: '',
    syntax: 0,
    replies: Math.floor(Math.random() * 50),
    member: {
      id: 100 + i,
      username: `user${i}`,
      avatar: 'https://cdn.v2ex.com/avatar/default.png',
      avatar_mini: 'https://cdn.v2ex.com/avatar/default.png',
      avatar_normal: 'https://cdn.v2ex.com/avatar/default.png',
      avatar_large: 'https://cdn.v2ex.com/avatar/default.png',
    },
    node: {
      id: 1, name: 'test', url: '', title: '测试', title_alternative: '',
      topics: 100, stars: 0, header: '', footer: '',
      avatar: '', avatar_mini: '', avatar_normal: '', avatar_large: '',
    },
    created: 1600000000 - i * 60,
    last_modified: 1600000000,
    last_touched: 1600000000,
    last_reply_by: 'someone',
  }))
}

function setupMockRoutes(page: import('@playwright/test').Page) {
  // Bypass passcode gate
  page.route('**/auth/passcode-status', (route) =>
    route.fulfill({ json: { verified: true } })
  )

  // Home page: latest topics (web scraping endpoint)
  page.route('**/web/latest*', (route) => {
    const url = new URL(route.request().url())
    const p = parseInt(url.searchParams.get('p') || '1')
    route.fulfill({
      json: {
        success: true,
        result: generateTopics(p),
        totalPages: 5,
      },
    })
  })

  // Home page: hot topics (web scraping endpoint)
  page.route('**/web/hot*', (route) =>
    route.fulfill({ json: { success: true, result: generateTopics(1, 10), totalPages: 1 } })
  )

  // Topic detail: v1 API
  page.route('**/api/topics/show.json*', (route) => {
    const url = route.request().url()
    const idMatch = url.match(/id=(\d+)/)
    const id = idMatch ? parseInt(idMatch[1]) : 1
    route.fulfill({
      json: [{
        id,
        title: `Topic ${id}`,
        url: `https://www.v2ex.com/t/${id}`,
        content: 'Topic content',
        content_rendered: '<p>Topic content</p>',
        syntax: 0,
        replies: 5,
        member: {
          id: 100, username: 'testuser',
          avatar: 'https://cdn.v2ex.com/avatar/default.png',
          avatar_mini: 'https://cdn.v2ex.com/avatar/default.png',
          avatar_normal: 'https://cdn.v2ex.com/avatar/default.png',
          avatar_large: 'https://cdn.v2ex.com/avatar/default.png',
        },
        node: {
          id: 1, name: 'test', url: '', title: '测试', title_alternative: '',
          topics: 100, stars: 0, header: '', footer: '',
          avatar: '', avatar_mini: '', avatar_normal: '', avatar_large: '',
        },
        created: 1600000000,
        last_modified: 1600000000,
        last_touched: 1600000000,
        last_reply_by: 'someone',
      }],
    })
  })

  // Topic replies (web scraping endpoint)
  page.route('**/web/replies/*', (route) =>
    route.fulfill({
      json: {
        success: true,
        result: Array.from({ length: 5 }, (_, i) => ({
          id: 5000 + i,
          content: `Reply ${i + 1}`,
          content_rendered: `<p>Reply ${i + 1}</p>`,
          member: {
            id: 200 + i, username: `replier${i}`,
            avatar: 'https://cdn.v2ex.com/avatar/default.png',
          },
          created: 1600000000 + i * 60,
          topic_id: 1,
          thanked: false,
          thanks: 0,
        })),
        totalPages: 1,
      },
    })
  )

  // Nodes page
  page.route('**/api/nodes/all.json', (route) =>
    route.fulfill({
      json: [
        { id: 1, name: 'test', url: '', title: '测试', title_alternative: '', topics: 100, stars: 0, header: '', footer: '', avatar: '', avatar_mini: '', avatar_normal: '', avatar_large: '' },
      ],
    })
  )
}

test.describe('List State Preservation', () => {
  test('Home page preserves state on back navigation', async ({ page }) => {
    await setupMockRoutes(page)
    await page.goto('/')

    // Wait for initial load (default tab is "最新")
    await page.waitForSelector('text="Page 1 Topic 1"', { timeout: 10000 })

    // Navigate to page 2
    const nextButton = page.locator('button[aria-label="下一页"]')
    await nextButton.click()
    await page.waitForSelector('text="Page 2 Topic 1"', { timeout: 10000 })

    // Verify we're on page 2
    await expect(page.locator('text="Page 2 Topic 1"')).toBeVisible()

    // Click into a topic
    await page.locator('text="Page 2 Topic 1"').click()
    await page.waitForURL(/\/topic\//, { timeout: 5000 })

    // Go back
    await page.goBack()
    await page.waitForURL('/', { timeout: 5000 })

    // Verify page 2 topics are still displayed (not page 1)
    await expect(page.locator('text="Page 2 Topic 1"')).toBeVisible({ timeout: 5000 })
    // Page 1 topics should NOT be visible
    await expect(page.locator('text="Page 1 Topic 1"')).not.toBeVisible()
  })

  test('Home page loads fresh on forward navigation', async ({ page }) => {
    await setupMockRoutes(page)
    await page.goto('/')

    // Wait for initial load
    await page.waitForSelector('text="Page 1 Topic 1"', { timeout: 10000 })

    // Page 1 topics should be visible on fresh navigation
    await expect(page.locator('text="Page 1 Topic 1"')).toBeVisible()
  })

  test('Home page tab state is preserved on back navigation', async ({ page }) => {
    await setupMockRoutes(page)
    await page.goto('/')

    // Wait for initial load
    await page.waitForSelector('text="Page 1 Topic 1"', { timeout: 10000 })

    // Switch to hot tab
    await page.locator('button:has-text("热门")').click()
    await page.waitForTimeout(500)

    // Navigate to nodes via bottom tab bar (second button in nav)
    const nav = page.locator('nav')
    await nav.locator('button:has-text("节点")').click()
    await page.waitForURL(/\/nodes/, { timeout: 5000 })

    // Go back
    await page.goBack()
    await page.waitForURL('/', { timeout: 5000 })

    // Hot tab should still be active
    const hotTab = page.locator('button:has-text("热门")')
    await expect(hotTab).toHaveClass(/active/, { timeout: 5000 })
  })
})
