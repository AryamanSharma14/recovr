import {
  Brain,
  ShieldCheck,
  Zap,
  Calendar,
  Moon,
  Smartphone,
  CheckCircle2,
} from 'lucide-react'
import { ago } from '../../lib/format'
import { CopyId } from './CopyId'
import { cn } from '../../lib/utils'
import type { SseEvent } from '../../lib/types'

interface DecisionEventStreamProps {
  events: SseEvent[]
  connected: boolean
  className?: string
  maxHeight?: string
}

function getEventStyle(type: string) {
  switch (type) {
    case 'recovered':
      return {
        icon: CheckCircle2,
        iconColor: 'text-pos',
        bgColor: 'border-pos/30 bg-pos/5',
        badge: 'RECOVERED',
        badgeColor: 'bg-pos/20 text-pos',
      }
    case 'scheduled':
      return {
        icon: Calendar,
        iconColor: 'text-copper',
        bgColor: 'border-copper/30 bg-copper/5',
        badge: 'PAYDAY SNAP',
        badgeColor: 'bg-copper/20 text-copper',
      }
    case 'classified':
      return {
        icon: Brain,
        iconColor: 'text-bone',
        bgColor: 'border-border bg-carbon',
        badge: 'AI TRIAGE',
        badgeColor: 'bg-onyx text-bone',
      }
    case 'hard_stop':
    case 'hard_guard':
    case 'network_cap_block':
      return {
        icon: ShieldCheck,
        iconColor: 'text-neg',
        bgColor: 'border-neg/30 bg-neg/5',
        badge: 'COMPLIANCE GUARD',
        badgeColor: 'bg-neg/20 text-neg',
      }
    case 'rail_routed':
      return {
        icon: Smartphone,
        iconColor: 'text-copper',
        bgColor: 'border-copper/30 bg-copper/5',
        badge: 'CHANNEL ROUTE',
        badgeColor: 'bg-copper/20 text-copper',
      }
    case 'downtime_queued':
    case 'maintenance_window_snap':
      return {
        icon: Moon,
        iconColor: 'text-amber-400',
        bgColor: 'border-amber-500/30 bg-amber-500/5',
        badge: 'MAINTENANCE HOLD',
        badgeColor: 'bg-amber-500/20 text-amber-300',
      }
    default:
      return {
        icon: Zap,
        iconColor: 'text-fog',
        bgColor: 'border-border bg-carbon',
        badge: type.toUpperCase().replace(/_/g, ' '),
        badgeColor: 'bg-carbon text-fog',
      }
  }
}

const FALLBACK_EVENTS: SseEvent[] = [
  {
    ts: '2026-09-29T10:00:00.000Z',
    type: 'classified',
    payment_id: 'pay_rec_soft_01',
    summary: 'Failure Analyzed: insufficient_funds → SOFT classification',
  },
  {
    ts: '2026-09-29T10:00:01.000Z',
    type: 'scheduled',
    payment_id: 'pay_rec_soft_01',
    summary: 'ML 240h scan selected Friday 10:00 AM (Payday snap, 84% score)',
  },
  {
    ts: '2026-09-29T10:00:02.000Z',
    type: 'maintenance_window_snap',
    payment_id: 'pay_rec_soft_01',
    summary: 'HDFC nocturnal maintenance window 23:30–01:00 cleared',
  },
  {
    ts: '2026-09-29T10:00:03.000Z',
    type: 'rail_routed',
    payment_id: 'pay_rec_soft_01',
    summary: 'Rerouted Card → UPI Autopay on WhatsApp (higher 1-tap conversion)',
  },
  {
    ts: '2026-09-29T10:00:04.000Z',
    type: 'recovered',
    payment_id: 'pay_rec_soft_01',
    summary: 'Payment recovered for ₹1,499 (Cult.fit membership rescued)',
  },
]

export function DecisionEventStream({
  events,
  connected,
  className,
  maxHeight = 'max-h-[32rem]',
}: DecisionEventStreamProps) {
  const displayEvents: SseEvent[] = events.length > 0 ? events : FALLBACK_EVENTS

  return (
    <div className={cn('rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4', className)}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-pos animate-pulse' : 'bg-neg'}`} />
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-copper">
              Real-Time SSE Decision Event Bus
            </span>
          </div>
          <h3 className="font-serif text-base font-bold text-paper mt-0.5">
            Autonomous Micro-Decision Stream
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Every autonomous classification, timing evaluation, maintenance lock, and recovery event emitted in real-time.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="font-mono text-[11px] font-semibold text-paper">
            {displayEvents.length} events logged
          </span>
        </div>
      </div>

      {/* Scrolling Stream Console */}
      <div className={cn('space-y-2.5 overflow-y-auto pr-1 font-mono text-xs', maxHeight)}>
        {displayEvents.map((ev, i) => {
          const style = getEventStyle(ev.type)
          const Icon = style.icon
          const timeString = new Date(ev.ts).toLocaleTimeString('en-IN', { hour12: false })

          return (
            <div
              key={`${ev.ts}-${i}`}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-3 transition-all hover:border-steel/80',
                style.bgColor
              )}
            >
              <div className={cn('mt-0.5 shrink-0', style.iconColor)}>
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-text-faint">[{timeString}]</span>
                    <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider', style.badgeColor)}>
                      {style.badge}
                    </span>
                    <CopyId id={ev.payment_id} truncate={12} linkTo={ev.payment_id !== 'system' ? `/payment/${ev.payment_id}` : undefined} />
                  </div>
                  <span className="text-[10px] text-text-faint">{ago(ev.ts)}</span>
                </div>

                <div className="font-sans text-[12px] font-medium text-paper leading-snug">
                  {ev.summary || `${ev.type.replace(/_/g, ' ')} for ${ev.payment_id}`}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
