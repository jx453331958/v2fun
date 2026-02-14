import DOMPurify from 'dompurify'

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Used for all server-rendered HTML (content_rendered, payload_rendered, node headers).
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty)
}
