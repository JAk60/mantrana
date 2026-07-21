import { Button } from '@/components/ui/button';
import { HistoricalImageryEntry, ResolvedMetadata } from '@/lib/waybackImagery';
import { Layers, Download } from 'lucide-react';

interface ImageMetadataProps {
  entry: HistoricalImageryEntry;
  compareEntry?: HistoricalImageryEntry | null;
  compareMode: boolean;
  metadata: ResolvedMetadata | null;
  metadataLoading: boolean;
  onToggleCompare: () => void;
  onDownload: () => void;
}

function Field({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-semibold tracking-[0.1em] text-slate-500">
        {label.toUpperCase()}
      </span>
      {loading ? (
        <span className="h-[15px] w-16 animate-pulse rounded bg-slate-800" />
      ) : (
        <span className="font-mono text-[12px] font-medium text-slate-200">
          {value}
        </span>
      )}
    </div>
  );
}

export function ImageMetadata({
  entry,
  compareEntry,
  compareMode,
  metadata,
  metadataLoading,
  onToggleCompare,
  onDownload,
}: ImageMetadataProps) {
  const resolutionLabel = metadata
    ? `${metadata.resolution.toFixed(2)} m`
    : '—';
  const providerLabel = metadata?.provider ?? '—';
  const coordsLabel = metadata
    ? `${metadata.lat.toFixed(4)}, ${metadata.lng.toFixed(4)}`
    : '—';

  return (
    <div className="flex items-end justify-between gap-4 border-t border-slate-800 bg-[#0B1220] px-4 py-3">
      <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        <Field label="Resolution" value={resolutionLabel} loading={metadataLoading} />
        <Field label="Provider" value={providerLabel} loading={metadataLoading} />
        <Field
          label="Version Date"
          value={
            compareMode && compareEntry
              ? `${entry.date} vs ${compareEntry.date}`
              : entry.date
          }
        />
        <Field label="Coordinates" value={coordsLabel} loading={metadataLoading} />
      </div>

      <div className="flex shrink-0 gap-2">
        <Button
          size="sm"
          variant={compareMode ? 'secondary' : 'outline'}
          onClick={onToggleCompare}
          className="h-8 gap-1.5 border-slate-700 text-xs"
        >
          <Layers className="h-3.5 w-3.5" />
          {compareMode ? 'Exit Compare' : 'Compare'}
        </Button>
        <Button
          size="sm"
          onClick={onDownload}
          className="h-8 gap-1.5 bg-cyan-600 text-xs hover:bg-cyan-500"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
      </div>
    </div>
  );
}
