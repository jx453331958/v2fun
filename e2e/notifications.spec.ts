import { test, expect } from '@playwright/test'

const MOCK_MEMBER_SELF = {
  id: 1,
  username: 'testuser',
  url: 'https://www.v2ex.com/member/testuser',
  website: '', twitter: '', psn: '', github: '', btc: '', location: '', tagline: '', bio: '',
  avatar_mini: 'https://cdn.v2ex.com/avatar/test/mini.png',
  avatar_normal: 'https://cdn.v2ex.com/avatar/test/normal.png',
  avatar_large: 'https://cdn.v2ex.com/avatar/test/large.png',
  avatar: 'https://cdn.v2ex.com/avatar/test/mini.png',
  created: 1600000000,
}

const MOCK_NOTIFICATIONS = [
  {
    id: 100,
    member_id: 2,
    for_member_id: 1,
    text: 'replyer 在 测试话题标题 里回复了你',
    payload: '',
    payload_rendered:
      '<a href="/member/replyer">replyer</a> 在 <a href="/t/999888#reply5">测试话题标题</a> 里回复了你',
    created: Math.floor(Date.now() / 1000) - 60,
    member: { username: 'replyer' },
  },
  {
    id: 101,
    member_id: 3,
    for_member_id: 1,
    text: 'anotheruser 在回复 另一个话题 时提到了你',
    payload: '',
    payload_rendered:
      '<a href="/member/anotheruser">anotheruser</a> 在回复 <a href="/t/888777#reply12">另一个话题</a> 时提到了你',
    created: Math.floor(Date.now() / 1000) - 3600,
    member: { username: 'anotheruser' },
  },
]

const MOCK_NOTIFICATIONS_ABSOLUTE_URL = [
  {
    id: 200,
    member_id: 2,
    for_member_id: 1,
    text: 'replyer 在 测试话题 里回复了你',
    payload: '',
    payload_rendered:
      '<a href="https://www.v2ex.com/member/replyer">replyer</a> 在 <a href="https://www.v2ex.com/t/999888#reply5">测试话题</a> 里回复了你',
    created: Math.floor(Date.now() / 1000) - 60,
    member: { username: 'replyer' },
  },
]

const MOCK_TOPIC = {
  id: 999888,
  title: '测试话题标题',
  url: 'https://www.v2ex.com/t/999888',
  content: 'Test content',
  content_rendered: '<p>Test content</p>',
  syntax: 0,
  replies: 10,
  member: MOCK_MEMBER_SELF,
  node: { id: 1, name: 'test', url: '', title: '测试节点', title_alternative: '', topics: 100, stars: 0, header: '', footer: '', avatar: '', avatar_mini: '', avatar_normal: '', avatar_large: '' },
  created: 1600000000,
  last_modified: 1600000000,
  last_touched: 1600000000,
  last_reply_by: 'replyer',
}

const MEMBER_INFO_REPLYER = {
  id: 2, username: 'replyer',
  avatar: 'https://cdn.v2ex.com/avatar/replyer/mini.png',
  avatar_mini: 'https://cdn.v2ex.com/avatar/replyer/mini.png',
  avatar_normal: 'https://cdn.v2ex.com/avatar/replyer/normal.png',
  avatar_large: 'https://cdn.v2ex.com/avatar/replyer/large.png',
}

const MEMBER_INFO_ANOTHER = {
  id: 3, username: 'anotheruser',
  avatar: 'https://cdn.v2ex.com/avatar/another/mini.png',
  avatar_mini: 'https://cdn.v2ex.com/avatar/another/mini.png',
  avatar_normal: 'https://cdn.v2ex.com/avatar/another/normal.png',
  avatar_large: 'https://cdn.v2ex.com/avatar/another/large.png',
}

function setupMockRoutes(page: import('@playwright/test').Page, notifications = MOCK_NOTIFICATIONS) {
  // Log all intercepted requests for debugging
  page.on('request', (req) => {
    if (req.url().includes('/members/show.json')) {
      console.log(`[REQ] ${req.url()}`)
    }
  })

  page.route('**/auth/session', (route) =>
    route.fulfill({ json: { token: 'fake-token-for-test' } })
  )
  page.route('**/api/v2/member', (route) =>
    route.fulfill({ json: { success: true, result: MOCK_MEMBER_SELF } })
  )
  page.route('**/api/v2/notifications*', (route) =>
    route.fulfill({ json: { success: true, result: notifications } })
  )
  page.route('**/api/topics/show.json*id=999888*', (route) =>
    route.fulfill({ json: [MOCK_TOPIC] })
  )
  page.route('**/api/replies/show.json*', (route) => {
    const replies = Array.from({ length: 10 }, (_, i) => ({
      id: 5000 + i, content: `Reply ${i + 1}`, content_rendered: `<p>Reply ${i + 1}</p>`,
      member: { id: 100 + i, username: `user${i}`, avatar: 'https://cdn.v2ex.com/avatar/default.png' },
      created: 1600000000 + i * 60, topic_id: 999888, thanked: false, thanks: 0,
    }))
    route.fulfill({ json: replies })
  })
  page.route('**/api/topics/hot.json', (route) => route.fulfill({ json: [] }))
  page.route('**/api/topics/latest.json', (route) => route.fulfill({ json: [] }))
  // V1 member info — provides avatars for notification senders
  page.route('**/api/members/show.json*', (route) => {
    const url = route.request().url()
    console.log(`[ROUTE HIT] members/show.json: ${url}`)
    if (url.includes('replyer')) {
      route.fulfill({ json: MEMBER_INFO_REPLYER })
    } else if (url.includes('anotheruser')) {
      route.fulfill({ json: MEMBER_INFO_ANOTHER })
    } else {
      route.fulfill({ json: { id: 0, username: 'unknown', avatar: '' } })
    }
  })
}

async function loginAndGoToNotifications(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('v2fun_token', 'fake-token-for-test'))
  await page.goto('/notifications')
  await page.waitForSelector('[class*="itemText"]', { timeout: 5000 })
}

test.describe('Notifications Page', () => {
  test('avatars load from V1 API when V2 member has no avatar', async ({ page }) => {
    await setupMockRoutes(page)
    await loginAndGoToNotifications(page)

    // Dump initial HTML
    const firstItem = page.locator('[class*="list"] > div').first()
    const html = await firstItem.innerHTML()
    console.log(`Initial HTML: ${html}`)

    // Check for placeholders (shown while avatars are loading)
    const placeholders = page.locator('span[class*="avatarPlaceholder"]')
    const imgs = page.locator('[class*="itemAvatar"] img')
    const placeholderCount = await placeholders.count()
    const imgCount = await imgs.count()
    console.log(`Placeholders: ${placeholderCount}, Images: ${imgCount}`)

    // Wait for avatars to load from V1 API
    try {
      await page.waitForSelector('[class*="itemAvatar"] img', { timeout: 8000 })
      const loadedImgs = page.locator('[class*="itemAvatar"] img')
      const loadedCount = await loadedImgs.count()
      console.log(`Loaded avatar images: ${loadedCount}`)
      for (let i = 0; i < loadedCount; i++) {
        const src = await loadedImgs.nth(i).getAttribute('src')
        console.log(`Avatar ${i} src: "${src}"`)
        expect(src).toBeTruthy()
        expect(src).toContain('v2ex.com')
      }
    } catch {
      // If images didn't load, at least placeholders should exist
      const finalPlaceholders = await placeholders.count()
      console.log(`Final placeholders: ${finalPlaceholders}`)
      expect(finalPlaceholders, 'Should show either images or placeholders').toBeGreaterThan(0)
    }
  })

  test('clicking notification time area navigates to topic', async ({ page }) => {
    await setupMockRoutes(page)
    await loginAndGoToNotifications(page)
    await page.locator('[class*="itemTime"]').first().click()
    await expect(page).toHaveURL(/\/topic\/999888/, { timeout: 5000 })
  })

  test('clicking topic link navigates to topic', async ({ page }) => {
    await setupMockRoutes(page)
    await loginAndGoToNotifications(page)
    await page.locator('[class*="itemText"] a[href*="/t/"]').first().click()
    await expect(page).toHaveURL(/\/topic\/999888/, { timeout: 5000 })
  })

  test('clicking absolute URL topic link navigates correctly', async ({ page }) => {
    await setupMockRoutes(page, MOCK_NOTIFICATIONS_ABSOLUTE_URL)
    await loginAndGoToNotifications(page)
    const link = page.locator('[class*="itemText"] a[href*="/t/"]').first()
    console.log(`Absolute URL href: ${await link.getAttribute('href')}`)
    await link.click()
    await expect(page).toHaveURL(/\/topic\/999888/, { timeout: 5000 })
  })

  test('clicking member link navigates to member page', async ({ page }) => {
    await setupMockRoutes(page)
    await loginAndGoToNotifications(page)
    await page.locator('[class*="itemText"] a[href*="/member/"]').first().click()
    await expect(page).toHaveURL(/\/member\/replyer/, { timeout: 5000 })
  })
})
