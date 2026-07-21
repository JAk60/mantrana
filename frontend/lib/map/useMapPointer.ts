import { useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';

export type PointerInfo = { lat: number; lng: number; zoom: number };

// ─── useMapPointer ────────────────────────────────────────────────────────────
// Tracks mouse position and zoom level via a RAF-throttled mousemove listener.
// Avoids triggering 60+ React re-renders per second on fast mouse movement.

export function useMapPointer(
  map: maplibregl.Map | null,
  mapReady: boolean,
  initialCenter: [number, number],
  initialZoom: number,
): PointerInfo {
  const [pointerInfo, setPointerInfo] = useState<PointerInfo>({
    lat:  initialCenter[1],
    lng:  initialCenter[0],
    zoom: initialZoom,
  });

  useEffect(() => {
    if (!map || !mapReady) return;

    let rafId: number | null = null;
    let latest: { lat: number; lng: number } | null = null;

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      latest = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        if (latest) setPointerInfo((prev) => ({ ...prev, lat: latest!.lat, lng: latest!.lng }));
        rafId = null;
      });
    };

    const onZoom = () => setPointerInfo((prev) => ({ ...prev, zoom: map.getZoom() }));

    map.on('mousemove', onMouseMove);
    map.on('zoom',      onZoom);

    return () => {
      map.off('mousemove', onMouseMove);
      map.off('zoom',      onZoom);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [map, mapReady]);

  return pointerInfo;
}
