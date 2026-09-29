import { useEffect } from 'react'

export interface HotkeyHandlers {
  onToggleTerminal?: () => void
  onOpenWorkbench?: () => void
  onResetData?: () => void
  onShowShortcuts?: () => void
  onEscape?: () => void
}

export function useHotkeys(handlers: HotkeyHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)

      if (e.key === 'Escape') {
        handlers.onEscape?.()
        return
      }

      if (isInput || e.metaKey || e.ctrlKey || e.altKey) {
        return
      }

      switch (e.key.toLowerCase()) {
        case 't':
          e.preventDefault()
          handlers.onToggleTerminal?.()
          break
        case 'w':
        case 'd':
          e.preventDefault()
          handlers.onOpenWorkbench?.()
          break
        case 'r':
          e.preventDefault()
          handlers.onResetData?.()
          break
        case '?':
          e.preventDefault()
          handlers.onShowShortcuts?.()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlers])
}
