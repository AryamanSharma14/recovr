import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RotateCcw,
  HelpCircle,
  Volume2,
  VolumeX,
  Terminal,
  Globe,
} from 'lucide-react'
import { api } from '../../lib/api'
import { useVerdict } from '../common/VerdictBanner'
import { IntegrationModal } from '../common/IntegrationModal'
import { isSoundEnabled, setSoundEnabled, sound } from '../../lib/sound'
import { cn } from '../../lib/utils'

interface TopBarProps {
  onOpenShortcuts: () => void
  onOpenTerminal?: () => void
}

export function TopBar({
  onOpenShortcuts,
  onOpenTerminal,
}: TopBarProps) {
  const qc = useQueryClient()
  const { showVerdict } = useVerdict()
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled())
  const [isIntegrationOpen, setIsIntegrationOpen] = useState(false)

  const handleToggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    setSoundEnabled(next)
    if (next) sound.chime()
  }

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

  const handleReset = () => {
    sound.click()
    if (window.confirm('Reset sandbox data? This will clear active events and audit trail.')) {
      resetMutation.mutate()
    }
  }

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-surface/90 backdrop-blur-md px-6 z-30">
        {/* Left: Clean App Branding */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-copper/20 border border-copper/40 text-copper font-serif font-bold text-sm"
            title="recovr — Autonomous Revenue Recovery Engine"
          >
            R
          </div>
          <span
            className="font-serif text-[15px] font-bold tracking-tight text-paper"
          >
            recovr
          </span>
          <span className="text-[11px] text-text-faint font-mono hidden sm:inline">
            Revenue Recovery Engine
          </span>

          <div
            className="flex items-center gap-1.5 rounded-full border border-border/80 bg-onyx px-2.5 py-0.5 text-[11px] font-medium text-pos"
            title="Engine active and listening for payment failure webhooks."
          >
            <span className="h-1.5 w-1.5 rounded-full bg-pos animate-pulse" />
            <span>Active</span>
          </div>

          <div
            className="hidden md:flex items-center rounded-full border border-copper/30 bg-copper/10 px-2 py-0.5 text-[10px] font-mono font-bold text-copper"
            title="Environment: Sandbox Mode"
          >
            SANDBOX
          </div>
        </div>

        {/* Right: Operational Controls */}
        <div className="flex items-center gap-2">
          {/* Gateway Integration Hub */}
          <button
            type="button"
            onClick={() => {
              sound.click()
              setIsIntegrationOpen(true)
            }}
            className="flex items-center gap-1.5 rounded-full border border-border bg-carbon px-3 py-1 text-xs font-medium text-bone hover:border-copper hover:text-paper transition-colors cursor-pointer"
            title="Gateway Webhook Integration & API Keys"
          >
            <Globe className="h-3.5 w-3.5 text-copper" />
            <span>Gateway Webhook</span>
            <span className="text-[10px] text-pos font-mono font-semibold">LIVE</span>
          </button>

          {/* Agent Terminal Drawer */}
          {onOpenTerminal && (
            <button
              type="button"
              onClick={() => {
                sound.click()
                onOpenTerminal()
              }}
              className="flex items-center gap-1.5 rounded-full border border-border bg-carbon px-3 py-1 text-xs font-medium text-bone hover:border-steel hover:text-paper transition-colors cursor-pointer"
              title="Open real-time event telemetry stream (Press T)"
            >
              <Terminal className="h-3.5 w-3.5 text-copper" />
              <span>Event Stream</span>
              <kbd className="rounded bg-onyx px-1 py-0.2 font-mono text-[9px] text-text-faint">T</kbd>
            </button>
          )}

          <div className="h-4 w-px bg-border mx-1" />

          {/* Audio Effects Toggle */}
          <button
            type="button"
            onClick={handleToggleSound}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full border transition-colors cursor-pointer',
              soundOn
                ? 'border-copper/60 bg-copper/15 text-copper'
                : 'border-border bg-carbon text-text-faint hover:border-steel hover:text-bone'
            )}
            title={soundOn ? 'Sound Effects Enabled (Click to Mute)' : 'Sound Effects Muted (Click to Enable)'}
          >
            {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>

          {/* Reset Sandbox Data */}
          <button
            type="button"
            onClick={handleReset}
            disabled={resetMutation.isPending}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-carbon text-text-muted hover:border-copper hover:text-copper transition-colors disabled:opacity-40 cursor-pointer"
            title="Reset Sandbox Data: Clears sandbox transactions and resets audit logs (Press R)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          {/* Shortcuts Help */}
          <button
            type="button"
            onClick={() => {
              sound.click()
              onOpenShortcuts()
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-carbon text-text-muted hover:border-steel hover:text-paper transition-colors cursor-pointer"
            title="Keyboard Shortcuts (Press ?)"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <IntegrationModal
        isOpen={isIntegrationOpen}
        onClose={() => setIsIntegrationOpen(false)}
      />
    </>
  )
}
