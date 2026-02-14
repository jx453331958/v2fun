/**
 * Fix V2EX avatar URLs that use protocol-relative format (//cdn.v2ex.com/...).
 * Also handles other common avatar URL edge cases from V2EX API.
 */
export function fixAvatarUrl(url: string | undefined | null): string {
  if (!url) return ''
  if (url.startsWith('//')) return `https:${url}`
  return url
}
