/**
 * Fix V2EX avatar URLs that use protocol-relative format (//cdn.v2ex.com/...).
 */
export function fixAvatarUrl(url: string | undefined): string {
  if (!url) return ''
  if (url.startsWith('//')) return `https:${url}`
  return url
}
