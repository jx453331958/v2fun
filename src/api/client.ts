import type { V2Topic, V2Reply, V2Member, V2Node, V2Notification, V2Token } from '../types'

const BASE = '/api'

function getToken(): string | null {
  return localStorage.getItem('v2fun_token')
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    throw new Error(res.status === 401 ? '认证失败，请重新登录' :
      res.status === 403 ? '无权限访问' :
      res.status >= 500 ? '服务暂时不可用，请稍后重试' :
      `请求失败 (${res.status})`)
  }
  const data = await res.json()
  // V2 API may return 200 with { success: false, message: "..." }
  if (data && data.success === false && data.message) {
    throw new Error(data.message)
  }
  return data
}

// V1 API - public endpoints
export const v1 = {
  hotTopics: () => request<V2Topic[]>('/topics/hot.json'),
  latestTopics: () => request<V2Topic[]>('/topics/latest.json'),
  topicById: (id: number) => request<V2Topic[]>(`/topics/show.json?id=${id}`),
  topicsByNode: (node: string) => request<V2Topic[]>(`/topics/show.json?node_name=${node}`),
  topicsByUser: (username: string) => request<V2Topic[]>(`/topics/show.json?username=${username}`),
  replies: (topicId: number, page = 1) =>
    request<V2Reply[]>(`/replies/show.json?topic_id=${topicId}&page=${page}&page_size=100`),
  allNodes: () => request<V2Node[]>('/nodes/all.json'),
  nodeInfo: (name: string) => request<V2Node>('/nodes/show.json?name=' + name),
  memberInfo: (username: string) => request<V2Member>('/members/show.json?username=' + username),
}

// V2 API - authenticated endpoints
interface V2Result<T> {
  success: boolean
  message?: string
  result: T
}

export const v2 = {
  member: () => request<V2Result<V2Member>>('/v2/member'),
  token: () => request<V2Result<V2Token>>('/v2/token'),
  notifications: (page = 1) =>
    request<V2Result<V2Notification[]>>(`/v2/notifications?p=${page}`),

  topicDetail: (id: number) => request<V2Result<V2Topic>>(`/v2/topics/${id}`),
  topicReplies: (id: number, page = 1) =>
    request<V2Result<V2Reply[]>>(`/v2/topics/${id}/replies?p=${page}`),

  nodeTopics: (nodeName: string, page = 1) =>
    request<V2Result<V2Topic[]>>(`/v2/nodes/${nodeName}/topics?p=${page}`),
}

// V2EX web URL helpers (for actions that require web session)
export function getTopicWebUrl(id: number) {
  return `https://www.v2ex.com/t/${id}`
}

export function getNewTopicWebUrl() {
  return 'https://www.v2ex.com/new'
}

// Web operations via server proxy (cookie-based)
interface WebResult {
  success: boolean
  error?: string
  message?: string
}

export const web = {
  getCookieStatus: () =>
    fetch('/auth/cookie', { credentials: 'same-origin' }).then(r => r.json()) as Promise<{ hasCookie: boolean }>,

  saveCookie: (cookie: string) =>
    fetch('/auth/cookie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ cookie }),
    }).then(r => r.json()) as Promise<WebResult>,

  clearCookie: () =>
    fetch('/auth/cookie', {
      method: 'DELETE',
      credentials: 'same-origin',
    }).then(r => r.json()) as Promise<WebResult>,

  reply: (topicId: number, content: string) =>
    fetch('/web/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ topicId, content }),
    }).then(r => r.json()) as Promise<WebResult>,

  thankTopic: (topicId: number) =>
    fetch(`/web/thank/topic/${topicId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    }).then(r => r.json()) as Promise<WebResult>,

  thankReply: (replyId: number, topicId: number) =>
    fetch(`/web/thank/reply/${replyId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ topicId }),
    }).then(r => r.json()) as Promise<WebResult>,
}
