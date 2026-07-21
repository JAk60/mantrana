import { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';

import {
  BASEMAP_CYCLE,
  BasemapKey,
  BASEMAPS,
  EMPTY_FC,
  idSafe,
  PORT_LOCATIONS,
  ProjectionKey,
  SHIP_LOCATIONS,
  ANCHOR_ICON_SVG,
  SHIP_ICON_SVG,
} from '@/lib/globe';
import { ShipInfo } from '@/components/ship_panel/shipPanel';
import { injectPhotosIntoPopup } from '@/lib/portImageService';

import { DARK_PALETTE, LIGHT_PALETTE }   from '@/lib/map/mapConfig';
import { buildGridFeatures }             from '@/lib/map/mapUtils';
import { addBaseGeoLayers }              from '@/lib/map/baseGeoLayers';
import { initGridLayers, applySky, GRID_LAYER_IDS } from '@/lib/map/gridLayer';
import { useMapPointer }                 from '@/lib/map/useMapPointer';
import { useLazyLayers }                 from '@/lib/map/useLazyLayers';
import {
  buildGridPopupHtml,
  gridPopupIds,
} from '@/lib/map/popups/grid_points';
import { fetchBathymetricProfile, fetchCurrentsAndTides, fetchLocation, fetchSeaState } from '@/lib/map/popupEnrichment_bathymetric';
import { buildPortPopupHtml } from '@/lib/map/popups/ports';

// ─── Types ────────────────────────────────────────────────────────────────────

type UseGlobeMapEngineArgs = {
  initialCenter: [number, number];
  initialZoom:   number;
  showGrid:      boolean;
  onShipClick:   (ship: ShipInfo) => void;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGlobeMapEngine({
  initialCenter,
  initialZoom,
  showGrid,
  onShipClick,
}: UseGlobeMapEngineArgs) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<maplibregl.Map | null>(null);
  const popupRef        = useRef<maplibregl.Popup | null>(null);
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);
  const shipMarkersRef  = useRef<maplibregl.Marker[]>([]);
  const portMarkersRef  = useRef<maplibregl.Marker[]>([]);
  const activeAbortRef  = useRef<AbortController | null>(null);

  const [mapReady,    setMapReady]    = useState(false);
  const [gridOn,      setGridOn]      = useState(showGrid);
  const [basemap,     setBasemap]     = useState<BasemapKey>('dark');
  const [projection,  setProjection]  = useState<ProjectionKey>('mercator');

  // ─── Sub-hooks ──────────────────────────────────────────────────────────────

  const pointerInfo = useMapPointer(mapRef.current, mapReady, initialCenter, initialZoom);

  const {
    bathyOn, setBathyOn, eezOn, setEezOn,
    isobathsOn, setIsobathsOn, shippingOn, setShippingOn,
    resetSources, reapplyActiveLayers,
  } = useLazyLayers(mapRef, mapReady);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const setGeo = useCallback((source: string, features: GeoJSON.Feature[]) => {
    const src = mapRef.current?.getSource(source) as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData({ type: 'FeatureCollection', features });
  }, []);

  const setVis = useCallback((ids: readonly string[], visible: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    ids.forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    });
  }, []);

  const palette = useCallback(
    () => (basemap === 'dark' ? DARK_PALETTE : LIGHT_PALETTE),
    [basemap],
  );

  // ─── Grid build ──────────────────────────────────────────────────────────────

  const buildGrid = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const work = () => {
      const { minorLines, majorLines, points } = buildGridFeatures(map);
      setGeo('grid-lines-minor', minorLines);
      setGeo('grid-lines-major', majorLines);
      setGeo('grid-points',      points);
    };
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(work, { timeout: 200 });
    } else {
      setTimeout(work, 0);
    }
  }, [setGeo]);

  // ─── Popup helpers ───────────────────────────────────────────────────────────

  const closePointInfo = useCallback(() => {
    popupRef.current?.remove();
    popupRef.current = null;
  }, []);

  const openPopup = useCallback((coords: [number, number], html: string) => {
    const map = mapRef.current;
    if (!map) return;
    popupRef.current?.remove();
    popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '780px', offset: 12 })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map);
  }, []);

  // ─── Grid point popup ────────────────────────────────────────────────────────

  const showPointInfo = useCallback((lat: number, lng: number) => {
    // Cancel any in-flight enrichment from a previous popup
    activeAbortRef.current?.abort();
    activeAbortRef.current = new AbortController();
    const { signal } = activeAbortRef.current;

    const latR = Number(lat.toFixed(4));
    const lngR = Number(lng.toFixed(4));
    const { locId, seaId, depthId, seabedId, currentId, tideId } = gridPopupIds(latR, lngR);

    // Render skeleton popup immediately
    openPopup([lng, lat], buildGridPopupHtml(lat, lng));

    // Fire all enrichments in parallel — each writes into its own DOM element
    fetchLocation(latR, lngR, locId, signal);
    fetchBathymetricProfile(latR, lngR, depthId, seabedId, signal);
    fetchCurrentsAndTides(latR, lngR, currentId, tideId, signal);
    fetchSeaState(latR, lngR, seaId, signal);

    // Abort enrichment if the popup is closed before fetches complete
    popupRef.current?.on('close', () => {
      activeAbortRef.current?.abort();
    });
  }, [openPopup]);

  // ─── Map mount ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container:          containerRef.current,
      style:              '/style/naval-style.json',
      center:             initialCenter,
      zoom:               initialZoom,
      minZoom:            0,
      maxZoom:            18,
      attributionControl: false,
      fadeDuration:       0,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      mapRef.current = map;
      window.__gridPopupTab = (tabId: string, btn: HTMLElement) => {
  // The drawer id is "drawer-{locId}" and tabId gives us the locId
  // e.g. tabId = "grid-loc-20_0000-65_0000", drawerId = "drawer-grid-loc-20_0000-65_0000"
  // BUT the locId is the FIRST panel id — we need to extract the shared suffix

  // Simpler: find the drawer by looking for any drawer near the button
  let el: HTMLElement | null = btn;
  let drawer: HTMLElement | null = null;
  while (el) {
    drawer = el.querySelector?.('[id^="drawer-"]') as HTMLElement | null;
    if (drawer) break;
    // Also check siblings (the flex wrapper)
    const parent = el.parentElement;
    if (parent) {
      drawer = parent.querySelector('[id^="drawer-"]') as HTMLElement | null;
      if (drawer) break;
    }
    el = el.parentElement;
  }

  if (!drawer) {
    console.warn('__gridPopupTab: drawer not found for tab', tabId);
    return;
  }

  // Open drawer
  drawer.style.width = '380px';

  // Update title
  const titleEl = drawer.querySelector('[id^="drawer-title-"]') as HTMLElement | null;
  if (titleEl) titleEl.textContent = btn.textContent?.trim() ?? '';

  // Hide all panes, show target
  const contentEl = drawer.querySelector('[id^="drawer-content-"]') as HTMLElement | null;
  if (contentEl) {
    contentEl.querySelectorAll(':scope > div').forEach((el) => {
      (el as HTMLElement).style.display = 'none';
    });
  }

  const target = document.getElementById(tabId);
  if (target) target.style.display = 'block';
  else console.warn('__gridPopupTab: pane not found', tabId);
};
      if (containerRef.current) containerRef.current.style.backgroundColor = '#081C2C';

      addBaseGeoLayers(map, palette());
      initGridLayers(map, projection, basemap, gridOn);

      // Ship markers
      SHIP_LOCATIONS.forEach((ship) => {
        const el = document.createElement('div');
        el.style.cssText = `width:26px;height:26px;border-radius:50%;background:#0B3D91;border:2px solid #FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.4);`;
        el.innerHTML = SHIP_ICON_SVG;
        el.title = ship.name;
        el.addEventListener('click', (e) => { e.stopPropagation(); onShipClick(ship); });
        shipMarkersRef.current.push(
          new maplibregl.Marker({ element: el }).setLngLat([ship.lng, ship.lat]).addTo(map),
        );
      });

      // Port markers
      PORT_LOCATIONS.forEach((port) => {
        const statusColor =
          port.portStatus === 'Self'      ? '#16A34A' :
          port.portStatus === 'Adversary' ? '#DC2626' : '#EA580C';

        const el = document.createElement('div');
        el.style.cssText = `width:24px;height:24px;border-radius:50%;background:${statusColor};border:2px solid #FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.4);`;
        el.innerHTML = ANCHOR_ICON_SVG;
        el.title = port.name;

        const photoId   = `port-photo-${idSafe(port.name)}`;
        const portPopup = new maplibregl.Popup({ offset: 16, maxWidth: '320px' })
          .setHTML(buildPortPopupHtml(port, statusColor, photoId));

        portPopup.on('open', () => {
          requestAnimationFrame(() => {
            const photoSlot = document.getElementById(photoId);
            if (!photoSlot) return;
            const osmUrl = `https://www.openstreetmap.org/?mlat=${port.lat}&mlon=${port.lng}&zoom=14`;
            injectPhotosIntoPopup(photoSlot, port.name, port.category, port.country, port.lat, port.lng, osmUrl);
            const observer = new MutationObserver(() => {
              if (photoSlot.innerHTML.trim()) { photoSlot.style.display = 'block'; observer.disconnect(); }
            });
            observer.observe(photoSlot, { childList: true, subtree: true });
          });
        });

        portMarkersRef.current.push(
          new maplibregl.Marker({ element: el }).setLngLat([port.lng, port.lat]).setPopup(portPopup).addTo(map),
        );
      });

      // Grid point click
      map.on('click',      'grid-points-hit', (e) => {
        if (!e.features?.length) return;
        const p = e.features[0].properties as { lat: number; lng: number };
        showPointInfo(p.lat, p.lng);
      });
      map.on('mouseenter', 'grid-points-hit', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'grid-points-hit', () => { map.getCanvas().style.cursor = ''; });

      setMapReady(true);
    });

    return () => {
      activeAbortRef.current?.abort();
      shipMarkersRef.current.forEach((m) => m.remove());
      shipMarkersRef.current = [];
      portMarkersRef.current.forEach((m) => m.remove());
      portMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Grid toggle + zoom/pan rebuild ──────────────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    setVis(GRID_LAYER_IDS, gridOn);
    if (gridOn) buildGrid();
    else {
      setGeo('grid-lines-minor', []);
      setGeo('grid-lines-major', []);
      setGeo('grid-points',      []);
    }

    let t: ReturnType<typeof setTimeout>;
    const handler = () => { clearTimeout(t); t = setTimeout(() => { if (gridOn) buildGrid(); }, 150); };
    map.on('zoomend', handler);
    map.on('moveend', handler);
    return () => { map.off('zoomend', handler); map.off('moveend', handler); clearTimeout(t); };
  }, [mapReady, gridOn, setVis, setGeo, buildGrid]);

  // ─── Basemap switch ──────────────────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (containerRef.current) {
      containerRef.current.style.backgroundColor =
        basemap === 'dark' ? '#0d0d0d' : basemap === 'satellite' ? '#000000' : '#e8e8e0';
    }

    const onStyleLoad = () => {
      resetSources();
      addBaseGeoLayers(map, palette());
      initGridLayers(map, projection, basemap, gridOn);
      if (gridOn) buildGrid();
      reapplyActiveLayers();
    };

    map.once('style.load', onStyleLoad);
    map.setStyle(BASEMAPS[basemap]);
    return () => { map.off('style.load', onStyleLoad); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap]);

  // ─── Projection switch ───────────────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    // @ts-ignore
    map.setProjection?.({ type: projection });
  }, [projection, mapReady]);

  // ─── Basemap cycle ───────────────────────────────────────────────────────────

  const cycleBasemap = useCallback(() => {
    setBasemap((prev) => {
      const idx = BASEMAP_CYCLE.indexOf(prev);
      return BASEMAP_CYCLE[(idx + 1) % BASEMAP_CYCLE.length];
    });
  }, []);

  // ─── Public API ──────────────────────────────────────────────────────────────

  return {
    containerRef,
    mapRef,
    searchMarkerRef,
    mapReady,
    // Grid
    gridOn, setGridOn,
    // Basemap / projection
    basemap, cycleBasemap,
    projection, setProjection,
    // Naval layers
    bathyOn,    setBathyOn,
    eezOn,      setEezOn,
    isobathsOn, setIsobathsOn,
    shippingOn, setShippingOn,
    // Pointer
    pointerInfo,
    // Popup helpers
    showPointInfo,
    closePointInfo,
  };
}