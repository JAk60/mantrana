import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { TimelineSidebar } from './TimelineSidebar';
import { ImageViewer } from './ImageViewer';
import { CompareViewer } from './CompareViewer';
import { ImageMetadata } from './ImageMetadata';
import { useHistoricalImagery } from '@/hooks/useHistoricalImagery';
import {
  fetchEntryMetadata,
  PortLike,
  ResolvedMetadata,
} from '@/lib/waybackImagery';

interface HistoricalImageryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  port: PortLike | null;
}

export function HistoricalImageryDialog({
  open,
  onOpenChange,
  port,
}: HistoricalImageryDialogProps) {
  const { entries, loading, error } = useHistoricalImagery(port, open);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [compareId, setCompareId] = useState<number | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [metadata, setMetadata] = useState<ResolvedMetadata | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open && entries.length > 0 && selectedId === null) {
      setSelectedId(entries[0].id);
    }
  }, [open, entries, selectedId]);

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      setCompareId(null);
      setCompareMode(false);
      setMetadata(null);
      setNote('');
    }
  }, [open, port?.name]);

  const selectedEntry = entries.find((e) => e.id === selectedId) ?? entries[0];
  const compareEntry = compareId
    ? entries.find((e) => e.id === compareId) ?? null
    : null;

  useEffect(() => {
    if (!port) return;
    const target = compareMode && compareEntry ? compareEntry : selectedEntry;
    if (!target) return;

    let cancelled = false;
    setMetadataLoading(true);
    fetchEntryMetadata(port, target)
      .then((result) => {
        if (!cancelled) setMetadata(result);
      })
      .catch(() => {
        if (!cancelled) setMetadata(null);
      })
      .finally(() => {
        if (!cancelled) setMetadataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [port, selectedEntry?.id, compareEntry?.id, compareMode]);

  if (!open || !port) return null;

  const handleToggleCompare = () => {
    if (compareMode) {
      setCompareMode(false);
      setCompareId(null);
    } else {
      setCompareMode(true);
    }
  };

  const handleDownload = () => {
    const target = compareMode && compareEntry ? compareEntry : selectedEntry;
    if (!target) return;
    const a = document.createElement('a');
    a.href = target.centerTileUrl;
    a.download = `${port.name.replace(/\s+/g, '-')}-${target.date}.jpg`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const handleNoteSubmit = () => {
    if (!note.trim()) return;
    // TODO: wire up your note/search handler here
    console.log('Note submitted:', note);
    setNote('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
      <div className="flex h-full w-full max-w-[1800px] flex-col gap-0 overflow-hidden rounded-lg border border-slate-800 bg-[#0B1220] text-slate-200 shadow-2xl">
        <div className="relative flex shrink-0 items-center gap-2 border-b border-slate-800 px-5 py-3.5">
          <span className="text-cyan-400">🛰</span>
          <span className="text-sm font-semibold tracking-wide text-slate-100">
            Archived Images
          </span>
          <span className="font-mono text-slate-500">— {port.name}</span>
          <span className="ml-auto text-[10px] font-normal tracking-wide text-slate-600">
            Esri World Imagery Wayback
          </span>

          <button
            onClick={() => onOpenChange(false)}
            title="Close"
            className="ml-3 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/60 text-slate-400 transition-colors hover:border-cyan-400/60 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
            <span className="text-xs">Loading Wayback releases for this location…</span>
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-500">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <span className="max-w-sm text-center text-xs text-slate-400">{error}</span>
          </div>
        ) : selectedEntry ? (
          <div className="grid min-h-0 flex-1 grid-cols-[25%_75%]">
            <TimelineSidebar
              entries={entries}
              selectedId={selectedEntry.id}
              compareId={compareId}
              compareMode={compareMode}
              onSelect={(id) => setSelectedId(id)}
              onSelectCompare={(id) => setCompareId(id)}
            />

            <div className="flex min-h-0 flex-col">
              <div className="min-h-0 flex-1 p-4">
                {compareMode && compareEntry ? (
                  <CompareViewer
                    left={selectedEntry}
                    right={compareEntry}
                    portName={port.name}
                  />
                ) : (
                  <ImageViewer entry={selectedEntry} portName={port.name} />
                )}
              </div>

              {/* Input + Button below the viewer */}
              <div className="flex shrink-0 items-center gap-2 border-t border-slate-800 px-4 py-3">
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleNoteSubmit()}
                  placeholder="Ask query…"
                  className="flex-1 rounded-md border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none transition-colors focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/20"
                />
                <button
                  onClick={handleNoteSubmit}
                  disabled={!note.trim()}
                  className="rounded-md border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-cyan-400/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Analyse
                </button>
              </div>

              <ImageMetadata
                entry={selectedEntry}
                compareEntry={compareEntry}
                compareMode={compareMode}
                metadata={metadata}
                metadataLoading={metadataLoading}
                onToggleCompare={handleToggleCompare}
                onDownload={handleDownload}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
            No local imagery changes found for this location.
          </div>
        )}
      </div>
    </div>
  );
}