# 主题切换 + 调色板 设计文档

日期: 2026-05-20
状态: 已确认,待写实现 plan

## 背景与动机

当前 V2Fun 只有单一深色主题,主题色硬编码为亮青 `#00D4FF`,长时间使用反馈"扎眼"。需要:

1. 把主题色默认换成柔和色
2. 加明亮 / 暗色模式切换
3. 提供主题色调色板,让用户自选

## 主题模型

**正交模型**:`mode`(light / dark)× `accent`(6 选 1),两个维度独立组合。

| 维度 | 控制 | 切换方式 |
|---|---|---|
| mode | bg / text / border / shadow 颜色 | `<html data-theme="light\|dark">` |
| accent | --accent 及其派生 5 个变量 | `<html data-accent="teal\|indigo\|...">` |

两个维度的 token 在 `:root` 之外用属性选择器层叠,无 JS 计算颜色。

## Token 重构

`src/index.css` 现有 `:root` 拆 3 层:

### Static 层(`:root`,不随主题变)
保留:radius、font、spacing、`--header-height`、`--tab-height`、`--max-app-width`、safe area。

### Mode 层

```css
[data-theme="dark"] {
  --bg-primary: #0B0B10;
  --bg-secondary: #13131A;
  --bg-tertiary: #1C1C26;
  --bg-accent: #1A1A28;
  --bg-elevated: #1E1E2A;
  --text-primary: #E8E8ED;
  --text-secondary: #8F8FA3;
  --text-tertiary: #5A5A6E;
  --border: rgba(255, 255, 255, 0.06);
  --border-light: rgba(255, 255, 255, 0.04);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.6);
}

[data-theme="light"] {
  --bg-primary: #F7F7FA;
  --bg-secondary: #FFFFFF;
  --bg-tertiary: #EFEFF4;
  --bg-accent: #E8E8F0;
  --bg-elevated: #FFFFFF;
  --text-primary: #1A1A24;
  --text-secondary: #5A5A6E;
  --text-tertiary: #8F8FA3;
  --border: rgba(0, 0, 0, 0.08);
  --border-light: rgba(0, 0, 0, 0.05);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.12);
}
```

`--success` / `--warning` / `--danger` 在两个 mode 下都用同一组(高饱和语义色,明暗都能读)。

### Accent 层

每个 accent 6 变量:`--accent` / `--accent-hover` / `--accent-light` / `--accent-glow` / `--border-accent` / `--accent-warm`(保留现有 warm,跨主题不变)。

```css
[data-accent="teal"] {
  --accent: #5FA8A0;
  --accent-hover: #4D8E87;
  --accent-light: rgba(95, 168, 160, 0.10);
  --accent-glow: rgba(95, 168, 160, 0.18);
  --border-accent: rgba(95, 168, 160, 0.18);
}

[data-accent="indigo"] {
  --accent: #7B8FD8;
  --accent-hover: #6577C2;
  --accent-light: rgba(123, 143, 216, 0.10);
  --accent-glow: rgba(123, 143, 216, 0.18);
  --border-accent: rgba(123, 143, 216, 0.18);
}

[data-accent="sage"] {
  --accent: #7CA982;
  --accent-hover: #65906B;
  --accent-light: rgba(124, 169, 130, 0.10);
  --accent-glow: rgba(124, 169, 130, 0.18);
  --border-accent: rgba(124, 169, 130, 0.18);
}

[data-accent="coral"] {
  --accent: #E89B6C;
  --accent-hover: #D17F50;
  --accent-light: rgba(232, 155, 108, 0.10);
  --accent-glow: rgba(232, 155, 108, 0.18);
  --border-accent: rgba(232, 155, 108, 0.18);
}

[data-accent="plum"] {
  --accent: #B084CC;
  --accent-hover: #946BB0;
  --accent-light: rgba(176, 132, 204, 0.10);
  --accent-glow: rgba(176, 132, 204, 0.18);
  --border-accent: rgba(176, 132, 204, 0.18);
}

[data-accent="amber"] {
  --accent: #D4A574;
  --accent-hover: #B88B5C;
  --accent-light: rgba(212, 165, 116, 0.10);
  --accent-glow: rgba(212, 165, 116, 0.18);
  --border-accent: rgba(212, 165, 116, 0.18);
}
```

`--accent-warm` 跨主题保持现有 `#FF8A50`(用在感谢爱心图标等少量场景,不被调色板控制)。

### 默认值

首次访问 `<html>` 上没有任何 data 属性时,fallback 通过单独的 `:root` 默认块给一份 `dark` + `teal` 的值,保证未注水也有色。或者更稳的做法是 inline script 必跑一次。我们用 inline script,简化 CSS。

## ThemeProvider 实现

### 文件 `src/hooks/useTheme.tsx`(新建)

- React Context: `{ theme: 'dark'|'light', accent: AccentSlug, setTheme, setAccent }`
- 初值从 `localStorage.v2fun_theme` / `v2fun_accent` 读,无值用默认
- `setX` 同步:写 localStorage + 写 `document.documentElement.setAttribute(...)`
- 在 `App.tsx` 最外层包 `<ThemeProvider>`
- 导出常量 `ACCENTS: Array<{ slug, name, color }>` 给 settings UI 用

### 文件 `index.html`(改)

`<head>` 插入 inline script(在所有 `<link>` 之后、`<body>` 之前):

```html
<script>
  (function() {
    try {
      var t = localStorage.getItem('v2fun_theme') || 'dark';
      var a = localStorage.getItem('v2fun_accent') || 'teal';
      document.documentElement.setAttribute('data-theme', t);
      document.documentElement.setAttribute('data-accent', a);
    } catch (e) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.setAttribute('data-accent', 'teal');
    }
  })();
</script>
```

防 FOUC,刷新不闪。

## Settings UI

在 `Profile.tsx` 的 `<div className={styles.content}>` 内、"我的主题"按钮 section 上方插入新 section:

```tsx
<div className={styles.section}>
  <h3 className={styles.sectionTitle}>外观</h3>

  <div className={styles.subRow}>
    <span className={styles.subLabel}>显示模式</span>
    <div className={styles.modeToggle}>
      <button data-active={theme==='dark'} onClick={()=>setTheme('dark')}>
        <MoonIcon/> 暗色
      </button>
      <button data-active={theme==='light'} onClick={()=>setTheme('light')}>
        <SunIcon/> 明亮
      </button>
    </div>
  </div>

  <div className={styles.subRow}>
    <span className={styles.subLabel}>主题色 · {ACCENTS.find(a=>a.slug===accent)?.name}</span>
    <div className={styles.accentRow}>
      {ACCENTS.map(({slug, color}) => (
        <button
          key={slug}
          className={styles.accentSwatch}
          data-active={accent===slug}
          style={{ background: color }}
          aria-label={slug}
          onClick={()=>setAccent(slug)}
        >
          {accent===slug && <CheckIcon/>}
        </button>
      ))}
    </div>
  </div>
</div>
```

样式加在 `Profile.module.css`:

- `.modeToggle`: 两个按钮 segmented control,高度 36px,选中 `data-active=true` 时 bg `var(--bg-accent)` + 文字 `var(--accent)`
- `.accentSwatch`: 28×28 圆,`border: none`,选中时 `box-shadow: 0 0 0 2px var(--bg-secondary), 0 0 0 4px currentColor`(双环效果),中心放白色 ✓

无"保存"按钮,点即生效。

## 硬编码颜色迁移

以下 15 处硬编码 `#00D4FF` / `rgba(0, 212, 255, …)` 全部改成 token:

| 文件 | 行 | 改法 |
|---|---|---|
| `src/index.css` | 31-34, 47, 52 | 删,移到 accent 层 |
| `src/index.css` | 108-109 | `rgba(0, 212, 255, 0.04)` → `var(--accent-glow)` 或保留并替换为 accent rgba |
| `src/index.css` | 227 | `rgba(0, 212, 255, 0.3)` → `var(--accent-glow)` |
| `src/components/Layout.module.css` | 80, 86, 175 | rgba shadow → `var(--accent-glow)` |
| `src/components/PullToRefreshIndicator.module.css` | 18, 23 | filter drop-shadow rgba → `var(--accent-glow)` |
| `src/pages/Login.module.css` | 160 | text-decoration-color rgba → `var(--accent-glow)` |
| `src/pages/Profile.module.css` | 24 | `linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.05))` → `linear-gradient(135deg, var(--accent-glow), var(--accent-light))` |

`body::before` 的 radial-gradient(`index.css:108-109`)是页面整体背景晕,改成用 accent 派生后切色立刻看到效果。

**alpha 不严格 1:1**:旧硬编码的 rgba alpha 是逐处微调过的(0.04/0.15/0.3/0.5/0.65 各处不同),迁移到统一的 `--accent-light`(0.10)/`--accent-glow`(0.18)后,某些位置(尤其 `body::before` 原本 0.04 几乎不可见)会变得稍微更明显。这是可接受的视觉变化 — 让主题色在背景上更有存在感。如果某处迁移后明显过暗或过亮,实现时单独 override 即可,不再引入第三个全局 alpha 变量(避免 token 膨胀)。

## 持久化与初始化时序

1. `index.html` inline script 在 DOM ready 前写 data 属性 — 防 FOUC
2. React mount,`ThemeProvider` 读 localStorage 设 React state(与 DOM 上的 data 属性一致)
3. `setTheme/setAccent` 双向写:React state + DOM 属性 + localStorage

无 race condition:inline script 单源真理,React 只是镜像读 + 写。

## 不做(YAGNI)

- "跟随系统" 模式 — 用户未要求,要监听 `matchMedia`,且和 2 选 1 UI 冲突
- 主题切换动画过渡 — 担心和现有页面切换冲突,留 v2
- 自定义颜色拾色器 — 6 色足够,加 picker 复杂度跳级
- 服务端记忆用户主题 — 纯客户端 localStorage 即可
- 多端同步 — 无后端用户数据库,不在范围

## 测试计划

1. TypeScript: `npx tsc --noEmit` 通过
2. Chrome DevTools MCP 自测:
   - 首次访问无 localStorage:落 dark + teal
   - 切 light:全页 bg/text 反转,无残留深色块
   - 切 6 个 accent:Layout 底栏激活态、PullToRefresh、链接色全部跟着变
   - 刷新:不闪,落用户选过的主题
   - 退出登录后再进:主题保留(localStorage 不被 logout 清)
3. 视觉检查:明亮模式下 6 个 accent 在 link/button/tab 上对比度都可读

## 部署

按 `v2fun.sh update` 流程:commit → push → CI build → `bash v2fun.sh update` 拉镜像。无 schema / 数据迁移。
