'use client';

import { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronDown,
  Ship as ShipIcon,
  Loader2,
  Check,
  AlertTriangle,
  Square,
  CheckSquare,
  Boxes,
  Layers,
  Radio,
  Crosshair,
  Target,
  Gauge,
  SlidersHorizontal,
  Compass,
  LayoutDashboard,
  Download,
} from 'lucide-react';
import DEMO_SCENARIOS, {
  DemoScenario,
  PhaseScores,
  resolveShipDependability,
} from './Demoscenarios';
import { enrichShips, GapMetric, ProConMetric, StrikeMap } from '@/lib/loadShipDetails';

export interface ShipCandidate {
  name: string;
  lat: number;
  lng: number;
  distanceNm: number;
}

interface ShipDependabilityPanelProps {
  open: boolean;
  onClose: () => void;
  ships: ShipCandidate[];
  incident: { lat: number; lng: number } | null;
  width?: number;
  onOpenDashboard?: (shipName: string) => void;
}

const DARK = {
  bg: '#0A0B0D',
  surface: '#111318',
  card: 'rgba(156,163,175,0.08)',
  border: 'rgba(243,244,246,0.10)',
  borderStrong: 'rgba(243,244,246,0.18)',
  text: '#F3F4F6',
  textSub: '#D1D5DB',
  textMuted: '#6B7280',
  accent: '#FAE500',
  accentDim: 'rgba(250,229,0,0.12)',
  green: '#4ADE80',
  red: '#F87171',
  blue: '#60A5FA',
};

const FONT_STACK =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const SPRING_SNAPPY = { type: 'spring', stiffness: 420, damping: 32, mass: 0.7 } as const;
const SPRING_SOFT = { type: 'spring', stiffness: 260, damping: 28, mass: 0.9 } as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatPct = (v: number) => `${Math.round(v * 100)}%`;

function formatLabel(s: string): string {
  return s
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

function topN(record: Record<string, number> | undefined, n: number): [string, number][] {
  if (!record) return [];
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function confColor(v: number): string {
  return v >= 0.75 ? DARK.green : v >= 0.45 ? DARK.accent : DARK.red;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RankedShip {
  ship: ShipCandidate;
  index: number;
  system: number;
  phases: PhaseScores;
  scenario: DemoScenario;
  strike: StrikeMap;
  noKeys: string[];
  strengths: ProConMetric[];
  gaps: GapMetric[];
}

function isQualified(r: RankedShip, overrides: Record<string, Set<string>>): boolean {
  if (r.noKeys.length === 0) return true;
  const ov = overrides[r.ship.name];
  if (!ov) return false;
  return r.noKeys.every((k) => ov.has(k));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PhaseBar({ label, value }: { label: string; value: number }) {
  const color = value >= 0.8 ? DARK.green : value >= 0.65 ? DARK.accent : DARK.red;
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <div className="w-14 shrink-0 uppercase tracking-wide font-medium" style={{ color: DARK.textMuted, fontFamily: FONT_STACK }}>
        {label}
      </div>
      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(value * 100)}%` }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
        />
      </div>
      <div className="w-8 text-right font-semibold tabular-nums" style={{ color, fontFamily: FONT_STACK }}>
        {formatPct(value)}
      </div>
    </div>
  );
}

function StrengthsGaps({ strengths, gaps }: { strengths: ProConMetric[]; gaps: GapMetric[] }) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: DARK.green, fontFamily: FONT_STACK }}>
          Strengths
        </div>
        <ul className="space-y-1">
          {strengths.length === 0 && (
            <li className="text-[10px]" style={{ color: DARK.textMuted }}>No strengths data.</li>
          )}
          {strengths.map((p) => (
            <li key={p.metric} className="flex items-center justify-between text-[11px]" style={{ color: DARK.textSub, fontFamily: FONT_STACK }}>
              <span className="flex items-center gap-1.5 min-w-0">
                <Check size={11} style={{ color: DARK.green, flexShrink: 0 }} />
                <span className="truncate">{p.metric}</span>
              </span>
              <span className="font-semibold tabular-nums shrink-0 pl-2" style={{ color: DARK.green }}>
                {p.value}{p.unit}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: DARK.red, fontFamily: FONT_STACK }}>
          Gaps
        </div>
        <ul className="space-y-1.5">
          {gaps.length === 0 && (
            <li className="text-[10px]" style={{ color: DARK.textMuted }}>No gaps data.</li>
          )}
          {gaps.map((c) => (
            <li key={c.metric} style={{ fontFamily: FONT_STACK }}>
              {c.type === 'warning' ? (
                <div className="flex items-start gap-1.5">
                  <AlertTriangle size={11} style={{ color: '#FBBF24', flexShrink: 0, marginTop: 2 }} />
                  <div className="min-w-0">
                    <div className="text-[11px]" style={{ color: DARK.textSub }}>{c.metric}</div>
                    <div className="text-[10px] mt-0.5 leading-snug" style={{ color: '#FBBF24' }}>{c.status}</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-[11px]" style={{ color: DARK.textSub }}>
                  <span className="flex items-center gap-1.5 min-w-0">
                    <AlertTriangle size={11} style={{ color: DARK.red, flexShrink: 0 }} />
                    <span className="truncate">{c.metric}</span>
                  </span>
                  <span className="font-semibold tabular-nums shrink-0 pl-2" style={{ color: DARK.red }}>
                    {c.value}{c.unit}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DisqualifiedFactors({
  noKeys, overriddenSet, onToggle,
}: {
  noKeys: string[];
  overriddenSet: Set<string>;
  onToggle: (key: string) => void;
}) {
  const remaining = noKeys.filter((k) => !overriddenSet.has(k)).length;
  return (
    <div className="rounded-lg p-3" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.25)', fontFamily: FONT_STACK }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: DARK.red }}>
          Disqualifying Factors
        </div>
        <div className="text-[9px] font-mono" style={{ color: DARK.textMuted }}>
          {remaining} of {noKeys.length} active
        </div>
      </div>
      <ul className="space-y-1">
        {noKeys.map((key) => {
          const overridden = overriddenSet.has(key);
          return (
            <li key={key}>
              <button
                onClick={() => onToggle(key)}
                className="w-full flex items-center gap-2 text-left text-[11px] py-1 px-1.5 rounded-md transition-colors"
                style={{ color: overridden ? DARK.textMuted : DARK.textSub, background: 'transparent' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {overridden
                  ? <Square size={13} style={{ color: DARK.textMuted, flexShrink: 0 }} />
                  : <CheckSquare size={13} style={{ color: DARK.red, flexShrink: 0 }} />
                }
                <span style={{ textDecoration: overridden ? 'line-through' : 'none' }}>{key}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {remaining === 0 && (
        <div className="mt-2 pt-2 text-[10px] font-semibold" style={{ color: DARK.green, borderTop: `1px solid ${DARK.border}` }}>
          All blockers overridden — ship reclassified as qualified.
        </div>
      )}
    </div>
  );
}

const SINGLE_LABEL_GROUPS: { key: string; label: string; icon: typeof Boxes }[] = [
  { key: 'Category', label: 'Category', icon: Boxes },
  { key: 'SubMission', label: 'Sub Mission', icon: Layers },
  { key: 'Criticality', label: 'Criticality', icon: AlertTriangle },
  { key: 'Level', label: 'Level', icon: Radio },
  { key: 'Action', label: 'Action', icon: Crosshair },
  { key: 'Entity', label: 'Entity', icon: Target },
];

const MULTI_LABEL_GROUPS: { key: string; label: string; icon: typeof Gauge }[] = [
  { key: 'TaskObjective', label: 'Task Objective', icon: Gauge },
  { key: 'Constraints', label: 'Constraints', icon: SlidersHorizontal },
  { key: 'ObjectiveFunction', label: 'Objective Function', icon: Compass },
];

function BigStatTile({
  icon: Icon, label, entry, delay,
}: {
  icon: typeof Boxes;
  label: string;
  entry: [string, number] | undefined;
  delay: number;
}) {
  const [name, val] = entry ?? ['—', 0];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, ...SPRING_SOFT }}
      className="rounded-xl p-3 min-w-0"
      style={{ background: DARK.card, border: `1px solid ${DARK.borderStrong}`, fontFamily: FONT_STACK }}
    >
      <div className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-widest mb-1.5" style={{ color: DARK.textMuted }}>
        <Icon size={11} style={{ color: DARK.textMuted, flexShrink: 0 }} />
        <span className="truncate text-amber-400">{label}</span>
      </div>
      <div className="text-[15px] font-extrabold leading-tight truncate" style={{ color: DARK.text }}>
        {formatLabel(name)}
      </div>
    </motion.div>
  );
}

function MultiLabelCard({
  icon: Icon, label, entries, delay,
}: {
  icon: typeof Gauge;
  label: string;
  entries: [string, number][];
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, ...SPRING_SOFT }}
      className="rounded-xl p-3"
      style={{ background: DARK.card, border: `1px solid ${DARK.borderStrong}`, fontFamily: FONT_STACK }}
    >
      <div className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-widest mb-2" style={{ color: DARK.textMuted }}>
        <Icon size={11} style={{flexShrink: 0 }} />
        <span className='text-amber-400'>{label}</span>
        {/* <span className="ml-auto text-[8px] font-mono normal-case tracking-normal" style={{ color: DARK.textMuted }}>top 3</span> */}
      </div>
      <div className="space-y-2">
        {entries.length === 0 && (
          <div className="text-[10px]" style={{ color: DARK.textMuted }}>No data.</div>
        )}
        {entries.map(([name, val], i) => {
          const color = i === 0 ? DARK.accent : i === 1 ? DARK.blue : DARK.textSub;
          return (
            <div key={name} className="flex items-center gap-2">
              <span
                className="shrink-0 flex items-center justify-center rounded-full font-bold tabular-nums"
                style={{
                  width: 15,
                  height: 15,
                  fontSize: 8,
                  color: DARK.textMuted,
                  background: 'rgba(255,255,255,0.08)',
                }}
              >
                {i + 1}
              </span>
              <span
                className="truncate flex-1"
                style={{
                  color: i === 0 ? DARK.text : DARK.textSub,
                  fontSize: i === 0 ? 12.5 : 11,
                  fontWeight: i === 0 ? 700 : 500,
                }}
              >
                {formatLabel(name)}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function ClassificationBreakdown({ scenario }: { scenario: DemoScenario }) {
  const preds = scenario.predictions.predclass_output;
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: DARK.accent, fontFamily: FONT_STACK }}>
          Extracted Context
        </div>
        {/* <div className="text-[9px] font-mono truncate max-w-[55%] text-right" style={{ color: DARK.textMuted }}>
          {scenario.label}
        </div> */}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {SINGLE_LABEL_GROUPS.map((g, i) => (
          <BigStatTile
            key={g.key}
            icon={g.icon}
            label={g.label}
            entry={topN(preds[g.key], 1)[0]}
            delay={i * 0.04}
          />
        ))}
      </div>

      <div className="space-y-2">
        {MULTI_LABEL_GROUPS.map((g, i) => (
          <MultiLabelCard
            key={g.key}
            icon={g.icon}
            label={g.label}
            entries={topN(preds[g.key], 3)}
            delay={0.24 + i * 0.05}
          />
        ))}
      </div>
    </div>
  );
}

function ExplainText({
  ship, rank, isCommon, scenario,
}: {
  ship?: RankedShip;
  rank?: number;
  isCommon?: boolean;
  scenario?: DemoScenario;
}) {
  const [showWhy, setShowWhy] = useState(false);

  if (isCommon) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg p-4 text-[12px] leading-relaxed" style={{ background: DARK.card, border: `1px solid ${DARK.borderStrong}`, color: DARK.textSub, fontFamily: FONT_STACK }}>
          <div className="font-bold uppercase tracking-widest text-[10px] mb-2" style={{ color: DARK.accent }}>Scenario</div>
          At approximately 1030 IST on 09 June 2025, the Maritime Operations Centre (MOC), Mumbai, received intelligence indicating a coordinated hostile naval presence at approximately 10.2650°N, 61.7192°E, approximately 830 nautical miles southwest of Mumbai Port. The hostile force is assessed to comprise multiple armed surface combatants, fast attack craft, and a suspected submarine, posing an immediate threat to commercial shipping and regional maritime security. Preliminary operational assessment indicates that a minimum force package of three destroyer-class warships* will be required to establish sea control, conduct simultaneous anti-air, anti-surface, and anti-submarine operations, and effectively neutralize the hostile threat within the designated area of operations.
        </div>
        {scenario && <ClassificationBreakdown scenario={scenario} />}
        {scenario?.explanation && (
          <div>
            <button
              onClick={() => setShowWhy((v) => !v)}
              className="w-full text-[10px] font-semibold px-3 py-2 rounded-lg transition-colors"
              style={{
                background: showWhy ? DARK.accentDim : 'rgba(255,255,255,0.06)',
                color: showWhy ? DARK.accent : DARK.textMuted,
                border: `1px solid ${showWhy ? 'rgba(250,229,0,0.3)' : DARK.border}`,
              }}
            >
              {showWhy ? 'Hide reasoning' : 'Reasoning'}
            </button>
            <AnimatePresence initial={false}>
              {showWhy && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: EASE_OUT }}
                  style={{ overflow: 'hidden' }}
                >
                  <div
                    className="mt-2 rounded-lg p-4 text-[12px] leading-relaxed"
                    style={{ background: DARK.card, border: `1px solid ${DARK.borderStrong}`, color: DARK.textSub, fontFamily: FONT_STACK }}
                  >
                    {scenario.explanation}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  }

  if (!ship) return null;
  const phaseNotes = [
    ship.phases.harbour >= 0.8 ? 'high harbour readiness' : ship.phases.harbour >= 0.65 ? 'adequate harbour readiness' : 'reduced harbour readiness',
    ship.phases.cruise >= 0.8 ? 'strong cruise endurance' : ship.phases.cruise >= 0.65 ? 'moderate cruise endurance' : 'limited cruise endurance',
    ship.phases.action >= 0.8 ? 'excellent combat readiness' : ship.phases.action >= 0.65 ? 'acceptable combat readiness' : 'degraded combat readiness',
  ];
  return (
    <div className="rounded-lg p-3 text-[11px] leading-relaxed" style={{ background: DARK.card, border: `1px solid ${DARK.borderStrong}`, color: DARK.textSub, fontFamily: FONT_STACK }}>
      <div className="font-bold uppercase tracking-widest text-[9px] mb-1.5" style={{ color: DARK.accent }}>{ship.ship.name} — Rank #{rank}</div>
      {ship.ship.name} achieves a composite dependability of {formatPct(ship.system)}, placing it at rank #{rank} within its group. Currently {ship.ship.distanceNm.toFixed(0)} nm from the incident, showing {phaseNotes.join(', ')}.
    </div>
  );
}

function ShipRow({
  ranked, rank, qualified, overriddenSet, onToggleOverride, expanded, onToggle, onOpenDashboard, isExplaining, onToggleExplain,
}: {
  ranked: RankedShip;
  rank: number;
  qualified: boolean;
  overriddenSet: Set<string>;
  onToggleOverride: (key: string) => void;
  expanded: boolean;
  onToggle: () => void;
  onOpenDashboard?: (shipName: string) => void;
  isExplaining: boolean;
  onToggleExplain: () => void;
}) {
  const { ship, system, strengths, gaps } = ranked;
  const scoreColor = system >= 0.8 ? DARK.green : system >= 0.65 ? DARK.accent : DARK.red;

  return (
    <motion.div
      layout
      layoutId={`ship-${ship.name}`}
      transition={SPRING_SOFT}
      className="rounded-xl overflow-hidden"
      style={{
        background: DARK.surface,
        border: `1px solid ${DARK.border}`,
        fontFamily: FONT_STACK,
      }}
    >
      <motion.button
        onClick={onToggle}
        whileTap={{ scale: 0.995 }}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
        style={{ background: 'transparent' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full shrink-0" style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)' }}>
          <ShipIcon className="size-4" style={{ color: DARK.blue }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold tabular-nums shrink-0" style={{ color: DARK.textMuted }}>#{rank}</span>
            <div className="text-[12px] font-semibold truncate" style={{ color: DARK.text }}>{ship.name}</div>
          </div>
          <div className="text-[10px] font-mono" style={{ color: DARK.textMuted }}>{ship.distanceNm.toFixed(0)} nm from incident</div>
        </div>
        <div className="flex flex-col items-end shrink-0 mr-1">
          <div className="text-[13px] font-bold tabular-nums" style={{ color: scoreColor }}>{formatPct(system)}</div>
          <div className="text-[8px] tracking-widest uppercase" style={{ color: DARK.textMuted }}>Dependability</div>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={SPRING_SNAPPY}>
          <ChevronDown className="size-4 shrink-0" style={{ color: DARK.textMuted }} />
        </motion.div>
      </motion.button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            style={{ overflow: 'hidden', borderTop: `1px solid ${DARK.border}` }}
          >
            <div className="px-3 pb-3 pt-2.5 space-y-3">
              {qualified
                ? <StrengthsGaps strengths={strengths} gaps={gaps} />
                : <DisqualifiedFactors noKeys={ranked.noKeys} overriddenSet={overriddenSet} onToggle={onToggleOverride} />
              }
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExplain();
                  }}
                  className="text-[10px] font-semibold px-3 py-1 rounded-md transition-colors"
                  style={{
                    background: isExplaining ? DARK.accentDim : 'rgba(255,255,255,0.06)',
                    color: isExplaining ? DARK.accent : DARK.textMuted,
                    border: `1px solid ${isExplaining ? 'rgba(250,229,0,0.3)' : DARK.border}`,
                  }}
                >
                  {isExplaining ? 'Hide Details' : 'Details'}
                </button>
                {onOpenDashboard && (
                  <button
                    onClick={() => onOpenDashboard(ship.name)}
                    className="flex items-center gap-1 text-[10px] font-semibold px-3 py-1 rounded-md transition-colors"
                    style={{
                      background: 'rgba(96,165,250,0.10)',
                      color: DARK.blue,
                      border: `1px solid rgba(96,165,250,0.25)`,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(96,165,250,0.18)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(96,165,250,0.10)')}
                  >
                    <LayoutDashboard size={11} />
                    Dashboard
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ShipSkeletonItem({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, ...SPRING_SOFT }}
      className="rounded-xl overflow-hidden px-3 py-2.5 flex items-center gap-3"
      style={{ background: DARK.surface, border: `1px solid ${DARK.border}`, fontFamily: FONT_STACK }}
    >
      <div className="w-8 h-8 rounded-full shrink-0 animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-2.5 w-2/3 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="h-2 w-1/3 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
      </div>
      <Loader2 className="size-4 animate-spin shrink-0" style={{ color: DARK.textMuted }} />
    </motion.div>
  );
}

function GroupContainer({
  color, label, count, children,
}: {
  color: string;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-2 space-y-1.5"
      style={{
        border: `2px solid ${color}`,
        background: `${color}08`,
      }}
    >
      <div className="flex items-center gap-2 px-1 pt-0.5 pb-1">
        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color, fontFamily: FONT_STACK }}>
          {label}
        </div>
        <div className="text-[9px] font-mono" style={{ color: DARK.textMuted }}>({count})</div>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function ShipDependabilityPanel({
  open, onClose, ships, incident, width = 420, onOpenDashboard,
}: ShipDependabilityPanelProps) {
  const [phase, setPhase] = useState<'idle' | 'calculating' | 'revealed' | 'ranked'>('idle');
  const [baseList, setBaseList] = useState<RankedShip[]>([]);
  const [expandedShip, setExpandedShip] = useState<string | null>(null);
  const [explainingShip, setExplainingShip] = useState<RankedShip | null>(null);
  const [showCommonExplain, setShowCommonExplain] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    if (!open || ships.length === 0) {
      setPhase('idle');
      setShowCommonExplain(false);
      setExplainingShip(null);
      setShowDetails(false);
      setOverrides({});
      return;
    }

    setPhase('calculating');
    setShowCommonExplain(false);
    setExplainingShip(null);
    setShowDetails(false);
    setOverrides({});

    let cancelled = false;

    (async () => {
      const enriched = await enrichShips(ships);
      if (cancelled) return;

      const base: RankedShip[] = enriched.map((ship, index) => {
        // Look up by ship name — fixed, hand-editable data in Demoscenarios.ts.
        // No index-based cycling, no name-hash randomness.
        const depEntry = resolveShipDependability(ship.name);
        const scenario: DemoScenario = depEntry
          ? DEMO_SCENARIOS.find((s) => s.id === depEntry.scenarioId) ??
          DEMO_SCENARIOS[index % DEMO_SCENARIOS.length]
          : DEMO_SCENARIOS[index % DEMO_SCENARIOS.length];

        const system = depEntry ? depEntry.system_dependability : scenario.dependability.system_dependability;
        const phases = depEntry ? depEntry.phases : scenario.dependability.phases;

        const noKeys = Object.entries(ship.strike)
          .filter(([, v]) => v === 'No')
          .map(([k]) => k);

        return {
          ship: { name: ship.name, lat: ship.lat, lng: ship.lng, distanceNm: ship.distanceNm },
          index,
          system,
          phases,
          scenario,
          strike: ship.strike,
          noKeys,
          strengths: ship.strengths,
          gaps: ship.gaps,
        };
      });

      setBaseList(base);

      setTimeout(() => {
        if (cancelled) return;
        setPhase('revealed');
      }, 900);

      setTimeout(() => {
        if (cancelled) return;
        setPhase('ranked');
        setExpandedShip(null);
      }, 1700);
    })();

    return () => { cancelled = true; };
  }, [open, ships]);

  const toggleOverride = (shipName: string, key: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      const set = new Set(next[shipName] ?? []);
      if (set.has(key)) set.delete(key); else set.add(key);
      next[shipName] = set;
      return next;
    });
  };

  const { qualifiedShips, disqualifiedShips } = useMemo(() => {
    if (!baseList.length) return { qualifiedShips: [] as RankedShip[], disqualifiedShips: [] as RankedShip[] };
    const q: RankedShip[] = [];
    const dq: RankedShip[] = [];
    for (const r of baseList) {
      (isQualified(r, overrides) ? q : dq).push(r);
    }
    q.sort((a, b) => b.system - a.system);
    dq.sort((a, b) => b.system - a.system);
    return { qualifiedShips: q, disqualifiedShips: dq };
  }, [baseList, overrides]);

  const rankingScenario: DemoScenario | undefined =
    qualifiedShips[0]?.scenario ?? disqualifiedShips[0]?.scenario ?? baseList[0]?.scenario;

  const explainingRank = useMemo(() => {
    if (!explainingShip) return 0;
    const qIdx = qualifiedShips.findIndex((s) => s.ship.name === explainingShip.ship.name);
    if (qIdx !== -1) return qIdx + 1;
    const dqIdx = disqualifiedShips.findIndex((s) => s.ship.name === explainingShip.ship.name);
    return dqIdx !== -1 ? dqIdx + 1 : 0;
  }, [explainingShip, qualifiedShips, disqualifiedShips]);

  const systemDetails = useMemo(() => {
    if (!explainingShip) return null;
    const depEntry = resolveShipDependability(explainingShip.ship.name);
    const systems = depEntry?.subsystems ?? [
      { name: 'Main Propulsion (Gas Turbine)', score: 0.86 },
      { name: 'Power Distribution Grid', score: 0.81 },
      { name: 'Combat Management Suite (CMS)', score: 0.74 },
      { name: 'Auxiliary Cooling Assemblies', score: 0.52 },
      { name: 'Integrated Air Defence Radar', score: 0.65 },
    ];
    const sorted = [...systems].sort((a, b) => b.score - a.score);
    return { most: sorted[0], least: sorted[sorted.length - 1] };
  }, [explainingShip]);

  const handleToggleExplainShip = (r: RankedShip) => {
    if (explainingShip?.ship.name === r.ship.name) {
      setExplainingShip(null);
      setShowDetails(false);
    } else {
      setExplainingShip(r);
      setShowDetails(false);
    }
  };

  const renderRows = (list: RankedShip[], qualified: boolean) =>
    list.map((r, i) => (
      <ShipRow
        key={r.ship.name}
        ranked={r}
        rank={i + 1}
        qualified={qualified}
        overriddenSet={overrides[r.ship.name] ?? new Set()}
        onToggleOverride={(key) => toggleOverride(r.ship.name, key)}
        expanded={expandedShip === r.ship.name}
        onToggle={() => setExpandedShip((cur) => (cur === r.ship.name ? null : r.ship.name))}
        onOpenDashboard={onOpenDashboard}
        isExplaining={explainingShip?.ship.name === r.ship.name}
        onToggleExplain={() => handleToggleExplainShip(r)}
      />
    ));

  return (
    <motion.div
      className="absolute top-0 right-0 bottom-0 z-30 max-w-[92vw] flex flex-col"
      style={{ width, background: DARK.bg, borderLeft: `1px solid ${DARK.borderStrong}`, boxShadow: '-8px 0 32px rgba(0,0,0,0.4)', fontFamily: FONT_STACK }}
      animate={{ x: open ? 0 : '100%' }}
      transition={SPRING_SOFT}
      initial={false}
    >
      {/* Expanded contextual sidebar for the explaining ship */}
      <AnimatePresence>
        {explainingShip && phase === 'ranked' && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 15, scale: 0.96 }}
            transition={SPRING_SOFT}
            className="absolute right-full top-16 mr-4 w-[480px] rounded-2xl p-4 space-y-4 shadow-2xl flex flex-col max-h-[85vh] overflow-y-auto"
            style={{
              background: DARK.surface,
              border: `1px solid ${DARK.borderStrong}`,
              fontFamily: FONT_STACK,
              boxShadow: '-12px 4px 36px rgba(0,0,0,0.6)',
            }}
          >
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: DARK.border }}>
              <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: DARK.accent }}>
                Dependability Profile
              </div>
              <button
                onClick={() => { setExplainingShip(null); setShowDetails(false); }}
                className="p-1 rounded-md transition-colors text-gray-500 hover:text-gray-300"
              >
                <X size={14} />
              </button>
            </div>

            {/* Phase bars — values come directly from resolveShipDependability(...).phases */}
            <div className="space-y-2 pb-1">
              <PhaseBar label="Harbour" value={explainingShip.phases.harbour} />
              <PhaseBar label="Cruise" value={explainingShip.phases.cruise} />
              <PhaseBar label="Action" value={explainingShip.phases.action} />
            </div>

            {systemDetails && (
              <div className="space-y-3 pt-2.5 border-t border-[rgba(255,255,255,0.06)]">
                <div>
                  <div className="text-[8.5px] font-bold uppercase tracking-widest" style={{ color: DARK.green }}>
                    Most Dependable System
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] font-medium truncate max-w-[78%]" style={{ color: DARK.textSub }}>
                      {systemDetails.most.name}
                    </span>
                    <span className="text-[11px] font-bold tabular-nums shrink-0 pl-1" style={{ color: DARK.green }}>
                      {formatPct(systemDetails.most.score)}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[8.5px] font-bold uppercase tracking-widest" style={{ color: DARK.red }}>
                    Least Dependable System
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] font-medium truncate max-w-[78%]" style={{ color: DARK.textSub }}>
                      {systemDetails.least.name}
                    </span>
                    <span className="text-[11px] font-bold tabular-nums shrink-0 pl-1" style={{ color: DARK.red }}>
                      {formatPct(systemDetails.least.score)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-1">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full flex items-center justify-between text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  color: DARK.textSub,
                  border: `1px solid ${DARK.border}`,
                }}
              >
                <span>Details</span>
                <ChevronDown size={12} style={{ transform: showDetails ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              <AnimatePresence initial={false}>
                {showDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="mt-2 p-2.5 rounded-lg space-y-4" style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${DARK.border}` }}>
                      <div className="space-y-2">
                        <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: DARK.accent }}>
                          Evaluation Framework (10 Dimensions)
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            'Capacity',
                            'Capability',
                            'Reliability',
                            'Operational Availability',
                            'Operational Maintainability',
                            'Safety',
                            'Pending Defects',
                            'Stealth',
                            'Non-Vulnerability',
                            'Recoverability',
                          ].map((dim, idx) => (
                            <div
                              key={dim}
                              className="flex items-center gap-1.5 p-1.5 rounded min-w-0"
                              style={{
                                background: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                              }}
                            >
                              <span className="text-[9px] font-mono shrink-0" style={{ color: DARK.textMuted }}>
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <span className="text-[10.5px] font-medium leading-tight whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: DARK.textSub }}>
                                {dim}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2.5 pt-2 border-t border-white/[0.05]">
                        <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: DARK.blue }}>
                          Analytical Aggregation Engine
                        </div>
                        <div className="space-y-0.5">
                          Equipment-level performance measures are integrated to derive system-level scores using a conservative, non-compensatory approach, ensuring that deficiencies in critical dimensions are not masked by strengths in others. The evaluation incorporates mission-phase-specific importance through expert-defined weighting, reflecting the varying significance of each dimension across different operational scenarios. The individual dimension scores are then combined using an advanced multi-criteria aggregation framework that accounts for interactions among the dimensions to derive an overall Utility Index for each system in every mission phase. The framework also considers mission-specific priorities and uncertainty in the input data to provide a comprehensive and realistic assessment of overall system dependability.
                        </div>
                      </div>

                      <a
                        href="/index.csv"
                        download="index.csv"
                        className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded transition-colors"
                        style={{ background: DARK.accent, color: DARK.bg }}
                        onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
                        onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
                      >
                        <Download size={11} />
                        Download Report
                      </a>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ background: DARK.surface, borderBottom: `1px solid ${DARK.border}` }}>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold tracking-widest uppercase" style={{ color: DARK.accent }}>Candidate Ships</div>
          {incident && (
            <div className="text-[9px] font-mono mt-0.5" style={{ color: DARK.textMuted }}>
              incident {incident.lat.toFixed(4)}°N, {incident.lng.toFixed(4)}°E
            </div>
          )}
        </div>
        <AnimatePresence>
          {phase === 'calculating' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-[10px]" style={{ color: DARK.textMuted }}>
              <Loader2 className="size-3 animate-spin" /> calculating…
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button onClick={onClose} whileHover={{ rotate: 90 }} whileTap={{ scale: 0.9 }} transition={SPRING_SNAPPY} className="flex items-center justify-center w-7 h-7 rounded-lg ml-2" style={{ color: DARK.textMuted }}>
          <X className="size-4" />
        </motion.button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {ships.length === 0 && (
          <div className="text-[11px] text-center py-8" style={{ color: DARK.textMuted }}>No candidate ships identified.</div>
        )}

        {phase === 'calculating' && ships.map((s, i) => <ShipSkeletonItem key={s.name} delay={i * 0.06} />)}

        {phase === 'revealed' && (
          <div className="space-y-2">
            {baseList.map((r, i) => (
              <ShipRow
                key={r.ship.name}
                ranked={r}
                rank={i + 1}
                qualified={isQualified(r, overrides)}
                overriddenSet={overrides[r.ship.name] ?? new Set()}
                onToggleOverride={(key) => toggleOverride(r.ship.name, key)}
                expanded={expandedShip === r.ship.name}
                onToggle={() => setExpandedShip((cur) => (cur === r.ship.name ? null : r.ship.name))}
                onOpenDashboard={onOpenDashboard}
                isExplaining={explainingShip?.ship.name === r.ship.name}
                onToggleExplain={() => handleToggleExplainShip(r)}
              />
            ))}
          </div>
        )}

        {phase === 'ranked' && (
          <motion.div layout className="space-y-3">
            <AnimatePresence mode="popLayout">
              {qualifiedShips.length > 0 && (
                <motion.div key="qualified-group" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <GroupContainer color={DARK.green} label="Qualified" count={qualifiedShips.length}>
                    <AnimatePresence initial={false} mode="popLayout">
                      {renderRows(qualifiedShips, true)}
                    </AnimatePresence>
                  </GroupContainer>
                </motion.div>
              )}

              {disqualifiedShips.length > 0 && (
                <motion.div key="disqualified-group" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <GroupContainer color={DARK.red} label="Disqualified" count={disqualifiedShips.length}>
                    <AnimatePresence initial={false} mode="popLayout">
                      {renderRows(disqualifiedShips, false)}
                    </AnimatePresence>
                  </GroupContainer>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      {phase === 'ranked' && (
        <div className="shrink-0 px-3 pb-4 pt-2 space-y-3 max-h-[70vh] overflow-y-auto" style={{ borderTop: `1px solid ${DARK.border}` }}>
          <button
            onClick={() => setShowCommonExplain((v) => !v)}
            className="w-full text-[11px] font-semibold rounded-lg py-2.5 transition-colors"
            style={{
              background: showCommonExplain ? DARK.accentDim : 'rgba(255,255,255,0.06)',
              color: showCommonExplain ? DARK.accent : DARK.textSub,
              border: `1px solid ${showCommonExplain ? 'rgba(250,229,0,0.3)' : DARK.border}`,
            }}
          >
            {showCommonExplain ? 'Hide ranking rationale' : 'Explain ranking'}
          </button>
          <AnimatePresence>
            {showCommonExplain && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: EASE_OUT }} style={{ overflow: 'hidden' }}>
                <ExplainText isCommon scenario={rankingScenario} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}