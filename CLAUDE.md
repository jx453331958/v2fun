# V2Fun - Claude Code 项目记忆

## 项目概述

V2EX 移动端 Web 客户端。React 19 + TypeScript + Vite 6 前端，Express.js 后端（web scraping）。
部署方式：Docker（ghcr.io/jx453331958/v2fun:latest），通过 `bash v2fun.sh update` 更新。

## 关键经验

### V2EX 爬取必须用桌面 UA

V2EX 对移动端 User-Agent 返回的 HTML **不包含分页元素**（`page_input`、`page_normal`、`page_current` 全部没有），导致 `totalPages` 解析为 1。后端爬取时必须使用固定的桌面 Chrome UA（`SCRAPE_UA`），不能转发客户端的移动 UA。

相关代码：`server/index.mjs` 中的 `SCRAPE_UA` 常量，用于 `scrapeTopicList`、`scrapeReplies`、`scrapeNotifications`。

### 前端分页兜底逻辑

当 `totalPages` 不可靠时（为 1），前端用返回条数判断是否还有下一页：`items.length >= 20` 则认为还有更多。V2EX 每页固定 20 条。

### 本地测试 vs Docker 部署差异

本地用 curl 测试时容易用桌面 UA，结果正常；但实际 Docker 部署时客户端是手机浏览器（移动 UA），表现不同。调试时要注意模拟真实客户端环境。

## 架构要点

- 后端爬取入口：`server/index.mjs` 中的 `scrapeTopicList()`、`scrapeReplies()`、`scrapeNotifications()`
- 前端 API 客户端：`src/api/client.ts`
- 无限滚动 hook：`src/hooks/useInfiniteScroll.ts`（IntersectionObserver + sentinel 元素）
- Pagination 组件仍保留，Home.tsx 和 MemberPage.tsx 在使用
- 口令认证系统：passcode gate，开发时 passcode 在 `/tmp/v2fun-srv.log` 中

## 开发命令

- `npm run dev` — 启动 Vite 开发服务器
- `node server/index.mjs` — 启动后端（端口 3210）
- `npm run build` — 构建前端
- `npx tsc --noEmit` — TypeScript 类型检查
