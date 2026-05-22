# 我的主题导航入口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "我的主题" entry to the desktop sidebar that shows the current user's topic list, and highlight it (instead of "首页") after a successful topic publish.

**Architecture:** A new `/my-topics` route renders `MemberPage` with the logged-in user's username injected as a prop (instead of reading from URL params). `getActiveTab` is extended to read `location.state.activeTab`, which `CreateTopic` sets after a successful publish so the sidebar highlights "我的主题" while viewing the new topic's detail page.

**Tech Stack:** React 19, React Router v6, TypeScript, Playwright E2E

---

## File Map

| File | Change |
|------|--------|
| `src/pages/MemberPage.tsx` | Add optional `username` prop; fall back to `useParams` when absent |
| `src/pages/MyTopics.tsx` | **New** — wraps MemberPage with current user's username; redirects to `/login` if not logged in |
| `src/App.tsx` | Register `/my-topics` route |
| `src/components/Layout.tsx` | Extend `getActiveTab` with state param; add `my-topics` ICON; add conditional nav item |
| `src/pages/CreateTopic.tsx` | Pass `{ activeTab: 'my-topics' }` in navigate state after publish |
| `e2e/my-topics.spec.ts` | **New** — E2E tests for the feature |

---

### Task 1: Extend MemberPage to accept an optional `username` prop

**Files:**
- Modify: `src/pages/MemberPage.tsx:23-26`

- [ ] **Step 1: Add props interface and update function signature**

  Replace the opening lines of the component (the `export default function` line) and add a prop type. The component currently reads username exclusively from `useParams`. After this change it accepts an optional prop and falls back to the URL param.

  Current code at lines 23–26:
  ```tsx
  export default function MemberPage() {
    const { username } = useParams<{ username: string }>()
    const cacheKey = `/member/${username}`
  ```

  New code:
  ```tsx
  interface MemberPageProps {
    username?: string
  }

  export default function MemberPage({ username: usernameProp }: MemberPageProps = {}) {
    const { username: paramUsername } = useParams<{ username: string }>()
    const username = usernameProp ?? paramUsername
    const cacheKey = `/member/${username}`
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/pages/MemberPage.tsx
  git commit -m "refactor(MemberPage): accept optional username prop, fall back to useParams"
  ```

---

### Task 2: Create the MyTopics page

**Files:**
- Create: `src/pages/MyTopics.tsx`

- [ ] **Step 1: Create the file**

  ```tsx
  import { useEffect } from 'react'
  import { useNavigate } from 'react-router-dom'
  import { useAuth } from '../hooks/useAuth'
  import MemberPage from './MemberPage'

  export default function MyTopics() {
    const { isLoggedIn, member, loading } = useAuth()
    const navigate = useNavigate()

    useEffect(() => {
      if (!loading && !isLoggedIn) {
        navigate('/login', { replace: true })
      }
    }, [isLoggedIn, loading, navigate])

    if (loading || !member) return null

    return <MemberPage username={member.username} />
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/pages/MyTopics.tsx
  git commit -m "feat(MyTopics): new page wrapping MemberPage for the logged-in user"
  ```

---

### Task 3: Register the `/my-topics` route

**Files:**
- Modify: `src/App.tsx:8` (imports section) and `src/App.tsx:69` (routes section)

- [ ] **Step 1: Add import**

  After the `import Search` line (line 14), add:
  ```tsx
  import MyTopics from './pages/MyTopics'
  ```

- [ ] **Step 2: Add route**

  Inside `<Route element={<Layout />}>`, after the `/search` route (line 73), add:
  ```tsx
  <Route path="/my-topics" element={<MyTopics />} />
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "feat(routing): register /my-topics route"
  ```

---

### Task 4: Update Layout — getActiveTab, icon, and nav item

**Files:**
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1: Extend `getActiveTab` to read location state**

  Replace the current function (lines 6–12):
  ```ts
  function getActiveTab(pathname: string): string {
    if (pathname === '/' || pathname.startsWith('/topic/')) return 'home'
    if (pathname === '/nodes' || pathname.startsWith('/node/')) return 'nodes'
    if (pathname === '/notifications') return 'notifications'
    if (pathname === '/profile' || pathname === '/login') return 'profile'
    return ''
  }
  ```

  With:
  ```ts
  function getActiveTab(pathname: string, state?: unknown): string {
    const stateTab = (state as { activeTab?: string } | null)?.activeTab
    if (stateTab) return stateTab

    if (pathname === '/' || pathname.startsWith('/topic/')) return 'home'
    if (pathname === '/nodes' || pathname.startsWith('/node/')) return 'nodes'
    if (pathname === '/notifications') return 'notifications'
    if (pathname === '/my-topics') return 'my-topics'
    if (pathname === '/profile' || pathname === '/login') return 'profile'
    return ''
  }
  ```

- [ ] **Step 2: Add `'my-topics'` to the ICONS object**

  After the `plus` icon entry (before the closing `}` of `ICONS`), add:
  ```tsx
  'my-topics': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  ```

  The key must be `'my-topics'` (quoted, hyphenated) to match `item.key` used in the `ICONS[item.key as keyof typeof ICONS]` lookup in the map below.

- [ ] **Step 3: Update the `activeTab` call to pass state**

  Current line 57:
  ```ts
  const activeTab = getActiveTab(location.pathname)
  ```

  Replace with:
  ```ts
  const activeTab = getActiveTab(location.pathname, location.state)
  ```

- [ ] **Step 4: Add "我的主题" to desktop navItems**

  Current `navItems` array (lines 84–89):
  ```ts
  const navItems = [
    { key: 'home', label: '首页', path: '/' },
    { key: 'nodes', label: '节点', path: '/nodes' },
    { key: 'notifications', label: '通知', path: '/notifications' },
    { key: 'profile', label: '我的', path: isLoggedIn ? '/profile' : '/login' },
  ] as const
  ```

  Replace with (remove `as const` from the array — TypeScript does not allow conditional spreads inside `const` assertions; an explicit type is cleaner):

  ```ts
  type NavItem = { key: string; label: string; path: string }
  const navItems: NavItem[] = [
    { key: 'home', label: '首页', path: '/' },
    { key: 'nodes', label: '节点', path: '/nodes' },
    { key: 'notifications', label: '通知', path: '/notifications' },
    ...(isLoggedIn ? [{ key: 'my-topics', label: '我的主题', path: '/my-topics' }] : []),
    { key: 'profile', label: '我的', path: isLoggedIn ? '/profile' : '/login' },
  ]
  ```

  Also remove the `as const` at the end of the existing array declaration — there should be only one declaration.

- [ ] **Step 5: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/Layout.tsx
  git commit -m "feat(Layout): add 我的主题 sidebar nav item and extend getActiveTab with state"
  ```

---

### Task 5: Update CreateTopic post-publish navigation

**Files:**
- Modify: `src/pages/CreateTopic.tsx:153`

- [ ] **Step 1: Add activeTab state to navigate call**

  Current line 153:
  ```ts
  navigate(`/topic/${res.topicId}`, { replace: true })
  ```

  Replace with:
  ```ts
  navigate(`/topic/${res.topicId}`, { replace: true, state: { activeTab: 'my-topics' } })
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/pages/CreateTopic.tsx
  git commit -m "feat(CreateTopic): highlight 我的主题 nav after successful publish"
  ```

---

### Task 6: Add E2E tests

**Files:**
- Create: `e2e/my-topics.spec.ts`

- [ ] **Step 1: Create the test file**

  ```ts
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
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add e2e/my-topics.spec.ts
  git commit -m "test(e2e): add my-topics nav feature tests"
  ```

---

### Task 7: Build and run all tests

- [ ] **Step 1: Build the frontend**

  ```bash
  npm run build
  ```
  Expected: build succeeds with no TypeScript errors.

- [ ] **Step 2: Run E2E tests**

  ```bash
  npm run test:e2e
  ```
  Expected: all tests pass, including existing `app.spec.ts` (mobile tab count still 5 — mobile layout unchanged) and new `my-topics.spec.ts` (4 tests pass).

  If a test fails, check for:
  - `app.spec.ts` "bottom navigation has correct tabs" — confirms mobile bottom bar is still 5 items (unchanged by this feature)
  - `my-topics.spec.ts` failures — debug with `npx playwright test --debug e2e/my-topics.spec.ts`

- [ ] **Step 3: Final commit if any fixes were needed**

  Only if step 2 required changes. Otherwise skip.
