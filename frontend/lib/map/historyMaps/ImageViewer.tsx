import { HistoricalImageryEntry } from '@/lib/waybackImagery';
import { TileGridImage } from './TileGridImage';

interface ImageViewerProps {
  entry: HistoricalImageryEntry;
  portName: string;
}

export function ImageViewer({ entry, portName }: ImageViewerProps) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-md bg-black">
      <TileGridImage
        tiles={entry.gridTiles}
        alt={`${portName} imagery, ${entry.date}`}
      />

      <Reticles />

      <div className="pointer-events-none absolute left-3 top-3 rounded bg-black/60 px-2.5 py-1 backdrop-blur-sm">
        <span className="font-mono text-[11px] font-semibold tracking-wide text-cyan-300">
          {entry.date}
        </span>
      </div>
    </div>
  );
}

export function Reticles() {
  const corner = 'absolute h-4 w-4 border-cyan-400/50';
  return (
    <div className="pointer-events-none absolute inset-3">
      <div className={`${corner} left-0 top-0 border-l-2 border-t-2`} />
      <div className={`${corner} right-0 top-0 border-r-2 border-t-2`} />
      <div className={`${corner} bottom-0 left-0 border-b-2 border-l-2`} />
      <div className={`${corner} bottom-0 right-0 border-b-2 border-r-2`} />
    </div>
  );
}
