export interface V2Member {
  id: number
  username: string
  url: string
  website: string
  twitter: string
  psn: string
  github: string
  btc: string
  location: string
  tagline: string
  bio: string
  avatar_mini: string
  avatar_normal: string
  avatar_large: string
  avatar: string
  created: number
}

export interface V2Node {
  id: number
  name: string
  url: string
  title: string
  title_alternative: string
  topics: number
  stars: number
  header: string
  footer: string
  avatar: string
  avatar_mini: string
  avatar_normal: string
  avatar_large: string
}

export interface V2Topic {
  id: number
  title: string
  url: string
  content: string
  content_rendered: string
  syntax: number
  replies: number
  member: V2Member
  node: V2Node
  created: number
  last_modified: number
  last_touched: number
  last_reply_by: string
}

export interface V2Reply {
  id: number
  content: string
  content_rendered: string
  member: V2Member
  created: number
  topic_id: number
  thanked: boolean
  thanks: number
}

export interface V2Notification {
  id: number
  member_id: number
  for_member_id: number
  text: string
  payload: string
  payload_rendered: string
  created: number
  member: V2Member
}

export interface V2Token {
  token: string
  scope: string
  expiration: number
  good_for_days: number
  total_used: number
  last_used: number
  created: number
}
