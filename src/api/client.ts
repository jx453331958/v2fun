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
  return res.json()
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

  createTopic: (data: { title: string; content: string; node_name: string; syntax?: string }) =>
    request<V2Result<V2Topic>>('/v2/topics', {
      method: 'POST',
      body: JSON.stringify({ syntax: 'markdown', ...data }),
    }),

  replyTopic: (topicId: number, content: string) =>
    request<V2Result<V2Reply>>(`/v2/topics/${topicId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  thankTopic: (topicId: number) =>
    request<V2Result<null>>(`/v2/topics/${topicId}/thank`, {
      method: 'POST',
    }),

  thankReply: (replyId: number) =>
    request<V2Result<null>>(`/v2/replies/${replyId}/thank`, {
      method: 'POST',
    }),
}
