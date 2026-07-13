'use client';

import {
  useRef, useEffect, useCallback, useState, useMemo,
} from 'react';
import {
  Loader2, Maximize2, Share2, AlertCircle, ChevronDown, ChevronUp,
  GitBranch, ListCollapse, Sparkles, CheckCircle2,
} from 'lucide-react';
import GraphCanvas from '@/components/GraphCanvas';
import fmecaGraph from '@/components/oneShipFmeca.json';
import q1Subgraph from '@/components/subgraphs/q1.json';
import q2Subgraph from '@/components/subgraphs/q2.json';
import q3Subgraph from '@/components/subgraphs/q3.json';
import IntegratedMissionConfigDashboard from '@/components/mission_config/integrated_mission_config_dashboard';
import SensorChart from '../views/sensor-chart';
import RULResultsTable from '../views/rul';
import type { QueryResponse, ReasoningPath, KGSubgraph } from '@/components/ship_panel/shipPanel';
import ReliabilityResultsView from '@/components/mission_config/views/reliability_result_view';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QueryLogEntry {
  id: string;
  text: string;
  phase: 'loading' | 'traversing' | 'done' | 'error';
  type?: 'kg' | 'mission' | 'mission_recommendation';
  traversalPaths?: ReasoningPath[];
  response?: QueryResponse;
  error?: string;
  intent?: string;
  toolCalls?: any[];
  textResponse?: string;
  reliabilityData?: any;
  selectedConfig?: any;
}

// ─── Question → subgraph mapping ─────────────────────────────────────────────
//
// Each entry maps a canonical question (matched by keywords) to a statically
// imported subgraph. Add new entries here as more questions are onboarded.

const QUESTION_SUBGRAPH_MAP: { keywords: RegExp; graph: KGSubgraph }[] = [
  {
    // Q1 – downtime impact on Gas Turbine 1 / seizing
    keywords: /downtime.*(gas turbine|gt[\s-]?1)|seiz.*(gas turbine|gt[\s-]?1)|(gas turbine|gt[\s-]?1).*seiz/i,
    graph: q1Subgraph as unknown as KGSubgraph,
  },
  {
    // Q2 – equipment with clogging failure mode
    keywords: /clogging|clogs/i,
    graph: q2Subgraph as unknown as KGSubgraph,
  },
  {
    // Q3 – failure modes on gas turbine
    keywords: /failure mode.*gas turbine|gas turbine.*failure mode/i,
    graph: q3Subgraph as unknown as KGSubgraph,
  },
];

/**
 * Returns the matching subgraph for a query string, or null if none match.
 */
function resolveQuestionSubgraph(query: string): KGSubgraph | null {
  for (const { keywords, graph } of QUESTION_SUBGRAPH_MAP) {
    if (keywords.test(query)) return graph;
  }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function stripUri(s: string): string {
  if (!s) return '';
  let out = s.replace(UUID_RE, '').trim();
  out = out.replace(/^[\s::,]+|[\s::,]+$/g, '').trim();
  if (!out) return '';
  const hashIdx = out.lastIndexOf('#');
  if (hashIdx !== -1) return out.slice(hashIdx + 1).replace(/_/g, ' ');
  return out.replace(/_/g, ' ');
}

function isIdOnly(s: string): boolean {
  if (!s) return true;
  const cleaned = s.replace(UUID_RE, '').trim().replace(/^[\s::,]+|[\s::,]+$/g, '').trim();
  return cleaned.length === 0;
}

function getDetailLabel(d: any): string {
  const raw = d?.label ?? d?.name ?? d?.key ?? d?.type ?? '';
  return String(raw).replace(/_/g, ' ');
}

function getDetailValue(d: any): string {
  const raw = d?.value ?? d?.time ?? d?.amount ?? '';
  return String(raw);
}

function normalizeDetails(raw: any[]): { label: string; value: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(d => d && typeof d === 'object')
    .map(d => ({ label: getDetailLabel(d), value: getDetailValue(d) }))
    .filter(d => d.label.trim() !== '');
}

function hasDowntimeDetails(response: QueryResponse): boolean {
  try {
    const details = normalizeDetails(JSON.parse(response.note ?? '[]'));
    return details.some(d => /\d/.test(d.value));
  } catch {
    return false;
  }
}

// ─── Node type classifier ─────────────────────────────────────────────────────

type NodeKind = 'eq' | 'asm' | 'fm' | 'ok' | 'cmd' | 'neutral';

function classifyNode(label: string): NodeKind {
  const l = label.toLowerCase();
  if (/eastern command|fleet a|western fleet|eastern fleet/.test(l)) return 'cmd';
  if (/^ins |^ins$|tushil|kolkata|chennai|tabar|saryu|imphal|visakhapatnam|tamal/.test(l)) return 'eq';
  if (/^gt\d|^gtg\d|^ac\d|^srgm/.test(l)) return 'eq';
  if (/seizing|clogging|leaking|failure mode/.test(l)) return 'fm';
  if (/repair|logistics|assembly|downtime|performance loss|consequence/.test(l)) return 'ok';
  if (/fuel system|lube oil|hp air|oil filter|oil pump|booster|fine fuel|air filter|air compress/.test(l)) return 'asm';
  return 'neutral';
}

const NODE_STYLES: Record<NodeKind, { bg: string; border: string; text: string }> = {
  cmd: { bg: '#1a1a0e', border: '#5a5a1a', text: '#e4e472' },
  eq: { bg: '#0e1929', border: '#1a5aaa', text: '#6cabff' },
  asm: { bg: '#1a1e2e', border: '#2a3050', text: '#e4e8fa' },
  fm: { bg: '#2a1010', border: '#5a1a1a', text: '#f07272' },
  ok: { bg: '#0a1e0a', border: '#1a5a1a', text: '#72c472' },
  neutral: { bg: '#131620', border: '#2a3050', text: '#a9b0d1' },
};

// ─── remapHighlightToFmeca ────────────────────────────────────────────────────

function remapHighlightToFmeca(
  paths: ReasoningPath[],
  fmeca: { nodes: any[]; edges: any[] },
): ReasoningPath[] {
  if (!paths?.length) return [];

  const nodeById = new Map<string, any>();
  const outgoing = new Map<string, any[]>();

  for (const n of fmeca.nodes ?? []) {
    nodeById.set(String(n.id), n);
  }

  for (const e of fmeca.edges ?? []) {
    const s = String(e.s ?? e.source ?? e.from);
    const t = String(e.t ?? e.target ?? e.to);

    if (!outgoing.has(s)) outgoing.set(s, []);
    outgoing.get(s)!.push({
      source: s,
      target: t,
      relation: String(e.r ?? e.relation ?? e.label ?? ""),
    });
  }

  const norm = (x: any) => String(x || "").trim().toLowerCase().replace(/_/g, " ");
  const result: ReasoningPath[] = [];

  for (const step of paths) {
    const srcLabel = norm(step.source);
    const tgtLabel = norm(step.target);
    const rel = norm(step.relation ?? "");

    const sourceNode = fmeca.nodes.find(
      n => n.label && (norm(n.label) === srcLabel || norm(n.label).includes(srcLabel) || srcLabel.includes(norm(n.label)))
    );

    if (!sourceNode) continue;

    const candidates = outgoing.get(String(sourceNode.id)) ?? [];

    const match = candidates.find(edge => {
      if (rel && norm(edge.relation) !== rel) return false;
      const targetNode = nodeById.get(edge.target);
      return targetNode && targetNode.label && (
        norm(targetNode.label) === tgtLabel ||
        norm(targetNode.label).includes(tgtLabel) ||
        tgtLabel.includes(norm(targetNode.label))
      );
    });

    if (match) {
      result.push({
        source: match.source,
        relation: match.relation,
        target: match.target,
      });
    }
  }

  return result;
}

// ─── buildChain ───────────────────────────────────────────────────────────────



// ─── PathStep ─────────────────────────────────────────────────────────────────

function nodeClass(label: string): string {
  const kind = classifyNode(stripUri(label));
  return {
    cmd: 'rounded px-2 py-0.5 text-[11px] font-medium bg-[#1a1a0e] border border-[#5a5a1a] text-[#e4e472]',
    eq: 'rounded px-2 py-0.5 text-[11px] font-medium bg-[#0e1929] border border-[#1a4a8a] text-[#6cabff]',
    asm: 'rounded px-2 py-0.5 text-[11px] font-medium bg-[#1a1e2e] border border-[#2a3050] text-[#e4e8fa]',
    fm: 'rounded px-2 py-0.5 text-[11px] font-medium bg-[#2a1010] border border-[#5a1a1a] text-[#f07272]',
    ok: 'rounded px-2 py-0.5 text-[11px] font-medium bg-[#0a1e0a] border border-[#1a5a1a] text-[#72c472]',
    neutral: 'rounded px-2 py-0.5 text-[11px] font-medium bg-[#131620] border border-[#2a3050] text-[#a9b0d1]',
  }[kind];
}

function PathStep({ source, relation, target }: ReasoningPath) {
  const s = stripUri(source);
  const t = stripUri(target);
  if (isIdOnly(source) || isIdOnly(target) || !s || !t) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={nodeClass(s)}>{s}</span>
      <span className="text-[#5a6080] font-mono text-[11px]">→</span>
      <span className="text-[#a9b0d1] font-mono text-[10px]">{relation}</span>
      <span className="text-[#5a6080] font-mono text-[11px]">→</span>
      <span className={nodeClass(t)}>{t}</span>
    </div>
  );
}

// ─── PathBlock ────────────────────────────────────────────────────────────────

function PathBlock({ title, hops, paths }: { title: string; hops: number; paths: ReasoningPath[] }) {
  const validPaths = paths.filter(p => !isIdOnly(p.source) && !isIdOnly(p.target));
  if (validPaths.length === 0) return null;
  return (
    <div className="rounded-xl border border-[#1e2130] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[#0d0f16] border-b border-[#1e2130]">
        <span className="text-[10px] uppercase tracking-widest text-[#8b92b0]">{title}</span>
        <span className="text-[10px] font-semibold text-[#6cabff] bg-[#0e1929] rounded-full px-2 py-0.5">
          {hops} hops
        </span>
      </div>
      <div className="p-3 bg-[#13161f] flex flex-col gap-2">
        {validPaths.map((p, i) => <PathStep key={i} {...p} />)}
      </div>
    </div>
  );
}

// ─── BarRow ───────────────────────────────────────────────────────────────────

function BarRow({
  name, value, pct, color, isLast,
}: { name: string; value: string; pct: number; color: string; isLast?: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-2.5 ${!isLast ? 'border-b border-[#1a1d28]' : ''}`}>
      <span className="text-[13px] text-[#a9b0d1] w-[110px] shrink-0 capitalize">{name}</span>
      <div className="flex-1 h-[5px] bg-[#1a1e2e] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[13px] font-semibold text-[#e4e8fa] tabular-nums w-[44px] text-right">
        {value}
      </span>
    </div>
  );
}

// ─── KGAnswerCard ─────────────────────────────────────────────────────────────

interface KGAnswerCardProps {
  queryText?: string;
  response: QueryResponse;
  subgraph: KGSubgraph | undefined;
  onOpenFmecaGraph: () => void;
  onSubgraphUpdate?: (subgraph: KGSubgraph, highlight: ReasoningPath[]) => void;
  entryId: string;
}

export function KGAnswerCard({
  queryText,
  response,
  subgraph,
  onOpenFmecaGraph,
  onSubgraphUpdate,
  entryId,
}: KGAnswerCardProps) {
  // const [openPanel, setOpenPanel] = useState<'details' | 'paths' | null>(() => {
  //   const hasPaths = (response.reasoning_paths ?? []).length > 0;
  //   return hasPaths ? 'paths' : 'details';
  // });

  const [openPanel, setOpenPanel] = useState<'details' | 'paths' | null>(null);
  // ── Resolve the per-question subgraph ──────────────────────────────────────
  // Priority: question-specific JSON > response.subgraph (if non-empty) > full FMECA graph
  const questionSubgraph = useMemo(
    () => (queryText ? resolveQuestionSubgraph(queryText) : null),
    [queryText],
  );

  const responseSubgraphValid = subgraph && (subgraph.nodes?.length ?? 0) > 0;

  const displayGraph: KGSubgraph = (
    questionSubgraph ??
    (responseSubgraphValid ? subgraph : null) ??
    fmecaGraph
  ) as KGSubgraph;

  // ── Parse details ──────────────────────────────────────────────────────────
  const dynamicDetails: { label: string; value: string }[] = (() => {
    try { return normalizeDetails(JSON.parse(response.note ?? '[]')); } catch { return []; }
  })();

  const hasDetails = dynamicDetails.some(d => /\d/.test(d.value));

  const barItems = (() => {
    if (!hasDetails) return [];
    const items = dynamicDetails
      .filter(d => !d.label.toLowerCase().includes('total') && !d.label.toLowerCase().includes('downtime'))
      .map(d => {
        const numMatch = String(d.value).match(/[\d.]+/);
        return { name: d.label, value: d.value, num: numMatch ? parseFloat(numMatch[0]) : 0 };
      });
    const total = items.reduce((s, i) => s + i.num, 0) || 1;
    return items.map(i => ({ name: i.name, value: i.value, pct: Math.round((i.num / total) * 100) }));
  })();

  const totalDowntime = (() => {
    if (!hasDetails) return null;
    const dt = dynamicDetails.find(d =>
      d.label.toLowerCase().includes('downtime') || d.label.toLowerCase().includes('total')
    );
    return dt?.value ?? null;
  })();

  // ── Reasoning paths ────────────────────────────────────────────────────────
  const rawPaths: ReasoningPath[] = (response.reasoning_paths ?? []).map(p => ({
    source: String(p.source),
    relation: String(p.relation),
    target: String(p.target),
  }));

  const hasValidPaths = rawPaths.length > 0 && rawPaths.some(
    p => !isIdOnly(p.source) && !isIdOnly(p.target),
  );

  const FAILURE_RELS = new Set([
    'hasAssembly', 'hasSubassembly', 'hasSubAssembly', 'hasFailureMode',
    'LEADS_TO', 'PRODUCES', 'TRIGGERS', 'EXHIBITS',
    'hasFleet', 'hasShip', 'hasEquipment',
  ]);
  const DOWNTIME_RELS = new Set([
    'hasDowntime', 'hasRepair', 'hasLogistics', 'hasAssemblyTime',
    'ASSESSED_BY', 'RECOMMENDS', 'incursCost', 'includes',
  ]);

  const failurePaths = rawPaths.filter(
    p => FAILURE_RELS.has(p.relation) && !isIdOnly(p.source) && !isIdOnly(p.target),
  );
  const downtimePaths = rawPaths.filter(
    p => DOWNTIME_RELS.has(p.relation) && !isIdOnly(p.source) && !isIdOnly(p.target),
  );
  const kgPaths = rawPaths.filter(p => !isIdOnly(p.source) && !isIdOnly(p.target));

  // ── Highlight edges ────────────────────────────────────────────────────────
  // Q1/Q2/Q3 → highlight all edges in the static subgraph
  // Other questions with response.subgraph → highlight all its edges directly
  // Fallback → remap API reasoning paths onto the full FMECA graph
  const fmecaHighlight: ReasoningPath[] = useMemo(() => {
    if (questionSubgraph) {
      return (questionSubgraph.edges ?? []).map((e: any) => ({
        source: String(e.s ?? e.source ?? e.from ?? ''),
        relation: String(e.r ?? e.relation ?? e.label ?? ''),
        target: String(e.t ?? e.target ?? e.to ?? ''),
      }));
    }
    if (responseSubgraphValid) {
      // Node IDs in the response subgraph are self-consistent — highlight everything
      return (subgraph!.edges ?? []).map((e: any) => ({
        source: String(e.s ?? e.source ?? e.from ?? ''),
        relation: String(e.r ?? e.relation ?? e.label ?? ''),
        target: String(e.t ?? e.target ?? e.to ?? ''),
      }));
    }
    return remapHighlightToFmeca(rawPaths, displayGraph as any);
  }, [questionSubgraph, responseSubgraphValid, subgraph, rawPaths, displayGraph]);

  function toggle(panel: 'details' | 'paths') {
    setOpenPanel(prev => prev === panel ? null : panel);
  }

  const barColors = ['#1a4a8a', '#2a5a4a', '#2a3a6a', '#3a2a6a'];
  const cleanEntities = (response.entities_found ?? []).filter(e => !isIdOnly(e));

  // ── Graph canvas label ─────────────────────────────────────────────────────
  const graphLabel = questionSubgraph
    ? `Subgraph · ${fmecaHighlight.length} edges highlighted`
    : responseSubgraphValid
      ? `Response subgraph · ${fmecaHighlight.length} edges highlighted`
      : `FMECA graph · ${fmecaHighlight.length} edges highlighted`;

  // ── Graph key for GraphCanvas cache-busting ────────────────────────────────
  const graphKey = questionSubgraph
    ? `q_${entryId}`
    : responseSubgraphValid
      ? `resp_${entryId}`
      : 'fmeca';

  return (
    <div className="rounded-2xl overflow-hidden border border-[#1e2130] bg-[#0f1117]">

      {/* ── Answer header ── */}
      <div className="px-4 py-3 border-b border-[#1e2130]">
        {response.answer && (
          <p className="text-[14px] text-white leading-relaxed">{response.answer}</p>
        )}
      </div>

      {/* ── Toggle buttons ── */}
      {(hasDetails || hasValidPaths) && (
        <div className="flex gap-2 px-4 py-2.5 bg-[#0d0f16] border-b border-[#1e2130]">
          {hasDetails && (
            <button
              onClick={() => toggle('details')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium border transition-colors ${openPanel === 'details'
                ? 'bg-[#0e1929] border-[#1a4a8a] text-[#6cabff]'
                : 'bg-[#13161f] border-[#1e2130] text-[#a9b0d1] hover:border-[#2a3050] hover:text-[#e4e8fa]'
                }`}
            >
              <ListCollapse className="size-3.5" />
              Details
              {openPanel === 'details' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
          )}
          {hasValidPaths && (
            <button
              onClick={() => toggle('paths')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium border transition-colors ${openPanel === 'paths'
                ? 'bg-[#0e1929] border-[#1a4a8a] text-[#6cabff]'
                : 'bg-[#13161f] border-[#1e2130] text-white hover:border-[#2a3050] hover:text-[#e4e8fa]'
                }`}
            >
              <GitBranch className="size-3.5" color='white'/>
              Explain path
              {openPanel === 'paths' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
          )}
        </div>
      )}

      {/* ── Details panel ── */}
      {openPanel === 'details' && hasDetails && (
        <div className="px-4 py-3 border-b border-[#1e2130]">
          

          

          {barItems.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-widest text-white mb-1">Time breakdown</p>
              {barItems.map((item, i) => (
                <BarRow
                  key={i}
                  name={item.name}
                  value={item.value}
                  pct={item.pct}
                  color={barColors[i % barColors.length]}
                  isLast={i === barItems.length - 1}
                />
              ))}
              {totalDowntime && (
                <div className="flex justify-between items-center mt-2 pt-2.5 border-t border-[#2a3050]">
                  <span className="text-[13px] text-white">Total downtime</span>
                  <span className="text-[15px] font-bold text-white">{totalDowntime}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Explain path panel ── */}
      {openPanel === 'paths' && hasValidPaths && (
        <div className="px-4 py-3 border-b border-[#1e2130] flex flex-col gap-3">

          {failurePaths.length > 0 && (
            <PathBlock
              title="path"
              hops={failurePaths.length}
              paths={failurePaths}
            />
          )}

          {/* {downtimePaths.length > 0 && (
            <PathBlock
              title="Consequence & downtime path"
              hops={downtimePaths.length}
              paths={downtimePaths}
            />
          )} */}

          {failurePaths.length === 0 && downtimePaths.length === 0 && kgPaths.length > 0 && (
            <PathBlock
              title="Reasoning path"
              hops={kgPaths.length}
              paths={kgPaths}
            />
          )}

          {/* ── Subgraph / FMECA canvas ── */}
          <div className="rounded-xl border border-[#1e2130] overflow-hidden">
            <div className="px-3 py-2 bg-[#0f1117] border-b border-[#1e2130] flex items-center justify-between">
              {/* <span className="text-[10px] uppercase tracking-widest text-[#8b92b0]">
                {graphLabel}
              </span> */}
              <button
                onClick={onOpenFmecaGraph}
                className="text-[#8b92b0] hover:text-[#6cabff] transition-colors"
              >
                <Maximize2 className="size-3" />
              </button>
            </div>

            <GraphCanvas
              key={`${entryId}_explain_${graphKey}`}
              compact
              graph={displayGraph}
              graphKey={graphKey}
              highlight={fmecaHighlight}
            />
          </div>
        </div>
      )}

      {/* ── Show on main graph ── */}
      {onSubgraphUpdate && fmecaHighlight.length > 0 && (
        <div className="px-4 pb-3 pt-0 border-t border-[#1e2130]">
          <button
            onClick={() => onSubgraphUpdate(displayGraph, fmecaHighlight)}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium text-[#6cabff] bg-[#0e1929] hover:bg-[#122040] transition-colors mt-2"
          >
            <Share2 className="size-3" />Show on main graph
          </button>
        </div>
      )}
    </div>
  );
}

// ─── TextAnswerCard ───────────────────────────────────────────────────────────

function TextAnswerCard({ text }: { text: string }) {
  const clean = text
    .split(',')
    .map(s => stripUri(s.trim()))
    .filter(s => s && !isIdOnly(s))
    .join(', ');
  const display = clean || text;
  return (
    <div className="rounded-2xl bg-[#0f1117] border border-[#1e2130] px-4 py-3">
      <p className="text-[14px] text-[#c8cde8] leading-relaxed whitespace-pre-wrap">{display}</p>
    </div>
  );
}

// ─── CardSkeleton ─────────────────────────────────────────────────────────────

export function CardSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-[14px] text-[#a9b0d1]">
      <Loader2 className="size-4 animate-spin text-[#6cabff]" />{label}…
    </div>
  );
}

// ─── renderEntryContent ───────────────────────────────────────────────────────

function renderEntryContent(
  ship: string,
  entry: QueryLogEntry,
  onOpenFmecaGraph: () => void,
  onSubgraphUpdate?: (ship: string, subgraph: KGSubgraph, highlight: ReasoningPath[]) => void,
) {
  if (entry.intent === 'SENSOR' && entry.toolCalls?.length) {
    return <SensorChart ship={ship} toolCalls={entry.toolCalls} />;
  }

  if (entry.intent === 'RUL' && entry.toolCalls?.length) {
    return <RULResultsTable ship={ship} toolCalls={entry.toolCalls} />;
  }

  if (entry.intent === 'KG' && entry.response) {
    return (
      <KGAnswerCard
        queryText={entry.text}
        response={entry.response}
        subgraph={entry.response.subgraph}
        onOpenFmecaGraph={onOpenFmecaGraph}
        onSubgraphUpdate={onSubgraphUpdate}
        entryId={entry.id}
      />
    );
  }

  if (entry.response) {
    const hasPaths = (entry.response.reasoning_paths?.length ?? 0) > 0;
    if (hasPaths || hasDowntimeDetails(entry.response)) {
      return (
        <KGAnswerCard
          queryText={entry.text}
          response={entry.response}
          subgraph={entry.response.subgraph}
          onOpenFmecaGraph={onOpenFmecaGraph}
          onSubgraphUpdate={onSubgraphUpdate}
          entryId={entry.id}
        />
      );
    }
    if (entry.response.answer?.trim()) {
      return <TextAnswerCard text={entry.response.answer} />;
    }
  }

  if (entry.textResponse?.trim()) {
    return <TextAnswerCard text={entry.textResponse} />;
  }

  return null;
}

// ─── QueryView ────────────────────────────────────────────────────────────────

interface QueryViewProps {
  ship: string;
  entries: QueryLogEntry[];
  onOpenFmecaGraph: () => void;
  onSubgraphUpdate?: (subgraph: KGSubgraph, highlight: ReasoningPath[]) => void;
}

export default function QueryView({
  ship, entries, onOpenFmecaGraph, onSubgraphUpdate,
}: QueryViewProps) {
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mt-2">
      {entries.map(entry => {
        if (entry.type === 'mission') {
          return (
            <div key={entry.id} className="flex flex-col gap-2">
              <UserBubble text={entry.text} />
              <div className="rounded-2xl overflow-hidden">
                <IntegratedMissionConfigDashboard />
              </div>
            </div>
          );
        }

        if (entry.type === 'mission_recommendation') {
          return (
            <div key={entry.id} className="flex flex-col gap-2">
              <UserBubble text={entry.text} />
              {entry.phase === 'loading' && (
                <div className="rounded-2xl bg-[#13161f] border border-[#1e2130] p-3">
                  <CardSkeleton label="Calculating best equipment combination" />
                </div>
              )}
              {entry.phase === 'error' && (
                <div className="rounded-2xl bg-[#13161f] border border-[#1e2130] p-3">
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold bg-[#2a1010] text-[#f07272]">
                    <AlertCircle className="size-3.5" />{entry.error ?? 'Recommendation failed'}
                  </span>
                </div>
              )}
              {entry.phase === 'done' && entry.reliabilityData && (
                <div className="rounded-2xl overflow-hidden border border-[#1e2130]">
                  <ReliabilityResultsView
                    ship={ship}
                    reliabilityData={entry.reliabilityData}
                    onBack={() => { }}
                    selectedConfig={entry.selectedConfig}
                    comparisonId={entry.id}
                    hideBackButton={true}
                  />
                </div>
              )}
            </div>
          );
        }

        const content = renderEntryContent(ship, entry, onOpenFmecaGraph, onSubgraphUpdate);

        return (
          <div key={entry.id} className="flex flex-col gap-2">
            <UserBubble text={entry.text} />

            {content ?? (
              <>
                {entry.phase === 'loading' && (
                  <div className="rounded-2xl bg-[#13161f] border border-[#1e2130] p-3">
                    <CardSkeleton label="Querying graph" />
                  </div>
                )}
                {entry.phase === 'traversing' && (
                  <div className="rounded-2xl bg-[#0f1117] border border-[#1e2130] overflow-hidden">
                    <div className="flex items-center gap-2 px-3.5 py-2.5">
                      <Loader2 className="size-3.5 animate-spin text-[#6cabff] shrink-0" />
                      <span className="text-[13px] font-medium text-[#a9b0d1]">Processing…</span>
                      {(entry.traversalPaths?.length ?? 0) > 0 && (
                        <span className="ml-auto text-[11px] font-semibold rounded-full px-2 py-0.5 bg-[#0e1929] text-[#6cabff]">
                          {entry.traversalPaths!.length} path{entry.traversalPaths!.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {entry.phase === 'error' && (
                  <div className="rounded-2xl bg-[#13161f] border border-[#1e2130] p-3">
                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold bg-[#2a1010] text-[#f07272]">
                      <AlertCircle className="size-3.5" />{entry.error ?? 'Query failed'}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── UserBubble ───────────────────────────────────────────────────────────────

function UserBubble({ text }: { text: string }) {
  return (
    <div className="self-end max-w-[88%] flex items-start gap-2 rounded-2xl rounded-br-md bg-[#1a4a8a] px-3.5 py-2.5">
      <Sparkles className="size-3.5 mt-0.5 text-white shrink-0" />
      <span className="leading-snug font-semibold text-[15px] text-white">{text}</span>
    </div>
  );
}