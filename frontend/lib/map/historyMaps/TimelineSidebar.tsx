import { HistoricalImageryEntry } from '@/lib/waybackImagery';
import { cn } from '@/lib/utils';

interface TimelineSidebarProps {
  entries: HistoricalImageryEntry[];
  selectedId: number;
  compareId: number | null;
  compareMode: boolean;
  onSelect: (id: number) => void;
  onSelectCompare: (id: number) => void;
}

export function TimelineSidebar({
  entries,
  selectedId,
  compareId,
  compareMode,
  onSelect,
  onSelectCompare,
}: TimelineSidebarProps) {
  return (
    <div className="flex h-full flex-col border-r border-slate-800 bg-[#0B1220]">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <span className="text-[10px] font-semibold tracking-[0.14em] text-slate-400">
          TIMELINE
        </span>
        <span className="text-[10px] font-mono text-slate-600">
          {entries.length} RELEASES
        </span>
      </div>

      {compareMode && (
        <div className="border-b border-slate-800 bg-amber-500/[0.06] px-4 py-2">
          <p className="text-[10px] leading-relaxed text-amber-400/90">
            Select a second date to compare against{' '}
            <span className="font-mono font-semibold">
              {entries.find((e) => e.id === selectedId)?.date}
            </span>
          </p>
        </div>
      )}

      <div className="relative flex-1 overflow-y-auto px-2 py-3">
        {/* vertical rail */}
        <div className="pointer-events-none absolute left-[23px] top-3 bottom-3 w-px bg-slate-800" />

        <ul className="flex flex-col gap-0.5">
          {entries.map((entry) => {
            const isSelected = entry.id === selectedId;
            const isCompare = compareMode && entry.id === compareId;
            const isDisabledPrimary = compareMode && entry.id === selectedId;

            return (
              <li key={entry.id}>
                <button
                  type="button"
                  disabled={isDisabledPrimary}
                  onClick={() =>
                    compareMode ? onSelectCompare(entry.id) : onSelect(entry.id)
                  }
                  className={cn(
                    'group relative flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors',
                    isSelected && !compareMode && 'bg-cyan-500/10',
                    isCompare && 'bg-amber-500/10',
                    !isSelected && !isCompare && 'hover:bg-slate-800/60',
                    isDisabledPrimary && 'cursor-not-allowed opacity-40',
                  )}
                >
                  {/* node dot */}
                  <span
                    className={cn(
                      'relative z-10 flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border',
                      isSelected && !compareMode
                        ? 'border-cyan-400 bg-cyan-400'
                        : isCompare
                          ? 'border-amber-400 bg-amber-400'
                          : 'border-slate-600 bg-[#0B1220] group-hover:border-slate-400',
                    )}
                  >
                    {(isSelected && !compareMode) || isCompare ? (
                      <span className="h-[5px] w-[5px] rounded-full bg-[#0B1220]" />
                    ) : null}
                  </span>

                  {/* thumbnail: single Wayback tile for this release */}
                  <img
                    src={entry.centerTileUrl}
                    alt={entry.date}
                    className="h-8 w-11 shrink-0 rounded object-cover ring-1 ring-slate-800"
                    loading="lazy"
                  />

                  <div className="flex min-w-0 flex-col">
                    <span
                      className={cn(
                        'font-mono text-[12px] font-semibold tracking-tight',
                        isSelected && !compareMode
                          ? 'text-cyan-300'
                          : isCompare
                            ? 'text-amber-300'
                            : 'text-slate-300',
                      )}
                    >
                      {entry.date}
                    </span>
                    <span className="truncate text-[10px] text-slate-500">
                      {entry.layerIdentifier}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
