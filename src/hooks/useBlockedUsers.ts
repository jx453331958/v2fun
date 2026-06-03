import { useCallback, useEffect, useState } from 'react'

const KEY = 'v2fun:blocked-users'
// Fires within the same tab when the blocklist changes. The native `storage`
// event only fires in *other* tabs, so we need a manual channel for in-tab
// components (TopicCard mutates → Home/Profile must re-render).
const CHANGE_EVENT = 'v2fun:blocked-users-changed'

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function write(list: string[]) {
  localStorage.setItem(KEY, JSON.stringify(list))
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}

export function useBlockedUsers() {
  const [blockedUsers, setBlockedUsers] = useState<string[]>(read)

  useEffect(() => {
    const refresh = () => setBlockedUsers(read())
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) refresh() }
    window.addEventListener('storage', onStorage)
    window.addEventListener(CHANGE_EVENT, refresh)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(CHANGE_EVENT, refresh)
    }
  }, [])

  const blockUser = useCallback((username: string) => {
    if (!username) return
    const current = read()
    if (current.includes(username)) return
    write([...current, username])
  }, [])

  const unblockUser = useCallback((username: string) => {
    const current = read()
    if (!current.includes(username)) return
    write(current.filter((n) => n !== username))
  }, [])

  const isBlocked = useCallback(
    (username: string | undefined | null) => !!username && blockedUsers.includes(username),
    [blockedUsers],
  )

  return { blockedUsers, blockUser, unblockUser, isBlocked }
}
