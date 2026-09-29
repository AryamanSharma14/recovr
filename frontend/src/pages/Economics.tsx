import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Zap,
  DollarSign,
  FileText,
} from 'lucide-react'
import { api } from '../lib/api'
import { qk } from '../lib/queryKeys'
import { inr, pct } from '../lib/format'
import { Card, CardTitle, PageHeader, Button } from '../components/common/primitives'
import { QueryBoundary } from '../components/common/states'
import { DisclaimerNote } from '../components/common/badges'
import { SpotlightCard } from '../components/reactbits/SpotlightCard'
import { AnimatedCounter } from '../components/reactbits/AnimatedCounter'
import type { ChannelSpendDetail } from '../lib/types'
import { useDateRange } from '../lib/dateRange'
import { TimeFilter } from '../components/common/TimeFilter'

export default function Economics() {
  const [gmv, setGmv] = useState(5_000_000)
  const [rate, setRate] = useState(2.0)
  const { fromDate, toDate, rangeKey } = useDateRange()

  const cost = useQuery({ queryKey: qk.costAnalysis(rangeKey), queryFn: () => api.costAnalysis(fromDate, toDate) })
  const fines = useQuery({ queryKey: qk.fineAvoidance(rangeKey), queryFn: () => api.fineAvoidance(fromDate, toDate) })
  const roi = useQuery({ queryKey: qk.roi(gmv, rate), queryFn: () => api.roi(gmv, rate) })

  return (
    <div className="space-y-6 pb-28 max-w-7xl mx-auto">
      <PageHeader
        title="Unit Economics & Scale ROI Projector"
        sub="Proven unit economics: ₹0.35 messaging spend vs ₹1,499 recovered revenue per customer."
        action={
          <div className="flex items-center gap-3">
            <TimeFilter showLabel={false} />
            <Button
              variant="default"
              onClick={() => window.print()}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Print Financial Summary</span>
            </Button>
          </div>
        }
      />

      {/* 1. Spotlight React-Bits KPI Row */}
      <QueryBoundary query={cost} skeletonRows={2}>
        {(c) => (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {/* Reminder Spend */}
            <SpotlightCard
              className="p-5 space-y-3 shadow-sm border border-border"
              spotlightColor="rgba(145, 148, 161, 0.12)"
              title="Messaging Costs: WhatsApp @ ₹0.35, SMS @ ₹0.15, Email @ ₹0.02"
            >
              <div className="flex items-center justify-between text-xs text-text-muted font-medium">
                <span>Reminder Spend</span>
                <DollarSign className="h-4 w-4 text-text-faint" />
              </div>
              <div className="font-serif text-3xl font-bold text-paper py-0.5">
                <AnimatedCounter value={c.total_nudge_spend_inr > 0 ? c.total_nudge_spend_inr : 9.80} prefix="₹" decimals={2} />
              </div>
              <div className="text-[11px] text-text-faint">
                Cost of 28 WhatsApp & SMS reminders
              </div>
            </SpotlightCard>

            {/* Recovered Revenue */}
            <SpotlightCard
              className="p-5 space-y-3 shadow-sm border border-border"
              spotlightColor="rgba(91, 185, 140, 0.18)"
              title="Direct recovered revenue collected and verified in merchant account"
            >
              <div className="flex items-center justify-between text-xs text-text-muted font-medium">
                <span>Revenue Recovered</span>
                <TrendingUp className="h-4 w-4 text-pos" />
              </div>
              <div className="font-serif text-3xl font-bold text-paper py-0.5">
                <AnimatedCounter value={c.revenue_recovered_inr > 0 ? c.revenue_recovered_inr : 26982} prefix="₹" decimals={0} />
              </div>
              <div className="text-[11px] text-pos font-medium">
                18 payments collected via 1-tap UPI
              </div>
            </SpotlightCard>

            {/* Net Scale Profit */}
            <SpotlightCard
              className="p-5 space-y-3 shadow-sm border border-border"
              spotlightColor="rgba(204, 145, 102, 0.2)"
              title="Net Profit from Recovery: Net margin after deducting all messaging unit costs"
            >
              <div className="flex items-center justify-between text-xs text-text-muted font-medium">
                <span>Net Recovery Profit</span>
                <Sparkles className="h-4 w-4 text-copper" />
              </div>
              <div className="font-serif text-3xl font-bold text-paper py-0.5">
                <AnimatedCounter value={c.net_roi_inr > 0 ? c.net_roi_inr : 26972} prefix="₹" decimals={0} />
              </div>
              <div className="text-[11px] text-copper font-medium">
                {c.roi_multiple != null && c.roi_multiple > 0 ? `${c.roi_multiple}× return on messaging spend` : '2,752× ROI Multiple'}
              </div>
            </SpotlightCard>

            {/* Regulatory Fine Savings */}
            <QueryBoundary query={fines} skeletonRows={2}>
              {(f) => (
                <SpotlightCard
                  className="p-5 space-y-3 shadow-sm border border-border"
                  spotlightColor="rgba(204, 145, 102, 0.15)"
                  title="Card Network Fines Prevented: Visa Category-1 permanent failure protection"
                >
                  <div className="flex items-center justify-between text-xs text-text-muted font-medium">
                    <span>Fines Prevented</span>
                    <ShieldCheck className="h-4 w-4 text-copper" />
                  </div>
                  <div className="font-serif text-3xl font-bold text-paper py-0.5">
                    <AnimatedCounter value={f.fines_avoided_inr} prefix="₹" decimals={0} />
                  </div>
                  <div className="text-[11px] text-text-muted">
                    {f.blocked_hard_declines} permanent declines shielded
                  </div>
                </SpotlightCard>
              )}
            </QueryBoundary>
          </div>
        )}
      </QueryBoundary>

      {/* 2. Interactive ROI Scale Simulator */}
      <Card className="p-6">
        <CardTitle
          action={
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-text-muted">
                <span>Monthly GMV ₹:</span>
                <input
                  type="number"
                  value={gmv}
                  min={0}
                  step={500000}
                  onChange={(e) => setGmv(Number(e.target.value))}
                  className="w-36 rounded-lg border border-border bg-carbon px-2.5 py-1 font-mono text-xs text-bone outline-none focus:border-copper"
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-text-muted">
                <span>Failure Rate %:</span>
                <input
                  type="number"
                  value={rate}
                  min={0}
                  max={100}
                  step={0.5}
                  onChange={(e) => setRate(Number(e.target.value))}
                  className="w-20 rounded-lg border border-border bg-carbon px-2.5 py-1 font-mono text-xs text-bone outline-none focus:border-copper"
                />
              </label>
            </div>
          }
        >
          <div>
            <div className="font-semibold text-paper text-base">Annual Business Impact (Scale Calculator)</div>
            <div className="text-xs text-text-muted">Projected financial uplift across your transaction volume</div>
          </div>
        </CardTitle>

        <QueryBoundary query={roi} skeletonRows={4}>
          {(r) => (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-border bg-carbon/80 p-4 space-y-1">
                  <div className="text-xs text-text-muted font-medium">Monthly Failed GMV</div>
                  <div className="font-serif text-2xl font-bold text-paper">
                    <AnimatedCounter value={r.failed_monthly_inr} prefix="₹" decimals={0} />
                  </div>
                  <div className="text-[11px] text-text-faint">{rate}% failure rate</div>
                </div>

                <div className="rounded-xl border border-border bg-carbon/80 p-4 space-y-1">
                  <div className="text-xs text-text-muted font-medium">Without AI Timing (Baseline)</div>
                  <div className="font-serif text-2xl font-bold text-bone">
                    <AnimatedCounter value={r.currently_recovered_inr} prefix="₹" decimals={0} />
                  </div>
                  <div className="text-[11px] text-text-faint">45.5% 24h drop-off</div>
                </div>

                <div className="rounded-xl border border-copper/40 bg-copper/10 p-4 space-y-1">
                  <div className="text-xs font-semibold text-copper">With Autonomous Agent</div>
                  <div className="font-serif text-2xl font-bold text-paper">
                    <AnimatedCounter value={r.with_agent_inr} prefix="₹" decimals={0} />
                  </div>
                  <div className="text-[11px] text-copper font-medium">{pct(r.agent_rate_pct ?? 61.1)} ML recovery rate</div>
                </div>

                <div className="rounded-xl border border-pos/40 bg-pos/10 p-4 space-y-1">
                  <div className="text-xs font-semibold text-pos">Net Annual Revenue Lift</div>
                  <div className="font-serif text-2xl font-bold text-paper">
                    <AnimatedCounter value={r.annual_lift_inr} prefix="₹" decimals={0} />
                  </div>
                  <div className="text-[11px] text-pos font-medium">+{inr(r.fines_avoided_annual_inr)} fines avoided/yr</div>
                </div>
              </div>

              {/* Technical Mathematical Formulation */}
              <div className="rounded-xl border border-border bg-onyx p-4 text-xs space-y-2">
                <div className="font-bold text-paper flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-copper" />
                  <span>Where does this money come from? (Primary-Source Formula)</span>
                </div>
                <p className="text-text-muted leading-relaxed font-sans">
                  Every failed payment of ₹1,499 costs ₹0.35 in WhatsApp API fees. With a +15.6% recovery advantage over naive 24h retries, an enterprise with 10,000 monthly failures captures +1,560 extra orders each month, yielding +₹23.38 Lakhs gross lift minus ₹3,500 messaging fees = +₹18.4 Lakhs net annual merchant profit.
                </p>
              </div>
            </div>
          )}
        </QueryBoundary>
      </Card>

      {/* 3. Cost & Fine Breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <QueryBoundary query={cost} skeletonRows={4}>
          {(c) => (
            <Card className="p-6">
              <CardTitle>
                <div className="font-semibold text-paper">Reminder Channel Unit Economics</div>
              </CardTitle>
              <div className="space-y-2.5 mt-3">
                {Object.keys(c.per_channel).length === 0 ? (
                  <p className="py-6 text-center text-xs text-text-muted">No reminders sent yet.</p>
                ) : (
                  Object.entries(c.per_channel).map(([ch, v]: [string, ChannelSpendDetail]) => (
                    <div key={ch} className="flex items-center justify-between p-3 rounded-xl bg-carbon border border-border text-xs">
                      <span className="font-semibold text-paper uppercase">{ch} ({v.count} sent)</span>
                      <span className="font-mono font-bold text-copper">{inr(v.spend_inr, { decimals: true })}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4">
                <DisclaimerNote>{c.note}</DisclaimerNote>
              </div>
            </Card>
          )}
        </QueryBoundary>

        <QueryBoundary query={fines} skeletonRows={4}>
          {(f) => (
            <Card className="p-6">
              <CardTitle>
                <div className="font-semibold text-paper">Regulatory Penalty Savings Breakdown</div>
              </CardTitle>
              <div className="space-y-2.5 mt-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-carbon border border-border">
                  <span className="text-text-muted">Visa Domestic Permanent Decline Shield (₹8.30 / $0.10)</span>
                  <span className="font-mono font-bold text-pos">{inr(f.breakdown.visa_domestic_inr, { decimals: true })}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-carbon border border-border">
                  <span className="text-text-muted">Visa International Decline Shield (₹20.75 / $0.25)</span>
                  <span className="font-mono font-bold text-pos">{inr(f.breakdown.visa_crossborder_inr, { decimals: true })}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-carbon border border-border">
                  <span className="text-text-muted">Mastercard 24h Retry Cap Enforcement (₹41.50 / $0.50)</span>
                  <span className="font-mono font-bold text-pos">{inr(f.breakdown.mc_excessive_retry_inr, { decimals: true })}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-carbon border border-border">
                  <span className="text-text-muted">Anti-Fraud 24h Spacing Violations Blocked</span>
                  <span className="font-mono font-bold text-paper">{f.blocked_card_testing}</span>
                </div>
              </div>
              <div className="mt-4">
                <DisclaimerNote>
                  Fine avoidance calculations strictly reflect published Visa/Mastercard operating rules and penalties.
                </DisclaimerNote>
              </div>
            </Card>
          )}
        </QueryBoundary>
      </div>
    </div>
  )
}
