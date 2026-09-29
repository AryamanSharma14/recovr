import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Sidebar } from './components/shell/Sidebar'
import { TopBar } from './components/shell/TopBar'
import { DateRangeProvider } from './lib/dateRange'
import { VerdictProvider, VerdictBanner, useVerdict } from './components/common/VerdictBanner'
import { ShortcutsModal } from './components/common/ShortcutsModal'
import { AgentTerminalDrawer } from './components/common/AgentTerminalDrawer'
import { useHotkeys } from './lib/useHotkeys'
import { api } from './lib/api'
import { sound } from './lib/sound'

function AppContent() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { showVerdict } = useVerdict()

  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const [isTerminalOpen, setIsTerminalOpen] = useState(false)

  const resetMutation = useMutation({
    mutationFn: api.simulateReset,
    onSuccess: () => {
      qc.invalidateQueries()
      sound.chime()
      showVerdict({
        type: 'info',
        title: 'DATA RESET',
        detail: 'Sandbox payments and audit records have been cleared.',
      })
    },
  })

  useHotkeys({
    onToggleTerminal: () => {
      sound.click()
      setIsTerminalOpen((prev) => !prev)
    },
    onOpenWorkbench: () => navigate('/workbench'),
    onResetData: () => {
      if (window.confirm('Reset sandbox data? This will clear active events and audit logs.')) {
        resetMutation.mutate()
      }
    },
    onShowShortcuts: () => setIsShortcutsOpen(true),
    onEscape: () => {
      setIsShortcutsOpen(false)
      setIsTerminalOpen(false)
    },
  })

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">
        <TopBar
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenTerminal={() => setIsTerminalOpen(true)}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-8 py-6">
          <VerdictBanner />
          <Outlet />
        </main>
      </div>

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <AgentTerminalDrawer
        isOpen={isTerminalOpen}
        onClose={() => setIsTerminalOpen(false)}
      />
    </div>
  )
}

export function AppLayout() {
  return (
    <DateRangeProvider>
      <VerdictProvider>
        <AppContent />
      </VerdictProvider>
    </DateRangeProvider>
  )
}
