# V2EX API 接口文档

V2EX 提供两套 API：V1（公开，无需认证）和 V2（需要 Bearer Token 认证）。

Base URL: `https://www.v2ex.com/api`

---

## V1 API（公开接口）

无需认证，直接访问。

### GET /topics/hot.json

获取热门主题列表。

**响应**: `V1Topic[]`

```json
[
  {
    "id": 1192773,
    "title": "今天还有在上班？",
    "url": "https://www.v2ex.com/t/1192773",
    "content": "农历 2025 最后上半天班了",
    "content_rendered": "农历 2025 最后上半天班了",
    "replies": 117,
    "created": 1771029284,
    "last_modified": 1771029991,
    "last_touched": 1771055994,
    "last_reply_by": "nuonuojump",
    "deleted": 0,
    "member": { /* V1Member */ },
    "node": { /* V1Node */ }
  }
]
```

### GET /topics/latest.json

获取最新主题列表。

**响应**: `V1Topic[]`（与 hot.json 结构相同）

### GET /topics/show.json

按条件查询主题，支持三种查询方式：

| 参数 | 说明 |
|------|------|
| `id` | 主题 ID |
| `node_name` | 节点名称（英文） |
| `username` | 用户名 |

**响应**: `V1Topic[]`

### GET /replies/show.json

获取主题的回复列表。

| 参数 | 说明 |
|------|------|
| `topic_id` | 主题 ID（必填） |
| `page` | 页码，从 1 开始 |
| `page_size` | 每页条数，默认 100 |

**响应**: `V1Reply[]`

```json
[
  {
    "id": 17325823,
    "topic_id": 1192792,
    "member_id": 47049,
    "content": "是的，过年最爽的就是这几天...",
    "content_rendered": "是的，过年最爽的就是这几天...",
    "created": 1771036898,
    "last_modified": 1771036898,
    "member": {
      "id": 47049,
      "username": "libasten",
      "url": "https://www.v2ex.com/u/libasten",
      "website": "https://www.feidaoboke.com",
      "twitter": "",
      "psn": "",
      "github": "",
      "btc": "",
      "location": "",
      "tagline": "",
      "bio": "",
      "avatar_mini": "https://cdn.v2ex.com/gravatar/...?s=24&d=retro",
      "avatar_normal": "https://cdn.v2ex.com/gravatar/...?s=48&d=retro",
      "avatar_large": "https://cdn.v2ex.com/gravatar/...?s=73&d=retro",
      "created": 1381994119,
      "last_modified": 1721288759,
      "pro": 0
    }
  }
]
```

### GET /nodes/all.json

获取所有节点列表。

**响应**: `V1Node[]`（约 1338 个节点）

```json
[
  {
    "id": 90,
    "name": "python",
    "title": "Python",
    "title_alternative": "Python",
    "url": "https://www.v2ex.com/go/python",
    "topics": 16289,
    "stars": 10817,
    "header": "这里讨论各种 Python 语言编程话题...",
    "footer": "",
    "avatar_mini": "https://cdn.v2ex.com/navatar/.../90_mini.png?m=...",
    "avatar_normal": "https://cdn.v2ex.com/navatar/.../90_normal.png?m=...",
    "avatar_large": "https://cdn.v2ex.com/navatar/.../90_large.png?m=...",
    "root": false,
    "parent_node_name": "programming",
    "founder_id": 0,
    "aliases": []
  }
]
```

### GET /nodes/show.json

获取单个节点信息。

| 参数 | 说明 |
|------|------|
| `name` | 节点名称（英文，必填） |

**响应**: `V1Node`（结构同上）

### GET /members/show.json

获取用户信息。

| 参数 | 说明 |
|------|------|
| `username` | 用户名（必填） |

**响应**: `V1Member`

```json
{
  "id": 530402,
  "username": "abcfreedom",
  "url": "https://www.v2ex.com/u/abcfreedom",
  "website": "",
  "twitter": null,
  "psn": null,
  "github": null,
  "btc": null,
  "location": "",
  "tagline": "",
  "bio": "",
  "avatar_mini": "https://cdn.v2ex.com/gravatar/...?s=24&d=retro",
  "avatar_normal": "https://cdn.v2ex.com/gravatar/...?s=48&d=retro",
  "avatar_large": "https://cdn.v2ex.com/gravatar/...?s=73&d=retro",
  "created": 1611573803,
  "last_modified": 1770286895,
  "pro": 0,
  "status": "found"
}
```

---

## V2 API（认证接口）

所有请求需携带 Header: `Authorization: Bearer <token>`

响应统一格式：

```json
{
  "success": true,
  "message": "...",
  "result": { /* 具体数据 */ }
}
```

### GET /v2/member

获取当前登录用户信息。

**响应**: `V2Result<V2Member>`

```json
{
  "success": true,
  "result": {
    "id": 530402,
    "username": "abcfreedom",
    "url": "https://www.v2ex.com/u/abcfreedom",
    "website": "",
    "twitter": null,
    "psn": null,
    "github": null,
    "btc": null,
    "location": "",
    "tagline": "",
    "bio": "",
    "avatar_mini": "https://cdn.v2ex.com/avatar/.../530402_mini.png?m=...",
    "avatar_normal": "https://cdn.v2ex.com/avatar/.../530402_normal.png?m=...",
    "avatar_large": "https://cdn.v2ex.com/avatar/.../530402_large.png?m=...",
    "avatar_xlarge": "https://cdn.v2ex.com/avatar/.../530402_xlarge.png?m=...",
    "avatar_xxlarge": "https://cdn.v2ex.com/avatar/.../530402_xxlarge.png?m=...",
    "avatar_xxxlarge": "https://cdn.v2ex.com/avatar/.../530402_xxxlarge.png?m=...",
    "created": 1611573803,
    "last_modified": 1770286895,
    "pro": 0
  }
}
```

> **注意**: V2 的 member 比 V1 多返回 `avatar_xlarge`、`avatar_xxlarge`、`avatar_xxxlarge` 三个大尺寸头像字段。

### GET /v2/token

获取当前 Token 信息。

**响应**: `V2Result<V2Token>`

```json
{
  "success": true,
  "message": "Current token details",
  "result": {
    "token": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "scope": "everything",
    "expiration": 2592000,
    "good_for_days": 30,
    "total_used": 5,
    "last_used": 1771059703,
    "created": 1771059222
  }
}
```

### GET /v2/notifications

获取通知列表。

| 参数 | 说明 |
|------|------|
| `p` | 页码，从 1 开始 |

**响应**: `V2Result<V2Notification[]>`

`message` 字段包含分页信息，格式为 `"Notifications 1-10/2916"`。

```json
{
  "success": true,
  "message": "Notifications 1-10/2916",
  "result": [
    {
      "id": 27148629,
      "member_id": 476345,
      "for_member_id": 530402,
      "text": "<a href=\"/member/ByteMind\" target=\"_blank\"><strong>ByteMind</strong></a> 在 <a href=\"/t/1192792#reply27\" class=\"topic-link\">年前这段时间上班是真的爽</a> 里回复了你",
      "payload": "@roundgis #26 上着呢，还在公司",
      "payload_rendered": "@<a href=\"/member/roundgis\">roundgis</a> #26 上着呢，还在公司",
      "created": 1771059292,
      "member": {
        "username": "ByteMind"
      }
    }
  ]
}
```

**字段说明**:

| 字段 | 说明 |
|------|------|
| `text` | 通知描述 HTML。包含发送者链接和主题链接，如 `<a href="/member/xxx"><strong>xxx</strong></a> 在 <a href="/t/123#reply5" class="topic-link">标题</a> 里回复了你` |
| `payload` | 回复内容纯文本 |
| `payload_rendered` | 回复内容 HTML（@mention 会渲染为链接） |
| `member` | **仅包含 `username` 字段**，无头像信息，需通过 V1 `/members/show.json` 补全 |

**通知类型**（通过 `text` 内容区分）:

| 类型 | text 模式 |
|------|-----------|
| 回复 | `xxx 在 <topic> 里回复了你` |
| 感谢回复 | `xxx 感谢了你在主题 › <topic> 里的回复` |

### GET /v2/topics/:id

获取主题详情。

**响应**: `V2Result<V2Topic>`

```json
{
  "success": true,
  "message": "Topic details found",
  "result": {
    "id": 1192792,
    "title": "年前这段时间上班是真的爽",
    "content": "很多同事休假了...",
    "content_rendered": "<p>很多同事休假了...</p>\n",
    "syntax": 1,
    "url": "https://www.v2ex.com/t/1192792",
    "replies": 27,
    "last_reply_by": "ByteMind",
    "created": 1771036849,
    "last_modified": 1771036849,
    "last_touched": 1771058726,
    "supplements": [],
    "member": {
      "id": 530402,
      "username": "abcfreedom",
      "bio": "",
      "website": "",
      "github": null,
      "url": "https://www.v2ex.com/member/abcfreedom",
      "avatar": "https://cdn.v2ex.com/avatar/.../530402_xxxlarge.png?m=...",
      "created": 1611573803,
      "pro": 0
    },
    "node": {
      "id": 300,
      "founder_id": 0,
      "url": "https://www.v2ex.com/go/programmer",
      "name": "programmer",
      "title": "程序员",
      "header": "While code monkeys are not eating bananas, they're coding.",
      "footer": "",
      "avatar": "https://cdn.v2ex.com/navatar/.../300_xxxlarge.png?m=...",
      "topics": 69738,
      "created": 1293396163,
      "last_modified": 1733731195
    }
  }
}
```

> **V1 vs V2 差异**:
> - V2 Topic 多了 `syntax`、`supplements`、`url` 字段
> - V2 的 `member` 结构不同：只有 `avatar`（单个字段，xxxlarge 尺寸），无 `avatar_mini/normal/large`
> - V2 的 `node` 结构不同：只有 `avatar`（单个字段），无 `avatar_mini/normal/large`，多了 `founder_id`、`created`、`last_modified`

### GET /v2/topics/:id/replies

获取主题回复列表。

| 参数 | 说明 |
|------|------|
| `p` | 页码，从 1 开始 |

**响应**: `V2Result<V2Reply[]>`（每页 20 条）

```json
{
  "success": true,
  "result": [
    {
      "id": 17325823,
      "content": "是的，过年最爽的就是这几天...",
      "content_rendered": "是的，过年最爽的就是这几天...",
      "created": 1771036898,
      "member": {
        "id": 47049,
        "username": "libasten",
        "bio": "",
        "website": "https://www.feidaoboke.com",
        "github": "",
        "url": "https://www.v2ex.com/member/libasten",
        "avatar": "https://cdn.v2ex.com/gravatar/...?s=73&d=retro",
        "created": 1381994119,
        "pro": 0
      }
    }
  ]
}
```

> **V1 vs V2 差异**:
> - V1 Reply 有 `topic_id`、`member_id`、`last_modified` 字段，V2 没有
> - V2 Reply 的 `member` 结构与 V2 Topic 的相同（只有 `avatar`，无 `avatar_mini/normal/large`）
> - V1 每页默认 100 条，V2 每页 20 条

### GET /v2/nodes/:name/topics

获取节点下的主题列表。

| 参数 | 说明 |
|------|------|
| `p` | 页码，从 1 开始 |

**响应**: `V2Result<V2Topic[]>`（每页 20 条，Topic 结构同 V2 Topic，但不含 `member` 和 `node` 子对象）

### POST /v2/topics

创建新主题。

**请求体**:

```json
{
  "title": "主题标题",
  "content": "主题内容",
  "node_name": "programmer",
  "syntax": "markdown"
}
```

**响应**: `V2Result<V2Topic>`

### POST /v2/topics/:id/replies

回复主题。

**请求体**:

```json
{
  "content": "回复内容"
}
```

**响应**: `V2Result<V2Reply>`

### POST /v2/topics/:id/thank

感谢主题。

**响应**: `V2Result<null>`

### POST /v2/replies/:id/thank

感谢回复。

**响应**: `V2Result<null>`

---

## 数据类型对比

### V1 vs V2 的 Member 结构差异

**V1 Member**（完整）:
```
id, username, url, website, twitter, psn, github, btc, location, tagline, bio,
avatar_mini, avatar_normal, avatar_large,
created, last_modified, pro, status
```

**V2 Member**（精简）:
```
id, username, url, bio, website, github,
avatar (单个字段，xxxlarge 尺寸),
created, pro
```

**V2 Notification 的 Member**（最简）:
```
username (仅此一个字段)
```

### V1 vs V2 的 Node 结构差异

**V1 Node**（完整）:
```
id, name, title, title_alternative, url, topics, stars, header, footer,
avatar_mini, avatar_normal, avatar_large,
root, parent_node_name, founder_id, aliases
```

**V2 Node**（精简）:
```
id, name, title, url, topics, header, footer,
avatar (单个字段),
founder_id, created, last_modified
```
