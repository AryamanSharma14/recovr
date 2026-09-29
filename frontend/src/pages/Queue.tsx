import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, XCircle, Download, AlertTriangle, Layers, Brain, ChevronDown, ChevronRight, Zap } from 'lucide-react'
import { api } from '../lib/api'
import { qk } from '../lib/queryKeys'
import { inr, pct, dt, ago } from '../lib/format'
import { useDateRange } from '../lib/dateRange'
import { Card, CardTitle, PageHeader, Table, Td, Tr, Button } from '../components/common/primitives'
import { QueryBoundary, EmptyState } from '../components/common/states'
import { RailPill } from '../components/common/badges'
import { CopyId } from '../components/common/CopyId'
import { exportCsv } from '../lib/exportCsv'
import { Modal } from '../components/common/Modal'
import { DecisionCard } from '../components/common/DecisionCard'
import { GlowBackdrop } from '../components/reactbits/GlowBackdrop'
import { LiveBeacon } from '../components/reactbits/LiveBeacon'
import { sound } from '../lib/sound'
import { cn } from '../lib/utils'
import type { PendingRetry } from '../lib/types'

export default function Queue() {
  const qc = useQueryClient()
  const { fromDate, toDate, rangeKey } = useDateRange()

  const stats = useQuery({
    queryKey: qk.stats(rangeKey),
    queryFn: () => api.stats(fromDate, toDate),
  })

  const downtime = useQuery({
    queryKey: qk.downtime(),
    queryFn: () => api.downtime(),
    refetchInterval: 5000,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['stats'] })
    qc.invalidateQueries({ queryKey: ['downtime'] })
  }

  const force = useMutation({
    mutationFn: api.forceRetry,
    onSuccess: () => {
      sound.success()
      invalidate()
    },
  })
  const cancel = useMutation({
    mutationFn: api.cancelRetry,
    onSuccess: () => {
      sound.chime()
      invalidate()
    },
  })

  // Drill-down decision modal
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null)
  const paymentDetail = useQuery({
    queryKey: qk.payment(selectedPaymentId || ''),
    queryFn: () => api.payment(selectedPaymentId || ''),
    enabled: Boolean(selectedPaymentId),
  })

  // Expanded reasoning row
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const handleExportCsv = () => {
    if (!stats.data?.pending_retries) return
    exportCsv(
      'pending_recovery_queue',
      [
        { key: 'payment_id', label: 'Payment ID' },
        { key: 'amount_inr', label: 'Amount (INR)' },
        { key: 'chosen_rail', label: 'Payment Method' },
        { key: 'retry_at', label: 'Scheduled Time' },
        { key: 'confidence', label: 'ML Confidence', format: (v) => `${((Number(v) || 0) * 100).toFixed(1)}%` },
        { key: 'classify_reason', label: 'Failure Reason' },
        { key: 'human_reasoning', label: 'AI Reasoning' },
      ],
      stats.data.pending_retries
    )
  }

  return (
    <div className="relative space-y-6 max-w-7xl mx-auto pb-12">
      <GlowBackdrop color="copper" />

      <PageHeader
        title="Recovery Queue"
        sub="Payments scheduled for intelligent retry — each timed by the ML model based on customer payment patterns."
        action={
          <Button
            variant="default"
            onClick={handleExportCsv}
            disabled={!stats.data?.pending_retries?.length}
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </Button>
        }
      />

      {/* 1. Pending Retries — Real Data */}
      <QueryBoundary query={stats} skeletonRows={6}>
        {(s) => {
          const retries = s.pending_retries || []
          const uniqueTimes = new Set(retries.map((p: PendingRetry) => p.retry_day_label || '')).size
          const nextRetry = retries[0]
          const avgConfidence = retries.length > 0
            ? retries.reduce((sum: number, p: PendingRetry) => sum + (p.confidence || 0), 0) / retries.length
            : 0

          return (
            <>
              {/* Dynamic Summary */}
              {retries.length > 0 && (
                <div className="relative overflow-hidden rounded-2xl border border-copper/40 bg-gradient-to-r from-copper/10 via-surface to-copper/10 p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-copper/15 text-copper shadow-xs">
                        <Brain className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-paper flex items-center gap-2">
                          <span>Tracking {retries.length} payment{retries.length !== 1 ? 's' : ''} across {uniqueTimes} unique retry window{uniqueTimes !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="text-xs text-text-muted mt-0.5">
                          Average ML recovery probability: <strong className="text-paper">{pct(avgConfidence * 100)}</strong>
                          {nextRetry?.retry_day_label && (
                            <> · Next retry fires <strong className="text-copper">{nextRetry.retry_day_label}</strong></>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <LiveBeacon status="active" label="Scheduler Online" size="sm" />
                    </div>
                  </div>
                </div>
              )}

              <Card className="p-6">
                <CardTitle
                  action={
                    <span className="text-xs text-text-muted font-mono font-semibold">
                      {retries.length} scheduled in queue
                    </span>
                  }
                >
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-copper" />
                    <span>Intelligent Scheduled Retries</span>
                  </div>
                </CardTitle>
                {retries.length === 0 ? (
                  <EmptyState message="No pending retries — every temporary failure has been processed or recovered." />
                ) : (
                  <div className="space-y-2">
                    {retries.map((p: PendingRetry) => {
                      const pid = p.payment_id
                      const isExpanded = expandedRow === pid
                      const confidence = p.confidence ?? 0
                      const confPct = pct(confidence * 100)
                      const retryLabel = p.retry_day_label || (p.retry_at ? dt(p.retry_at) : '—')
                      const reasoning = p.human_reasoning || ''
                      const issuer = p.card_issuer || 'Bank'
                      const errorReason = p.error_reason || p.classify_reason || ''

                      return (
                        <div
                          key={pid}
                          className={cn(
                            'rounded-2xl border transition-all duration-200 shadow-xs',
                            isExpanded
                              ? 'border-copper/60 bg-copper/5 shadow-md'
                              : 'border-border/70 bg-surface hover:border-steel hover:bg-surface-hover hover:scale-[1.003]'
                          )}
                        >
                          {/* Main Row */}
                          <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => {
                                  sound.click()
                                  setExpandedRow(isExpanded ? null : pid)
                                }}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-text-muted hover:text-paper hover:bg-carbon transition-colors cursor-pointer"
                                title="Expand AI decision reasoning"
                              >
                                {isExpanded
                                  ? <ChevronDown className="h-4 w-4 text-copper" />
                                  : <ChevronRight className="h-4 w-4" />}
                              </button>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <CopyId id={pid} truncate={16} showDecisionAction={false} />
                                  <RailPill value={p.chosen_rail || 'card'} />
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="font-serif text-sm font-bold text-paper">{inr(p.amount_inr)}</span>
                                  <span className="text-[11px] text-text-faint font-medium">· {issuer}</span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="font-semibold text-copper text-xs font-mono">
                                {retryLabel}
                              </div>
                              <div className="text-[11px] text-text-muted">
                                {confPct} confidence score
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="default"
                                onClick={() => {
                                  sound.click()
                                  setSelectedPaymentId(pid)
                                }}
                                title="Inspect ML Decision Breakdown & Explainability Trail"
                              >
                                <Brain className="h-3.5 w-3.5 text-copper" />
                                <span className="hidden sm:inline">Decision Trace</span>
                              </Button>
                              <Button
                                variant="primary"
                                disabled={force.isPending}
                                onClick={() => force.mutate(pid)}
                              >
                                <Play className="h-3 w-3" /> Fire Now
                              </Button>
                              <Button
                                variant="danger"
                                disabled={cancel.isPending}
                                onClick={() => cancel.mutate(pid)}
                                title="Cancel scheduled retry"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Expanded Reasoning */}
                          {isExpanded && (
                            <div className="border-t border-border/60 px-5 py-4 space-y-3 animate-in slide-in-from-top-1 duration-150 bg-black/20 rounded-b-2xl">
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-copper mb-1.5 flex items-center gap-1">
                                  <Brain className="h-3 w-3" />
                                  <span>Autonomous Decision Chain</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {reasoning.split(' → ').map((part, j) => (
                                    <span key={j} className="flex items-center gap-1.5">
                                      {j > 0 && <span className="text-copper font-bold text-xs">→</span>}
                                      <span className="rounded-lg bg-carbon border border-border px-2.5 py-1 text-xs text-bone font-medium">
                                        {part}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
                                <span>Decline reason: <strong className="text-bone">{errorReason}</strong></span>
                                {p.retry_at && (
                                  <span>Raw timestamp: <strong className="text-bone font-mono">{p.retry_at.slice(0, 19)}</strong></span>
                                )}
                              </div>

                              {p.top_features.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-faint mb-1.5">
                                    Top Model Signals (Feature Importance)
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {p.top_features.map(([feat, weight]) => (
                                      <span key={feat} className="rounded-full bg-onyx border border-border px-2.5 py-0.5 text-[10px] font-mono text-bone">
                                        {feat}: {(weight * 100).toFixed(1)}%
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    sound.click()
                                    setSelectedPaymentId(pid)
                                  }}
                                  className="text-xs font-semibold text-copper hover:text-copper-glow transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <span>View 240-hour probability radar breakdown →</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            </>
          )
        }}
      </QueryBoundary>

      {/* 2. Bank Outages & Parked Payments */}
      <div id="downtime" className="scroll-mt-6">
        <QueryBoundary query={downtime} skeletonRows={4}>
          {(b) => (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-6">
                <CardTitle
                  action={
                    <LiveBeacon
                      status={b.active_downtimes.length > 0 ? 'warning' : 'active'}
                      label={b.active_downtimes.length > 0 ? `${b.active_downtimes.length} Outages` : 'All Rails Healthy'}
                      size="sm"
                    />
                  }
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-copper" />
                    <span>Bank Outages & Gateway Health</span>
                  </div>
                </CardTitle>
                {b.active_downtimes.length === 0 ? (
                  <EmptyState message="All banking rails and gateways are currently healthy." />
                ) : (
                  <Table head={['Method', 'Bank', 'Started', 'Status']}>
                    {b.active_downtimes.map((d) => (
                      <Tr key={d.id}>
                        <Td className="uppercase font-medium text-paper">{d.method}</Td>
                        <Td mono className="font-semibold text-paper">{d.issuer || 'ALL'}</Td>
                        <Td>
                          <div>{ago(d.started_at)}</div>
                          <div className="text-[10px] text-text-faint">{dt(d.started_at)}</div>
                        </Td>
                        <Td>
                          <span className="rounded-full bg-copper/15 border border-copper/30 px-2.5 py-0.5 text-[11px] font-semibold uppercase text-copper">
                            {d.status}
                          </span>
                        </Td>
                      </Tr>
                    ))}
                  </Table>
                )}
              </Card>

              <Card className="p-6">
                <CardTitle
                  action={
                    <span className="flex items-center gap-1 text-xs text-text-muted font-mono">
                      <Layers className="h-3.5 w-3.5 text-copper" />
                      <span>{b.queued_payments.length} parked</span>
                    </span>
                  }
                >
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-copper" />
                    <span>Parked Payments (Auto-Retry on Recovery)</span>
                  </div>
                </CardTitle>
                {b.queued_payments.length === 0 ? (
                  <EmptyState message="No payments currently parked in downtime queue." />
                ) : (
                  <Table head={['Payment', 'Method', 'Bank', 'Parked']}>
                    {b.queued_payments.map((q) => (
                      <Tr key={q.payment_id}>
                        <Td mono>
                          <CopyId
                            id={q.payment_id}
                            truncate={18}
                            linkTo={`/payment/${q.payment_id}`}
                            showDecisionAction
                            onViewDecision={(id: string) => setSelectedPaymentId(id)}
                          />
                        </Td>
                        <Td className="uppercase font-medium">{q.method}</Td>
                        <Td mono>{q.issuer || '—'}</Td>
                        <Td>{ago(q.queued_at)}</Td>
                      </Tr>
                    ))}
                  </Table>
                )}
              </Card>
            </div>
          )}
        </QueryBoundary>
      </div>

      <Modal
        isOpen={Boolean(selectedPaymentId)}
        onClose={() => setSelectedPaymentId(null)}
        title="AI Agent Decision Breakdown"
        className="max-w-4xl"
      >
        {paymentDetail.isLoading ? (
          <div className="py-8 text-center text-xs text-text-muted">Loading payment details…</div>
        ) : paymentDetail.data?.event ? (
          <DecisionCard
            event={paymentDetail.data.event}
            audit={paymentDetail.data.audit}
            showFullBrain={true}
          />
        ) : (
          <div className="py-8 text-center text-xs text-neg">Could not load payment decision.</div>
        )}
      </Modal>
    </div>
  )
}
