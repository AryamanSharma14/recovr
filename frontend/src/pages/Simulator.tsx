import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Wrench,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  Zap,
  Activity,
  RefreshCw,
  BellRing,
  Send,
} from 'lucide-react'
import { api } from '../lib/api'
import { ago } from '../lib/format'
import { useSseFeed } from '../lib/useSse'
import { Card, CardTitle, PageHeader, Button } from '../components/common/primitives'
import { AuditActionBadge } from '../components/common/badges'
import { CopyId } from '../components/common/CopyId'
import { useVerdict } from '../components/common/VerdictBanner'
import { GlowBackdrop } from '../components/reactbits/GlowBackdrop'
import { LiveBeacon } from '../components/reactbits/LiveBeacon'
import { sound } from '../lib/sound'
import { cn } from '../lib/utils'
import type { ScenarioId, SimulateResult } from '../lib/types'

const SCENARIOS: { id: ScenarioId; label: string; desc: string; expects: string; icon: React.ComponentType<{ className?: string }> }[] = [
  {
    id: 'soft',
    label: 'Transient Decline (Insufficient Funds)',
    desc: 'Customer instrument reports low balance. ML evaluates 240-hour recovery horizon, snaps to salary liquidity window, and schedules multi-rail fallback.',
    expects: 'ML snaps to salary day → WhatsApp UPI link provisioned → recovery attempt',
    icon: Sparkles,
  },
  {
    id: 'cau_refresh',
    label: 'Card Account Updater (CAU) Token Refresh',
    desc: 'An expired card on a supported issuing network triggers automated TSP tokenization (Visa VTS / Mastercard MDES) to refresh credential without customer disruption.',
    expects: 'Network token refreshed → tokenized retry scheduled',
    icon: RefreshCw,
  },
  {
    id: 'rbi_predebit',
    label: 'RBI 24h e-Mandate Pre-Debit Alert',
    desc: 'Generates compliant 24-hour advance pre-debit notifications (PND) with DLT-registered templates per RBI recurring subscription guidelines.',
    expects: 'RBI 24h pre-debit notice logged & dispatched via DLT template',
    icon: BellRing,
  },
  {
    id: 'hard',
    label: 'Permanent Terminal Decline (Visa Cat-1)',
    desc: 'An unrecoverable instrument (closed account, stolen card). The compliance shield halts retries immediately with 0 re-attempts, preventing network penalties.',
    expects: 'Immediate halt with 0 retries (Visa Category-1 & MC TPE shield)',
    icon: ShieldAlert,
  },
  {
    id: 'downtime',
    label: 'Bank Infrastructure Core Outage',
    desc: 'Bank gateway goes offline. recovr safely parks all affected transactions in an infrastructure hold queue, then auto-drains immediately when downtime resolves.',
    expects: 'Parked in outage hold queue → auto-drained on resolution',
    icon: AlertTriangle,
  },
  {
    id: 'card_testing',
    label: 'Fraud Burst (Card-Testing Defense)',
    desc: 'Same instrument attempts rapid checkout bursts. recovr enforces 24-hour minimum credential spacing to prevent fraud velocity spikes.',
    expects: 'Blocked: anti-fraud 24-hour spacing rule enforced',
    icon: ShieldAlert,
  },
  {
    id: 'trajectory',
    label: 'Escalating Decline Trajectory',
    desc: 'A checkout fails with escalating severity across attempts. Proactively halts automated retries rather than fatiguing the customer or incurring issuer penalties.',
    expects: 'Blocked: escalating failure trajectory halted',
    icon: Activity,
  },
  {
    id: 'ev_negative',
    label: 'Micro-Charge (Negative Expected Value)',
    desc: 'A ₹0.01 micro-transaction where channel dispatch costs (₹0.35) exceed expected recovery GMV. The EV gate aborts execution to protect net margin.',
    expects: 'Skipped: EV = (p * amt) - cost <= 0 logged to audit ledger',
    icon: Zap,
  },
  {
    id: 'payday',
    label: 'Govt & PSU Payday Alignment',
    desc: 'Government employee cardholders receive salary on the 7th. recovr snaps retries to the 7th salary credit window for PSU issuers (SBI, PNB, BOB).',
    expects: 'Snapped to PSU salary credit cycle (7th of month)',
    icon: Sparkles,
  },
]

export default function Simulator() {
  const qc = useQueryClient()
  const { showVerdict } = useVerdict()
  const [scenario, setScenario] = useState<ScenarioId>('soft')
  const [count, setCount] = useState(3)
  const [advance, setAdvance] = useState(true)
  const [result, setResult] = useState<SimulateResult | null>(null)
  const { events, connected } = useSseFeed(40)

  const invalidateAll = () => qc.invalidateQueries()

  const sim = useMutation({
    mutationFn: () => api.simulate({ scenario, count, advance_hours: advance ? 6 : 0 }),
    onSuccess: (r) => {
      setResult(r)
      invalidateAll()
      const isHard = scenario === 'hard'
      const isEv = scenario === 'ev_negative'
      const createdCount = Array.isArray(r?.created) ? r.created.length : 0
      sound.success()
      showVerdict({
        type: isHard ? 'blocked' : isEv ? 'skipped' : 'recovered',
        title: `EVENT DISPATCHED: ${scenario.toUpperCase()}`,
        detail: `Dispatched ${createdCount} webhook payloads; ${r.events_emitted} decision events emitted on telemetry stream.`,
      })
    },
  })

  const reset = useMutation({
    mutationFn: () => api.simulateReset(),
    onSuccess: () => {
      setResult(null)
      invalidateAll()
      sound.chime()
      showVerdict({
        type: 'info',
        title: 'SANDBOX RESET',
        detail: 'Sandbox transactions and audit records have been cleared.',
      })
    },
  })

  return (
    <div className="relative space-y-6 max-w-7xl mx-auto pb-12">
      <GlowBackdrop color="copper" />

      <PageHeader
        title="Developer Event Workbench"
        sub="Dispatch synthetic gateway webhook events and test pipeline behavior against compliance rules, ML timing, and multi-rail routing."
        action={
          <Button
            variant="default"
            onClick={() => {
              sound.click()
              reset.mutate()
            }}
            disabled={reset.isPending}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Clear Sandbox Events</span>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card className="p-6">
            <CardTitle>
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-copper" />
                <span>Select Event Payload Template</span>
              </div>
            </CardTitle>
            <div className="space-y-2.5">
              {SCENARIOS.map((s) => {
                const Icon = s.icon
                const isSelected = scenario === s.id
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      sound.click()
                      setScenario(s.id)
                    }}
                    className={cn(
                      'relative cursor-pointer rounded-2xl border p-4 transition-all duration-200 shadow-xs overflow-hidden',
                      isSelected
                        ? 'border-copper/70 bg-carbon text-paper shadow-md scale-[1.005]'
                        : 'border-border/70 bg-surface text-text-muted hover:border-steel hover:text-bone hover:bg-surface-hover'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-lg',
                          isSelected ? 'bg-copper/20 text-copper' : 'bg-onyx text-text-faint'
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-bold text-paper">{s.label}</span>
                      </div>
                      <span className="font-mono text-[10px] text-text-faint uppercase font-bold bg-onyx px-2 py-0.5 rounded-full border border-border/40">{s.id}</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-text-muted">{s.desc}</p>
                    <div className="mt-2.5 rounded-lg bg-onyx/80 border border-border/50 px-2.5 py-1.5 text-[11px] text-copper font-medium flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 shrink-0" />
                      <span>Expected: {s.expects}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-text-muted">
                  <span>Batch Size:</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={count}
                    onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value))))}
                    className="w-16 rounded-xl border border-border bg-onyx px-2.5 py-1 font-mono text-xs text-paper outline-none focus:border-copper"
                  />
                </label>

                <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={advance}
                    onChange={(e) => setAdvance(e.target.checked)}
                    className="accent-copper rounded"
                  />
                  <span>Auto-advance recovery lifecycle</span>
                </label>
              </div>

              <Button
                variant="primary"
                onClick={() => {
                  sound.click()
                  sim.mutate()
                }}
                disabled={sim.isPending}
              >
                <Send className="h-3.5 w-3.5" />
                <span>{sim.isPending ? 'Dispatching…' : `Dispatch ${count} Webhook Events`}</span>
              </Button>
            </div>

            {sim.isError && (
              <p className="mt-3 text-xs text-copper font-medium">
                {String((sim.error as Error)?.message ?? sim.error)}
              </p>
            )}

            {result && Array.isArray(result.created) && (
              <div className="mt-4 rounded-xl border border-pos/40 bg-pos/10 p-4 space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5 text-xs font-bold text-pos">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>✓ {result.created.length} webhooks ingested · {result.events_emitted} telemetry events emitted</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {result.created.map((pid) => (
                    <CopyId
                      key={pid}
                      id={pid}
                      truncate={18}
                      linkTo={`/payment/${pid}`}
                      className="rounded-full bg-onyx px-2.5 py-1 border border-border/80"
                    />
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        <Card className="p-6">
          <CardTitle
            action={
              <LiveBeacon
                status={connected ? 'active' : 'offline'}
                label={connected ? 'Telemetry Live' : 'Disconnected'}
                size="sm"
              />
            }
          >
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-copper" />
              <span>Real-Time Decision Stream</span>
            </div>
          </CardTitle>
          {events.length === 0 ? (
            <p className="py-16 text-center text-xs text-text-muted">
              No events received yet. Dispatch a webhook event to inspect the live autonomous decision pipeline.
            </p>
          ) : (
            <div className="space-y-2 max-h-[38rem] overflow-y-auto pr-1">
              {[...events].reverse().map((ev, i) => (
                <div
                  key={`${ev.ts}-${i}`}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-carbon p-3.5 shadow-xs transition-colors hover:border-steel"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <AuditActionBadge action={ev.type} />
                      <CopyId
                        id={ev.payment_id}
                        truncate={16}
                        linkTo={ev.payment_id !== 'system' ? `/payment/${ev.payment_id}` : undefined}
                      />
                    </div>
                    {ev.summary && (
                      <p className="text-xs text-text-muted leading-relaxed font-sans">{ev.summary}</p>
                    )}
                  </div>
                  <span className="font-mono text-[10px] text-text-faint shrink-0">{ago(ev.ts)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
