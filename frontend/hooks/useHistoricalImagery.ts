import { useEffect, useState } from 'react';
import {
  fetchHistoricalImagery,
  HistoricalImageryEntry,
  PortLike,
  WAYBACK_ZOOM,
} from '@/lib/waybackImagery';

interface UseHistoricalImageryResult {
  entries: HistoricalImageryEntry[];
  loading: boolean;
  error: string | null;
}

export function useHistoricalImagery(
  port: PortLike | null,
  enabled: boolean,
): UseHistoricalImageryResult {
  const [entries, setEntries] = useState<HistoricalImageryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!port || !enabled) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setEntries([]);

    fetchHistoricalImagery(port, WAYBACK_ZOOM, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setEntries(result);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load historical imagery from Wayback.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [port?.name, port?.lat, port?.lng, enabled]);

  return { entries, loading, error };
}
