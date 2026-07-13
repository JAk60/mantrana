import { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { PANEL_WIDTH } from '@/lib/globe';

type UsePipTakeoverArgs = {
  shipPanelOpen: boolean;
  anyPanelOpen: boolean;
  mapReady: boolean;
  mapRef: React.RefObject<maplibregl.Map | null>;
};

export function usePipTakeover({ shipPanelOpen, anyPanelOpen, mapReady, mapRef }: UsePipTakeoverArgs) {
  const mapSlotRef = useRef<HTMLDivElement>(null);

  const [mapFocusMode, setMapFocusMode] = useState(false);
  const [pipRect, setPipRect] = useState<{ top: number; left: number; width: number; height: number } | null>(
    null
  );

  const shipTakeover = shipPanelOpen && mapFocusMode;
  const usesPip = shipTakeover && !!pipRect;

  const toggleMapFocusMode = useCallback(() => {
    setMapFocusMode((v) => !v);
  }, []);

  const resetMapFocusMode = useCallback(() => {
    setMapFocusMode(false);
  }, []);

  // Track the on-screen rect of the PiP placeholder inside the ship info
  // panel while takeover mode is active, so the real map container can be
  // positioned exactly over it. Runs a short rAF loop right after entering
  // (or leaving) takeover so the map tracks the panel's width/height CSS
  // transition frame-by-frame, then settles into a resize-listener-only
  // steady state.
  useEffect(() => {
    if (!shipTakeover) {
      setPipRect(null);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const TRACK_MS = 400;

    const measure = () => {
      const el = mapSlotRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPipRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    const tick = (now: number) => {
      measure();
      if (now - start < TRACK_MS) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, [shipTakeover]);

  // Keep the MapLibre canvas's internal resolution in sync with the
  // container's on-screen box size, both for the normal side-by-side
  // split and while the PiP rect is being tracked.
  useEffect(() => {
    if (!mapReady) return;
    mapRef.current?.resize();
  }, [anyPanelOpen, mapReady, pipRect, shipTakeover, mapRef]);

  // Disable map interaction while it's shrunk into the PiP card — a tiny
  // draggable/zoomable map inside a sidebar is more accident than feature.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const usePipInteraction = shipTakeover && !!pipRect;
    const toggle = (enabled: boolean) => {
      if (enabled) {
        map.dragPan.enable();
        map.scrollZoom.enable();
        map.doubleClickZoom.enable();
        map.touchZoomRotate.enable();
        map.boxZoom.enable();
        map.keyboard.enable();
      } else {
        map.dragPan.disable();
        map.scrollZoom.disable();
        map.doubleClickZoom.disable();
        map.touchZoomRotate.disable();
        map.boxZoom.disable();
        map.keyboard.disable();
      }
    };
    toggle(!usePipInteraction);
  }, [shipTakeover, pipRect, mapReady, mapRef]);

  const mapContainerStyle: React.CSSProperties = usesPip
    ? {
      position: 'fixed',
      top: pipRect!.top,
      left: pipRect!.left,
      width: pipRect!.width,
      height: pipRect!.height,
      zIndex: 40,
    }
    : {
      position: 'absolute',
      top: 0,
      left: 0,
      height: '100%',
      width: anyPanelOpen ? `calc(100% - ${PANEL_WIDTH}px)` : '100%',
      zIndex: 0,
    };

  return {
    mapSlotRef,
    mapFocusMode,
    toggleMapFocusMode,
    resetMapFocusMode,
    shipTakeover,
    usesPip,
    pipRect,
    mapContainerStyle,
  };
}