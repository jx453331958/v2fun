import { useCallback, useEffect, useState } from 'react'

const KEY = 'v2fun:blocked-nodes'
// Fires within the same tab when the blocklist changes. The native `storage`
// event only fires in *other* tabs, so we need a manual channel for in-tab
// components (TopicCard mutates → Home/Profile must re-render).
const CHANGE_EVENT = 'v2fun:blocked-nodes-changed'

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

export function useBlockedNodes() {
  const [blockedNodes, setBlockedNodes] = useState<string[]>(read)

  useEffect(() => {
    const refresh = () => setBlockedNodes(read())
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) refresh() }
    window.addEventListener('storage', onStorage)
    window.addEventListener(CHANGE_EVENT, refresh)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(CHANGE_EVENT, refresh)
    }
  }, [])

  const blockNode = useCallback((name: string) => {
    if (!name) return
    const current = read()
    if (current.includes(name)) return
    write([...current, name])
  }, [])

  const unblockNode = useCallback((name: string) => {
    const current = read()
    if (!current.includes(name)) return
    write(current.filter((n) => n !== name))
  }, [])

  const isBlocked = useCallback(
    (name: string | undefined | null) => !!name && blockedNodes.includes(name),
    [blockedNodes],
  )

  return { blockedNodes, blockNode, unblockNode, isBlocked }
}
