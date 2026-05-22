# 设计文档：我的主题导航入口

**日期**：2026-05-22  
**状态**：已批准

## 目标

1. 桌面左侧导航栏新增"我的主题"入口，点击进入当前登录用户的主题列表。
2. 发布帖子成功后，跳转到新帖子详情页，同时左侧导航高亮"我的主题"而非"首页"。

## 范围

- 桌面侧边栏（Desktop sidebar）：新增导航项
- 移动底部导航（Mobile tab bar）：不改动，不增加入口
- 发布流程（CreateTopic）：跳转时携带导航高亮信号

## 方案选择

选定方案 A：专用 `/my-topics` 路由 + location state。

排除方案 B（直接链接 `/member/:username`），原因：`getActiveTab` 需要感知登录用户名，引入不必要耦合。

排除方案 C（发布后跳到 `/my-topics`），原因：用户明确希望发布后看到帖子详情。

## 详细设计

### 1. 路由与页面

**新文件**：`src/pages/MyTopics.tsx`

- 从 `useAuth()` 读取 `member.username`
- 未登录时 `navigate('/login', { replace: true })`
- 登录时渲染 `<MemberPage username={member.username} />`

**`MemberPage.tsx` 小改**：

- 增加可选 prop `username?: string`
- 优先使用 prop，兜底用 `useParams<{ username: string }>()`
- 现有的 `/member/:username` 路由行为不变

**`App.tsx`**：

```tsx
<Route path="/my-topics" element={<MyTopics />} />
```

### 2. 导航高亮

**`Layout.tsx` — `getActiveTab`**：

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

调用处改为 `getActiveTab(location.pathname, location.state)`。

**桌面 `navItems`**：

- 仅在 `isLoggedIn` 时加入 `{ key: 'my-topics', label: '我的主题', path: '/my-topics' }`
- 位置：排在"通知"之后、"我的"之前
- 图标：线条风格 SVG（与现有 ICONS 风格一致）

### 3. 发布后导航

`CreateTopic.tsx` 发布成功跳转：

```ts
// 改前
navigate(`/topic/${res.topicId}`, { replace: true })

// 改后
navigate(`/topic/${res.topicId}`, { replace: true, state: { activeTab: 'my-topics' } })
```

`location.state.activeTab` 仅在这次导航中有效。用户通过历史记录（POP）再次进入同一帖子时不携带此 state，高亮回到默认的"首页"——此为预期行为。

## 边界情况

| 场景 | 行为 |
|------|------|
| 未登录访问 `/my-topics` | 重定向到 `/login` |
| 登录后 `member` 尚未加载完毕 | MyTopics 渲染 Loading，等 member 可用后再渲染 MemberPage |
| 通过历史 POP 返回帖子详情 | state 不再携带 activeTab，高亮"首页"（正常） |
| 移动端 | 无变化，不添加"我的主题"入口 |

## 文件变更清单

| 文件 | 变更类型 |
|------|---------|
| `src/pages/MyTopics.tsx` | 新建 |
| `src/pages/MemberPage.tsx` | 小改（增加可选 username prop） |
| `src/App.tsx` | 增加 `/my-topics` 路由 |
| `src/components/Layout.tsx` | 增加 navItem、扩展 getActiveTab、增加图标 |
| `src/pages/CreateTopic.tsx` | 发布成功跳转时携带 state |
