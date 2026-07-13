'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { fetchShipTimeline, SHIP_LABELS, ShipTimelineEntry } from '@/lib/shipActivity';

function formatTimestamp(ts: string) {
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function headingFor(entry: ShipTimelineEntry) {
  if (entry.missionType) return `${entry.missionType} Mission`;
  if (entry.location === 'base') return `At ${entry.baseLocation ?? 'Base'}`;
  if (entry.location === 'dockyard') return `At ${entry.dockyard ?? 'Dockyard'}`;
  if (entry.location === 'combat_group') return 'Combat Group Operations';
  return 'Update';
}

function TimelineItem({ entry, isLeft }: { entry: ShipTimelineEntry; isLeft: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div 
      className="relative flex justify-between items-start w-full mb-10 group cursor-pointer"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Center Checkmark Node (Highlights when expanded) */}
      <div className={`absolute left-1/2 -translate-x-1/2 top-0 flex items-center justify-center w-5 h-5 rounded-full border-2 shadow-sm z-10 transition-colors duration-300 ${
        isExpanded ? 'bg-blue-600 border-blue-400' : 'bg-[#0b121f] border-slate-500 group-hover:border-slate-300'
      }`}>
        <Check className={`size-2.5 stroke-[3] transition-colors ${
          isExpanded ? 'text-white' : 'text-slate-300 group-hover:text-white'
        }`} />
      </div>

      {isLeft ? (
        <>
          {/* Content on the Left */}
          <div className="w-[calc(50%-1.25rem)] text-right pr-1 pt-0.5">
            <div className="flex items-center justify-end gap-2 flex-wrap mb-1.5">
              {entry.coordinates && (
                <span className="text-[10px] text-slate-500 font-mono bg-slate-800/40 px-1.5 py-0.5 rounded border border-slate-800">
                  {entry.coordinates}
                </span>
              )}
              <time className="italic font-bold text-xs text-slate-300 tracking-wide">
                {formatTimestamp(entry.timestamp)}
              </time>
            </div>
            
            <h4 className="text-[13px] font-bold text-slate-100 mt-1 tracking-wide group-hover:text-blue-400 transition-colors">
              {headingFor(entry)}
            </h4>
            
            {/* Expandable Log Section */}
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  {entry.companionUnits?.length ? (
                    <p className="text-[11px] text-sky-400/90 font-medium mt-2">
                      With {entry.companionUnits.map((u) => SHIP_LABELS[u] ?? u).join(', ')}
                    </p>
                  ) : null}
                  
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed ml-auto pb-2">
                    {entry.log}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* Empty Right Side Spacer */}
          <div className="w-[calc(50%-1.25rem)]" />
        </>
      ) : (
        <>
          {/* Empty Left Side Spacer */}
          <div className="w-[calc(50%-1.25rem)]" />
          
          {/* Content on the Right */}
          <div className="w-[calc(50%-1.25rem)] text-left pl-1 pt-0.5">
            <div className="flex items-center justify-start gap-2 flex-wrap mb-1.5">
              <time className="italic font-bold text-xs text-slate-300 tracking-wide">
                {formatTimestamp(entry.timestamp)}
              </time>
              {entry.coordinates && (
                <span className="text-[10px] text-slate-500 font-mono bg-slate-800/40 px-1.5 py-0.5 rounded border border-slate-800">
                  {entry.coordinates}
                </span>
              )}
            </div>
            
            <h4 className="text-[13px] font-bold text-slate-100 mt-1 tracking-wide group-hover:text-blue-400 transition-colors">
              {headingFor(entry)}
            </h4>
            
            {/* Expandable Log Section */}
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  {entry.companionUnits?.length ? (
                    <p className="text-[11px] text-sky-400/90 font-medium mt-2">
                      With {entry.companionUnits.map((u) => SHIP_LABELS[u] ?? u).join(', ')}
                    </p>
                  ) : null}
                  
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed mr-auto pb-2">
                    {entry.log}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}

function TimelineList({ entries }: { entries: ShipTimelineEntry[] }) {
  return (
    <div className="relative py-2 w-full">
      {/* Central Vertical Line */}
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-700/60 -translate-x-1/2" />

      {entries.map((entry, index) => (
        <TimelineItem 
          key={entry.timestamp} 
          entry={entry} 
          isLeft={index % 2 === 0} 
        />
      ))}
    </div>
  );
}

export default function ShipTimelinePanel({
  open,
  onClose,
  shipIds,
  width = 460, 
}: {
  open: boolean;
  onClose: () => void;
  shipIds: string[];
  width?: number;
}) {
  const [dataByShip, setDataByShip] = useState<Record<string, ShipTimelineEntry[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('');

  useEffect(() => {
    if (!open || shipIds.length === 0) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setActiveTab(shipIds[0]);

    Promise.all(shipIds.map((id) => fetchShipTimeline(id).then((t) => [id, t] as const)))
      .then((results) => !cancelled && setDataByShip(Object.fromEntries(results)))
      .catch((e) => !cancelled && setError(e.message ?? 'Failed to load ship activity'))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [open, shipIds.join(',')]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: width }}
          animate={{ x: 0 }}
          exit={{ x: width }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed top-0 right-0 h-full z-40 bg-[#0b121f] border-l border-slate-800 shadow-2xl flex flex-col"
          style={{ width }}
        >
          {/* Top Panel Brand Bar */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <h3 className="text-xs font-bold text-slate-300 tracking-wider uppercase">
              {shipIds.length === 1 ? `${SHIP_LABELS[shipIds[0]] ?? shipIds[0]} — Activity` : 'Ship Activity'}
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-slate-800">
              <X className="size-4" />
            </button>
          </div>

          {/* Multi-unit Selection Bar */}
          {shipIds.length > 1 && (
            <div className="flex gap-2 px-5 pt-3 flex-wrap border-b border-slate-800 pb-2 bg-[#090e1a]">
              {shipIds.map((id) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`px-3 py-1 rounded text-[11px] font-semibold tracking-wide uppercase transition-all ${
                    activeTab === id
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  {SHIP_LABELS[id] ?? id}
                </button>
              ))}
            </div>
          )}

          {/* Core Stream View */}
          <div className="flex-1 overflow-y-auto px-5 py-6 custom-scrollbar">
            {loading && <p className="text-xs text-slate-500 animate-pulse text-center">Loading logs…</p>}
            {error && <p className="text-xs text-red-400 font-medium text-center">{error}</p>}
            {!loading && !error && dataByShip[activeTab] && <TimelineList entries={dataByShip[activeTab]} />}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}