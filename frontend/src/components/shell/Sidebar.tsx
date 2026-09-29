import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Clock,
  Brain,
  ShieldCheck,
  IndianRupee,
  Wrench,
  FileText,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { sound } from '../../lib/sound'
import { LiveBeacon } from '../reactbits/LiveBeacon'

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, exact: true },
  { to: '/queue', label: 'Recovery Queue', icon: Clock },
  { to: '/analytics', label: 'ML Intelligence', icon: Brain },
  { to: '/policy', label: 'Rules & Guardrails', icon: ShieldCheck },
  { to: '/economics', label: 'Unit Economics', icon: IndianRupee },
  { to: '/audit', label: 'Audit Trail', icon: FileText },
  { to: '/workbench', label: 'Event Workbench', icon: Wrench, isTag: 'Sandbox' },
]

export function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col justify-between border-r border-border bg-[#0a0b0e] p-4 shadow-xl z-20">
      <div className="space-y-6">
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-copper text-obsidian font-serif font-bold text-lg shadow-md">
            R
          </div>
          <div>
            <div className="font-serif text-base font-bold text-paper tracking-tight">recovr</div>
            <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Recovery Engine</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                onClick={() => sound.click()}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-150',
                    isActive
                      ? 'bg-carbon text-paper border border-border/80 shadow-xs'
                      : 'text-text-muted hover:bg-carbon/50 hover:text-bone'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-copper shadow-[0_0_8px_#cc9166]" />
                    )}
                    <Icon className={cn('h-4 w-4 shrink-0 transition-colors', isActive ? 'text-copper' : 'text-text-faint group-hover:text-bone')} />
                    <span>{item.label}</span>
                    {item.isTag && (
                      <span className="ml-auto rounded-full bg-copper/15 border border-copper/30 px-2 py-0.5 text-[9px] font-bold text-copper uppercase font-mono">
                        {item.isTag}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="border-t border-border/60 pt-3 px-2 flex items-center justify-between text-[10px] text-text-faint font-mono">
        <span>recovr v0.1.0</span>
        <LiveBeacon status="active" label="Online" size="sm" />
      </div>
    </aside>
  )
}
