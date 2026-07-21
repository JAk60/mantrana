import { useCallback, useEffect, useRef, useState } from 'react';
import { HistoricalImageryEntry } from '@/lib/waybackImagery';
import { Reticles } from './ImageViewer';
import { TileGridImage } from './TileGridImage';

interface CompareViewerProps {
  left: HistoricalImageryEntry;
  right: HistoricalImageryEntry;
  portName: string;
}

export function CompareViewer({ left, right, portName }: CompareViewerProps) {
  const [position, setPosition] = useState(50); // percent
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, pct)));
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  };

  const handlePointerUp = () => {
    draggingRef.current = false;
  };

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <div className="flex items-center justify-between px-0.5">
        <span className="font-mono text-[11px] font-semibold text-cyan-300">
          {left.date}
        </span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
          drag to compare
        </span>
        <span className="font-mono text-[11px] font-semibold text-amber-300">
          {right.date}
        </span>
      </div>

      <div
        ref={containerRef}
        className="relative h-full w-full select-none overflow-hidden rounded-md bg-black"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* right / "after" image, full width, base layer */}
        <div className="pointer-events-none absolute inset-0">
          <TileGridImage
            tiles={right.gridTiles}
            alt={`${portName} imagery, ${right.date}`}
          />
        </div>

        {/* left / "before" image, clipped to slider position */}
        <div
          className="pointer-events-none absolute inset-0 h-full overflow-hidden"
          style={{ width: `${position}%` }}
        >
          <div style={{ width: containerWidth || '100%', height: '100%' }}>
            <TileGridImage
              tiles={left.gridTiles}
              alt={`${portName} imagery, ${left.date}`}
            />
          </div>
        </div>

        <Reticles />

        {/* labels */}
        <div className="pointer-events-none absolute left-3 top-3 rounded bg-black/60 px-2.5 py-1 backdrop-blur-sm">
          <span className="font-mono text-[11px] font-semibold text-cyan-300">
            {left.date}
          </span>
        </div>
        <div className="pointer-events-none absolute right-3 top-3 rounded bg-black/60 px-2.5 py-1 backdrop-blur-sm">
          <span className="font-mono text-[11px] font-semibold text-amber-300">
            {right.date}
          </span>
        </div>

        {/* slider handle */}
        <div
          className="absolute inset-y-0 z-10 flex w-0 items-center justify-center"
          style={{ left: `${position}%` }}
        >
          <div className="absolute inset-y-0 w-[2px] bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
          <div
            onPointerDown={handlePointerDown}
            className="relative z-10 flex h-9 w-9 cursor-ew-resize items-center justify-center rounded-full border-2 border-white/90 bg-slate-900/90 shadow-lg backdrop-blur-sm"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M5 3L1 8l4 5M11 3l4 5-4 5"
                stroke="white"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
