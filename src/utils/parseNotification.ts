interface NotificationTarget {
  topicId: number
  replyFloor?: number
}

/**
 * Parse a notification's payload_rendered HTML to extract the topic ID and optional reply floor.
 * V2EX notification links look like: /t/123456#reply45
 */
export function parseNotification(payloadRendered: string): NotificationTarget | null {
  // Match /t/{topicId} with optional #reply{floor}
  const match = payloadRendered.match(/\/t\/(\d+)(?:#reply(\d+))?/)
  if (!match) return null
  return {
    topicId: parseInt(match[1], 10),
    replyFloor: match[2] ? parseInt(match[2], 10) : undefined,
  }
}

interface ParsedTopicLink {
  type: 'topic'
  topicId: number
  replyFloor?: number
}

interface ParsedMemberLink {
  type: 'member'
  username: string
}

type ParsedLink = ParsedTopicLink | ParsedMemberLink

/**
 * Parse an href from notification HTML to determine navigation target.
 */
export function parseNotificationLink(href: string): ParsedLink | null {
  // Topic link: /t/123456 or /t/123456#reply45
  const topicMatch = href.match(/\/t\/(\d+)(?:#reply(\d+))?/)
  if (topicMatch) {
    return {
      type: 'topic',
      topicId: parseInt(topicMatch[1], 10),
      replyFloor: topicMatch[2] ? parseInt(topicMatch[2], 10) : undefined,
    }
  }

  // Member link: /member/username
  const memberMatch = href.match(/\/member\/([^/?#]+)/)
  if (memberMatch) {
    return { type: 'member', username: memberMatch[1] }
  }

  return null
}
