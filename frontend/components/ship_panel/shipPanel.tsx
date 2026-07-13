'use client';
import {
  AlertCircle,
  Anchor,
  ArrowUp,
  Check,
  Loader2,
  Pencil,
  Route,
  Save,
  Share2,
  Shield,
  ShieldAlert,
  Sparkles,
  X,
  XCircle
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import GraphCanvas from '@/components/GraphCanvas';
import fmecaGraph from '@/components/oneShipFmeca.json';
import DashboardView from '@/components/ship_panel/views/DashboardView';
import QueryView from '@/components/ship_panel/views/QueryView';
import ShipActivityPanel from '@/components/ship_panel/views/Shipactivitypanel';
import ShipTimelinePanel from '../globe/views/ShipActivityPanel';
import { classifyQuery, transformQueryForChatEndpoint } from '@/lib/classifyQuery';
import type { QueryLogEntry } from '@/components/ship_panel/views/QueryView';
import { SitrepUploader } from '../SitrepUploader';
import { ollamaFmecaQuery } from '@/lib/prompts/fmeca';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShipInfo {
  name: string;
  lat: number;
  lng: number;
  id?: string;
}

export interface ReasoningPath {
  source: string;
  relation: string;
  target: string;
}

export interface KGSubgraph {
  metadata?: Record<string, unknown>;
  nodes: unknown[];
  edges: unknown[];
}

export interface QueryResponse {
  query: string;
  answer: string;
  entities_found: string[];
  relations_found: string[];
  reasoning_paths: ReasoningPath[];
  all_paths?: ReasoningPath[];
  paths_traversed?: number;
  paths_cap?: number;
  subgraph: KGSubgraph;
  note?: string | null;
}

interface ShipInfoPanelProps {
  open: boolean;
  onClose: () => void;
  ship: ShipInfo | null;
  width?: number;
  mapFocusMode?: boolean;
  onToggleMapFocus?: () => void;
  mapSlotRef?: React.Ref<HTMLDivElement>;
  onQuery?: (query: string) => Promise<QueryResponse>;
  onSubgraphUpdate?: (subgraph: KGSubgraph, highlight: ReasoningPath[]) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shipSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const LEGACY_SHIP_FILE_MAP: Record<string, string> = {
  'inskolkata': 'insone',
  'inschennai': 'instwo',
  'instushil': 'insthree',
  'instabar': 'insfour',
  'inssaryu': 'insfive',
  'insimphal': 'inssix',
  'insvisakhapatnam': 'insseven',
  'instamal': 'inseight',
};
const RECOMMEND_KEYWORD = 'recommend best equipment combination for the current mission';
function getShipFileSlug(shipId: string): string {
  return LEGACY_SHIP_FILE_MAP[shipId] ?? shipId;
}

function setDeep(obj: any, path: string[], value: any): any {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  const base = obj && typeof obj === 'object' ? obj : {};
  const clone: any = Array.isArray(base) ? [...base] : { ...base };
  clone[head] = setDeep(base[head], rest, value);
  return clone;
}

let queryIdCounter = 0;
function nextQueryId() { queryIdCounter += 1; return `q_${Date.now()}_${queryIdCounter}`; }

const MISSION_KEYWORD = 'mission';
const TIMELINE_KEYWORD = 'show timeline';
type DashTab = 'combat' | 'mission' | 'logistics';

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function ShipInfoPanel({
  open, onClose, ship, width = 420, onSubgraphUpdate,
}: ShipInfoPanelProps) {
  const [combatState, setCombatState] = useState<Record<string, any> | null>(null);
  const [combatLoading, setCombatLoading] = useState(false);
  const [combatError, setCombatError] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const slugRef = useRef<string>('');

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [activityOpen, setActivityOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<DashTab>('combat');
  const [inputValue, setInputValue] = useState('');
  const [queryLog, setQueryLog] = useState<QueryLogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const latestQueryIdRef = useRef<string | null>(null);

  const [fmecaModalOpen, setFmecaModalOpen] = useState(false);

  const queryHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const draftValueRef = useRef<string>('');

  useEffect(() => {
    if (!ship) return;
    setInputValue('');
    setQueryLog([]);
    setFmecaModalOpen(false);
    latestQueryIdRef.current = null;
    setCombatState(null);
    setCombatError(null);
    setActiveTab('combat');
    setEditMode(false);
    setSaveError(null);
    setSaveSuccess(false);
    setActivityOpen(false);
    setTimelineOpen(false);
    queryHistoryRef.current = [];
    historyIndexRef.current = -1;
    draftValueRef.current = '';

    const rawId = ship.id;
    const slug = rawId && rawId !== 'undefined' ? rawId : shipSlug(ship.name);
    slugRef.current = slug;
    setCombatLoading(true);
    const fileSlug = getShipFileSlug(slug);
    fetch(`/ships/${fileSlug}.json`)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.json(); })
      .then(j => setCombatState(j))
      .catch(() => setCombatError('No vessel data found'))
      .finally(() => setCombatLoading(false));
  }, [ship]);

  const handleChange = useCallback((path: string[], value: any) => {
    setCombatState(prev => prev ? setDeep(prev, path, value) : prev);
  }, []);

  async function handleSave() {
    if (!ship || !combatState) return;
    const slug = slugRef.current;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/ships/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(combatState),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveSuccess(true);
      setEditMode(false);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      setSaveError(err?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    if (!ship) return;
    const slug = slugRef.current;
    setCombatLoading(true);
    setSaveError(null);
    const fileSlug = getShipFileSlug(slug);
    fetch(`/ships/${fileSlug}.json`)
      .then(r => r.json())
      .then(j => setCombatState(j))
      .catch(() => { })
      .finally(() => { setCombatLoading(false); setEditMode(false); });
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }

  // ─── handleSend ─────────────────────────────────────────────────────────────

  async function handleSend() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    if (trimmed.toLowerCase() === RECOMMEND_KEYWORD) {
      const recId = nextQueryId();
      latestQueryIdRef.current = recId;
      setQueryLog(log => [...log, {
        id: recId,
        text: trimmed,
        phase: 'loading',
        type: 'mission_recommendation',
      }]);
      setInputValue('');
      scrollToBottom();

      try {
        const res = await fetch('/api/mission-recommend');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { result, config } = await res.json();

        setQueryLog(log => log.map(e =>
          e.id === recId
            ? { ...e, phase: 'done', reliabilityData: result, selectedConfig: config }
            : e
        ));
      } catch (err: any) {
        if (latestQueryIdRef.current !== recId) return;
        setQueryLog(log => log.map(e =>
          e.id === recId
            ? { ...e, phase: 'error', error: err?.message ?? 'Recommendation failed' }
            : e
        ));
      }

      scrollToBottom();
      return;
    }

    const history = queryHistoryRef.current;
    if (history[history.length - 1] !== trimmed) history.push(trimmed);
    historyIndexRef.current = -1;
    draftValueRef.current = '';

    if (trimmed.toLowerCase() === MISSION_KEYWORD) {
      const missionId = nextQueryId();
      latestQueryIdRef.current = missionId;
      setQueryLog(log => [...log, { id: missionId, text: trimmed, phase: 'done', type: 'mission' }]);
      setInputValue('');
      scrollToBottom();
      return;
    }

    // ── Timeline keyword ─────────────────────────────────────────────────────
    if (trimmed.toLowerCase() === TIMELINE_KEYWORD) {
      setTimelineOpen(true);
      setInputValue('');
      return;
    }

    const id = nextQueryId();
    latestQueryIdRef.current = id;

    const classifier = classifyQuery(trimmed);
    if (classifier.signals.matched_ships.length === 0 && ship) {
      classifier.signals.matched_ships = [{
        ship_id: ship.id ?? shipSlug(ship.name),
        ship_name: ship.name.toUpperCase(),
      }];
      classifier.signals.has_multiple_ships = false;
    }

    // ── KG intent → Ollama FMECA ─────────────────────────────────────────────
    if (classifier.intent === 'KG') {
      setQueryLog(log => [...log, {
        id,
        text: trimmed,
        phase: 'loading' as const,
        type: 'kg' as const,
        intent: 'KG',
      }]);
      setInputValue('');
      scrollToBottom();

      try {
        const ollamaResult = await ollamaFmecaQuery(trimmed, fmecaGraph);

        if (latestQueryIdRef.current !== id) return;

        const queryResponse: QueryResponse = {
          query: trimmed,
          answer: ollamaResult.answer,
          entities_found: ollamaResult.entities_found ?? [],
          relations_found: ollamaResult.relations_found ?? [],
          reasoning_paths: (ollamaResult.reasoning_paths ?? []).map(p => ({
            source: String(p.source),
            relation: String(p.relation),
            target: String(p.target),
          })),
          paths_traversed: ollamaResult.paths_traversed ?? 0,
          note: JSON.stringify(ollamaResult.details ?? []),
          subgraph: { nodes: [], edges: [] },
        };

        setQueryLog(log =>
          log.map(e =>
            e.id === id
              ? { ...e, phase: 'done' as const, response: queryResponse, textResponse: ollamaResult.answer }
              : e,
          ),
        );
      } catch (err: any) {
        if (latestQueryIdRef.current !== id) return;
        setQueryLog(log =>
          log.map(e =>
            e.id === id
              ? { ...e, phase: 'error' as const, error: err?.message ?? 'Ollama query failed' }
              : e,
          ),
        );
      }

      scrollToBottom();
      return;
    }

    // ── All other intents → /chat ─────────────────────────────────────────────
    setQueryLog(log => [...log, { id, text: trimmed, phase: 'loading', type: 'kg' }]);
    setInputValue('');
    scrollToBottom();

    try {
      const chatQuery = transformQueryForChatEndpoint(trimmed);
      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: chatQuery,
          classifier,
          conversation_history: [],
          filters: { ships: [], explain: false },
          session_id: null,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (latestQueryIdRef.current !== id) return;

      if (data.error) {
        setQueryLog(log =>
          log.map(e => e.id === id ? { ...e, phase: 'error' as const, error: data.error } : e)
        );
      } else {
        setQueryLog(log =>
          log.map(e =>
            e.id === id
              ? {
                ...e,
                phase: 'done' as const,
                intent: data.intent ?? classifier.intent,
                toolCalls: data.tool_calls ?? [],
                textResponse: data.response ?? '',
              }
              : e
          )
        );
      }
    } catch (err: any) {
      if (latestQueryIdRef.current !== id) return;
      setQueryLog(log =>
        log.map(e =>
          e.id === id
            ? { ...e, phase: 'error' as const, error: err?.message ?? 'Request failed' }
            : e
        )
      );
    }

    scrollToBottom();
  }

  // ─── handleKeyDown ────────────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const history = queryHistoryRef.current;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      if (historyIndexRef.current === -1) draftValueRef.current = inputValue;
      const next = historyIndexRef.current === -1
        ? history.length - 1
        : Math.max(0, historyIndexRef.current - 1);
      historyIndexRef.current = next;
      setInputValue(history[next]);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndexRef.current === -1) return;
      const next = historyIndexRef.current + 1;
      if (next >= history.length) {
        historyIndexRef.current = -1;
        setInputValue(draftValueRef.current);
      } else {
        historyIndexRef.current = next;
        setInputValue(history[next]);
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      className={`absolute top-0 right-0 h-full z-30 bg-[#0d0f16] border-l border-[#1e2130] shadow-[0_0_40px_rgba(0,0,0,0.4)] transition-all duration-300 ease-in-out flex flex-col ${open ? 'translate-x-0' : 'translate-x-full'}`}
      style={{ width }}
    >
      {/* ── Header ── */}
      <div className="shrink-0 px-4 pt-3 pb-2.5 border-b border-[#1e2130] bg-[#13161f]">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <span className="block text-[17px] font-semibold text-white truncate leading-tight">
              {ship?.name ?? '—'}
            </span>
            {ship && (
              <span className="text-[11px] text-[#5a6080] tabular-nums">
                {ship.lat.toFixed(4)}, {ship.lng.toFixed(4)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            {!activityOpen && (
              <button
                onClick={() => setActivityOpen(true)}
                title="Ship activity"
                className="rounded-lg px-3 py-2 text-white bg-[#1a4a8a] hover:bg-[#1e5cb0] transition-colors flex items-center gap-1.5"
              >
                <ShieldAlert className="size-4" />
                <span className="text-[14px] font-bold">Ship Activity</span>
              </button>
            )}

            {combatState && !editMode && !activityOpen && (
              <button
                onClick={() => { setEditMode(true); setSaveError(null); setSaveSuccess(false); }}
                title="Edit vessel data"
                className="rounded-lg px-3 py-2 text-[#a9b0d1] hover:bg-[#1a1e2e] hover:text-[#6cabff] transition-colors flex items-center gap-1.5"
              >
                <Pencil className="size-4" />
                <span className="text-[14px] font-bold">Edit</span>
              </button>
            )}

            {editMode && (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold flex items-center gap-1 transition-colors"
                  style={{ backgroundColor: '#0e2a14', color: '#4ade80', border: '1px solid #1a3a22', opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                  {saving ? 'Saving…' : 'Update'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="rounded-full px-2 py-1 text-[11px] font-bold flex items-center gap-1 transition-colors"
                  style={{ backgroundColor: '#2a1010', color: '#f07272', border: '1px solid #3a2020' }}
                >
                  <XCircle className="size-3" />Cancel
                </button>
              </>
            )}

            {!activityOpen && (
              <button
                onClick={() => setFmecaModalOpen(true)}
                title="View knowledge graph"
                className="rounded-full p-1.5 text-[#a9b0d1] hover:bg-[#1a1e2e] hover:text-[#6cabff] transition-colors"
              >
                <Route className="size-3.5" />
              </button>
            )}

            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-[#a9b0d1] hover:bg-[#1a1e2e] hover:text-white transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-2 rounded-lg bg-[#0e2a14] border border-[#1a3a22] px-3 py-1.5 mb-2">
            <Check className="size-3.5 text-[#4ade80] shrink-0" />
            <span className="text-[12px] text-[#4ade80] font-semibold">Data Updated Successfully</span>
          </div>
        )}
        {saveError && (
          <div className="flex items-center gap-2 rounded-lg bg-[#2a1010] border border-[#3d1414] px-3 py-1.5 mb-2">
            <AlertCircle className="size-3.5 text-[#f07272] shrink-0" />
            <span className="text-[12px] text-[#f07272]">{saveError}</span>
          </div>
        )}
        {editMode && (
          <div
            className="flex items-center gap-2 rounded-lg border px-3 py-1.5 mb-2"
            style={{ backgroundColor: '#0e1929', borderColor: '#1a4a8a' }}
          >
            <Pencil className="size-3 text-[#6cabff] shrink-0" />
            <span className="text-[11px] text-[#6cabff] font-semibold">
              Edit mode — changes write to JSON on Update
            </span>
          </div>
        )}
      </div>

      {/* ── Scrollable content ── */}
      {activityOpen ? (
        <div className="flex-1 overflow-hidden">
          <SitrepUploader
            shipSlug={getShipFileSlug(slugRef.current) || undefined}
            onClose={() => setActivityOpen(false)}
          />
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2.5 flex flex-col gap-2">
          {combatLoading && (
            <div className="flex items-center gap-2 p-3 text-[13px] text-[#a9b0d1]">
              <Loader2 className="size-4 animate-spin text-[#6cabff]" />Loading vessel data…
            </div>
          )}
          {!combatLoading && combatError && (
            <div className="rounded-xl bg-[#2a1010] border border-[#3d1414] px-3 py-2.5 flex items-center gap-2">
              <AlertCircle className="size-4 text-[#f07272] shrink-0" />
              <span className="text-[12px] text-[#f07272]">{combatError}</span>
            </div>
          )}
          {!combatLoading && combatState && (
            <DashboardView
              data={combatState}
              activeTab={activeTab}
              editMode={editMode}
              onChange={handleChange}
            />
          )}

          <QueryView
            ship={slugRef.current}
            entries={queryLog}
            onOpenFmecaGraph={() => setFmecaModalOpen(true)}
            onSubgraphUpdate={onSubgraphUpdate}
          />
        </div>
      )}

      {/* ── Input tray ── */}
      {!activityOpen && (
        <div className="shrink-0 border-t border-[#1e2130] bg-[#0d0f16] p-3 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 rounded-full border border-[#1e2130] bg-[#13161f] pl-3.5 pr-1.5 py-1.5 focus-within:border-[#1a4a8a] focus-within:bg-[#0f1117] transition-colors">
            <Sparkles className="size-3.5 text-[#6cabff] shrink-0" />
            <input
              type="text"
              value={inputValue}
              onChange={e => {
                if (historyIndexRef.current !== -1) {
                  historyIndexRef.current = -1;
                  draftValueRef.current = '';
                }
                setInputValue(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this vessel…"
              className="flex-1 min-w-0 bg-transparent text-[14px] text-white placeholder-[#8b92b0] focus:outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className="shrink-0 grid place-items-center size-7 rounded-full bg-[#1a4a8a] text-white disabled:bg-[#1a1e2e] disabled:text-[#6b7299] transition-colors hover:bg-[#1e5cb0]"
            >
              <ArrowUp className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Timeline slide-over ── */}
      {timelineOpen && (
        <ShipTimelinePanel
          open={timelineOpen}
          onClose={() => setTimelineOpen(false)}
          shipIds={ship ? [ship.id ?? shipSlug(ship.name)] : []}
          width={width}
        />
      )}

      {/* ── FMECA graph modal ── */}
      {fmecaModalOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-6"
          onClick={e => { if (e.target === e.currentTarget) setFmecaModalOpen(false); }}
        >
          <div className="bg-[#0d0f16] border border-[#1e2130] rounded-2xl shadow-xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e2130] bg-[#13161f] shrink-0">
              <div className="min-w-0">
                <span className="block text-[15px] font-semibold text-white">
                  {ship?.name ?? 'INS TUSHIL'}
                </span>
                <span className="text-[11px] text-[#5a6080]">
                </span>
              </div>
              <button
                onClick={() => setFmecaModalOpen(false)}
                className="rounded-full p-2 text-[#a9b0d1] hover:bg-[#1a1e2e] hover:text-white transition-colors shrink-0 ml-4"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 p-4 overflow-hidden">
              <GraphCanvas
                key="fmeca-modal"
                graph={fmecaGraph as KGSubgraph}
                graphKey="fmeca"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}