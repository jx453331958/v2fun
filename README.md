# V2Fun

一个设计精美的 V2EX 移动端 Web 客户端，支持 Docker 一键部署，自托管你自己的 V2EX 阅读器。

## 功能

- **浏览主题** — 热门 / 最新主题流，骨架屏加载动画
- **主题详情** — 完整内容渲染，楼层式回复列表
- **回复主题** — 底部输入栏即时回复
- **发布主题** — 节点选择器 + Markdown 编辑器
- **感谢** — 一键感谢主题和回复
- **通知** — 消息通知列表
- **节点浏览** — 全部节点搜索与分类浏览
- **用户主页** — 个人资料、发帖记录
- **Token 认证** — 使用 V2EX Personal Access Token 安全登录

## 快速部署

### 方式一：一键脚本（推荐）

```bash
# 下载并运行（无参数进入交互式管理面板）
bash <(curl -sL "https://raw.githubusercontent.com/jx453331958/v2fun/main/v2fun.sh")
```

脚本会引导你完成安装：选择安装目录、设置端口、确认后自动构建部署。

安装完成后，进入安装目录即可管理：

```bash
cd ./v2fun          # 默认安装到当前目录下的 v2fun/
bash v2fun.sh       # 打开管理面板
```

也支持直接传参：

```bash
bash v2fun.sh start      # 启动
bash v2fun.sh stop       # 停止
bash v2fun.sh restart    # 重启
bash v2fun.sh update     # 检查更新
bash v2fun.sh config     # 修改配置（端口等）
bash v2fun.sh logs       # 查看日志
bash v2fun.sh status     # 查看状态
bash v2fun.sh uninstall  # 卸载
```

### 方式二：手动 Docker 部署

```bash
git clone https://github.com/jx453331958/v2fun.git
cd v2fun
docker compose up -d
```

部署完成后访问 `http://你的服务器IP:3210`。

## 登录说明

V2Fun 使用 V2EX 官方的 Personal Access Token（PAT）进行认证。

1. 登录 V2EX，访问 [设置 → Tokens](https://www.v2ex.com/settings/tokens)
2. 点击「创建新 Token」，勾选所需权限
3. 复制生成的 Token
4. 在 V2Fun 的「我的」页面点击登录，粘贴 Token

> Token 仅存储在你的浏览器 localStorage 中，API 请求通过你自己部署的代理服务器转发到 V2EX，不会经过任何第三方。

## 本地开发

```bash
# 安装依赖
npm install
cd server && npm install && cd ..

# 启动 API 代理服务器（端口 3210）
node server/index.mjs &

# 启动前端开发服务器（端口 5173，自动代理 /api 到 3210）
npm run dev
```

访问 `http://localhost:5173`。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 6 |
| 路由 | React Router 6 |
| 动效 | Framer Motion |
| 后端代理 | Express + http-proxy-middleware |
| 部署 | Docker 多阶段构建 |

## 项目结构

```
v2fun/
├── src/
│   ├── api/            # V2EX API 客户端
│   ├── components/     # 通用组件（TopicCard、ReplyItem、Header 等）
│   ├── hooks/          # React Hooks（认证上下文）
│   ├── pages/          # 页面组件
│   │   ├── Home        # 首页（热门/最新）
│   │   ├── TopicDetail # 主题详情
│   │   ├── CreateTopic # 发布主题
│   │   ├── Nodes       # 节点列表
│   │   ├── NodeDetail  # 节点详情
│   │   ├── Notifications # 通知
│   │   ├── Profile     # 个人中心
│   │   ├── MemberPage  # 用户主页
│   │   └── Login       # 登录
│   └── types.ts        # TypeScript 类型定义
├── server/
│   └── index.mjs       # Express API 代理服务器
├── v2fun.sh            # 一键管理脚本
├── Dockerfile          # 多阶段构建
└── docker-compose.yml
```

## API 说明

V2Fun 后端是一个轻量代理服务器，将前端请求转发到 V2EX 官方 API：

- `/api/topics/*`, `/api/nodes/*` 等 → V2EX API v1（公开接口）
- `/api/v2/*` → V2EX API v2（需要 Token 认证）

代理服务器的作用：
1. 解决浏览器 CORS 跨域限制
2. 在服务端转发 Authorization 头
3. 生产环境同时提供静态文件服务

## License

MIT
