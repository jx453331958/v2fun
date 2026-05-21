# 粘贴图片自动上传图床 — 设计文档

**日期**: 2026-05-21
**状态**: Draft (待用户确认)

## 1. 背景与问题

V2Fun 用户在发主题（`CreateTopic`）和回帖（`TopicDetail`）时，目前往
textarea 里粘贴图片是无效操作——浏览器原生粘贴对图片在 textarea 里就是丢弃。
用户需要先上传到第三方图床、复制 URL、粘到 textarea，链路很长。

目标：用户在 textarea 里 `Cmd+V` 一张图，系统自动上传到图床并把可访问的 URL
（单独成行）插入到光标位置，让 V2EX 自动渲染成图片。

## 2. 关键决策（已与用户确认）

| 决策 | 选择 | 理由（简） |
|---|---|---|
| 图床后端 | **Telegram Bot API** | 调研发现 2025 年所有"完全免注册"匿名图床（telegra.ph / catbox / 0x0.st / freeimage.host / imgur 匿名）都已失效；剩下选项里 TG Bot 免费、全球 CDN 稳、安全可控 |
| 触发方式 | 仅 `paste` | drag-drop / 文件选择按钮 YAGNI；手机/桌面 paste 都能覆盖截图场景 |
| 插入字符串格式 | **`\n<url>\n`**（裸 URL 单独一行） | V2EX 主题（不管开没开 MD）+ 回复都能自动渲染成图片；`![](url)` 在 V2EX 回复里会原样显示 |
| 上传中 UX | **Inline 占位符**（GitHub/Slack 模式） | 比 toast / 锁输入区都更顺手 |
| 浏览图片时的 token 保护 | **302 重定向**（不流式代理） | token 出现在 Location 头，DevTools Network 面板可见但页面 view-source 不可见，对个人项目可接受；流式代理代价过大 |
| 自部署策略 | **A 方案**：单实现，env 配置开关，README 给指引 | 替代的 plugin 框架（多 driver）是为假想需求设计 |

## 3. 架构

```
┌────────────────┐ paste image  ┌────────────────────────┐
│ Browser        │─────────────>│ Frontend hook          │
│ (CreateTopic / │              │ usePasteUpload         │
│  TopicDetail)  │              │ - 拦 onPaste 事件      │
│                │              │ - 插占位符到 textarea  │
│                │<─────────────│ - POST 后端 + 替换文本 │
└────────────────┘  插入 URL    └────────┬───────────────┘
                                         │ multipart upload
                                         ▼
                              ┌──────────────────────────┐
                              │ Express /web/upload-image│
                              │ - passcode 校验          │
                              │ - IP 限频 10/min         │
                              │ - size/mime 校验         │
                              │ - 调 TG sendPhoto        │
                              │ - 返回 /img/<file_id>    │
                              └────────┬─────────────────┘
                                       │ Bot API
                                       ▼
                              ┌──────────────────────────┐
                              │ Telegram                 │
                              │ 私有频道（图存这里）      │
                              └──────────────────────────┘

浏览时：
  浏览器 src=/img/<file_id>
    → Express GET /img/<file_id>
    → 查 内存缓存 file_id → file_path (TTL 50min)
      命中 → 302 跳 https://api.telegram.org/file/bot<TOKEN>/<file_path>
      未命中 → getFile → 写缓存 → 302 跳
```

## 4. 组件 / 文件清单

| 文件 | 类型 | 职责 |
|---|---|---|
| `src/hooks/usePasteUpload.ts` | 新 | textarea paste 钩子：监听 paste、校验、插入/替换占位符、调上传 API |
| `src/api/client.ts` | 改 | 增 `uploadImage(file)` 和 `getUploadCapability()`（带 sessionStorage 缓存） |
| `src/pages/CreateTopic.tsx` | 改 | 接 hook 到主题正文 textarea |
| `src/pages/TopicDetail.tsx` | 改 | 接 hook 到回复 textarea |
| `server/imageHost.mjs` | 新 | TG bot driver：`isEnabled()` / `upload(buffer, mime)` / `resolve(fileId)` + URL 缓存 |
| `server/index.mjs` | 改 | 加 `POST /web/upload-image`、`GET /img/:fileId`、`GET /web/upload-capability`；IP 限频中间件复用现有 passcode 校验 |
| `README.md` | 改 | 加"启用图片粘贴上传（可选）"一节 |
| `package.json` | 改 | 加 `multer`（处理 multipart）依赖 |

## 5. 接口契约

### 5.1 `GET /web/upload-capability`

```json
// 启用
{ "success": true, "enabled": true, "maxSizeBytes": 10485760, "mimes": ["image/png","image/jpeg","image/webp","image/gif"] }

// 未配置
{ "success": true, "enabled": false }
```

前端在第一次 paste image 时探测，结果写 sessionStorage；服务端如果切换了 env，
用户刷新即可。

### 5.2 `POST /web/upload-image` (multipart)

请求：`Content-Type: multipart/form-data`，字段 `file`。带 V2EX 凭证 cookie（passcode 校验依赖）。

响应：

```json
// 成功
{ "success": true, "url": "/img/AgACAgEAAyEFAASa..." }

// 失败（统一 HTTP 200 + success:false，遵循项目既有约定）
{ "success": false, "error": "file_too_large" | "invalid_mime" | "rate_limited" | "passcode_required" | "host_disabled" | "upstream_failed" }
```

### 5.3 `GET /img/:fileId`

- 命中缓存或 getFile 成功 → `302 Location: https://api.telegram.org/file/bot<TOKEN>/<path>`
- getFile 失败 → `404`
- 服务未启用 → `404`

## 6. 数据流

### 6.1 上传

```
1. 用户 Cmd+V                                                       [t=0]
2. onPaste 检 e.clipboardData.items 找 image/*                      [t=0]
3. 若找到 → e.preventDefault()                                      [t=0]
4. 客户端校验：mime in 白名单 && size ≤ 10MB                        [t=0]
   失败 → 在光标处插 1.5s 临时错误占位 → 自动删
5. 通过 → 生成占位符 "\n[上传中... <生成的文件名>]\n"               [t=0]
   插入 textarea.value，cursor 移到占位符末尾
   记录占位符的绝对字符串（含独有 ID 后缀），用于后续 .replace
6. fetch POST /web/upload-image (FormData)                          [t≈50ms]
7. 后端：passcode 校验 + IP 限频 (10/min) + mime/size 复核
8. 后端：调 TG sendPhoto，文件作 photo 字段                          [t≈1.5s]
9. 后端：从响应取 photos[最后].file_id（最大尺寸）
   返回 { success:true, url:"/img/<file_id>" }                       [t≈1.6s]
10. 前端：textarea.value 中把占位符整体替换为 "\n<完整URL>\n"
    cursor 移到 URL 末尾                                             [t≈1.6s]
    完整 URL = window.location.origin + "/img/<file_id>"
```

### 6.2 浏览

```
<img src="https://v2fun.ohminicat.com/img/AgAC..." />
    ↓
Express GET /img/AgAC...
    ↓
imageHost.resolve("AgAC...")
    ├─ 缓存命中 file_path → 直接拼 URL
    └─ 未命中 → TG getFile → 缓存 file_path (50min TTL) → 拼 URL
    ↓
res.redirect(302, "https://api.telegram.org/file/bot<TOKEN>/<file_path>")
```

## 7. 错误处理矩阵

| 场景 | 检测点 | 占位符 → 变成 | 是否自动删 |
|---|---|---|---|
| 未粘图片（粘文字） | 前端 onPaste 首段 | 不插占位符，走原生 | — |
| 服务未启用 | capability false | 不插占位符，走原生 | — |
| 不支持的 mime | 前端 | `[不支持的图片格式]` | 1.5s |
| 超过 10MB | 前端 | `[图片太大，最大 10MB]` | 1.5s |
| 网络 fetch 失败 | 前端 catch | `[上传失败：网络错误]` | 否（保留供用户感知） |
| 后端 passcode_required | 后端 | `[上传失败：登录已过期]` | 否 |
| 后端 rate_limited | 后端 | `[上传太快，请稍候]` | 否 |
| 后端 upstream_failed | 后端 | `[上传失败：图床暂不可用]` | 否 |
| 用户在上传中按发送 | 不拦截 | 占位符随帖子一起被提交（用户责任） | — |

## 8. 安全 / 反滥用

- **token 不外露**：仅存在 `process.env.TG_BOT_TOKEN`，不进日志、不进响应体
- **复用 passcode 校验**：现有 `/web/*` 路径所有写操作都依赖 passcode cookie；上传走同一中间件
- **IP 限频**：内存中按 IP 滑动窗口，10 次/分钟；触发返 `rate_limited`
- **mime 白名单 + magic-byte 双重校验**：multer 拿 mime 后用 `file-type` lib（如果引入麻烦就退化只信 mime；先评估）→ **决策延后到实施阶段，先用 mime 单一校验，复杂度太大再升级**
- **size 双重校验**：前端先卡，后端 multer 配 `limits.fileSize=10MB` 二次卡
- **公开滥用风险**：v2fun 当前 passcode 是单一密码、所有用户共享。极端场景下 passcode 泄露 → 攻击者可灌满你 TG 频道。残余风险，复用现有信任模型，不为此场景额外加强 passcode 体系

## 9. 自部署支持

README 新增章节"启用图片粘贴上传（可选）"，内容大致：

```markdown
1. Telegram 找 @BotFather 建 bot，记下 token
2. 建一个 Telegram 私有频道，把 bot 加进去并设为管理员（只勾"发送消息"）
3. 转发频道任意消息到 @userinfobot，拿 chat_id（形如 -1001234567890）
4. 在 .env 或 docker-compose 加：
     TG_BOT_TOKEN=<token>
     TG_CHAT_ID=<chat_id>
5. 重启容器
不配置则 paste 图片走浏览器原生（即什么也不发生）。
```

不引入 plugin 框架；要换图床就 fork 改 `server/imageHost.mjs`。

## 10. 非目标 (YAGNI)

- 不做 drag-drop 上传
- 不做"选择文件"按钮（手机端 paste 已经能触发系统截图选择）
- 不做客户端压缩（10MB 内一般够用，复杂度收益不匹配）
- 不做图片预览缩略图（V2EX 渲染本就有图片，发送前 textarea 里只显示 URL 文本即可）
- 不做多 driver 支持（A 方案已论证）
- 不做上传进度条（1-3s 不值得；占位符已足够反馈）
- 不做图片删除接口（V2EX 上发出去就发出去了，后悔药复杂度过大）
- 不做永久 URL 缓存表 / 数据库（TG file_id 已是永久标识符，临时 file_path 内存缓存够用，重启失效无影响）

## 11. 测试

- **本地**：开发者临时建测试 bot+频道，dev server 跑通 paste→TG→替换占位符→浏览图片全链路
- **关键边界**：mime 错、size 超、断网、capability=false、passcode 过期、限频触发
- **生产部署后**：用 chrome-devtools MCP 在 https://v2fun.ohminicat.com 实际粘贴一张截图，验证主题创建 + 回复两个场景

## 12. 实施顺序（写 plan 时细化）

粗序：
1. `server/imageHost.mjs` 单元：能 send + resolve 单图
2. 后端三个路由 + multer + IP 限频
3. 前端 `usePasteUpload` hook + client API 函数
4. 两处 textarea 接入
5. README 章节
6. 端到端自测 → 提交 → 部署 → 生产验证
