import { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import {
  ANCHOR_ICON_SVG,
  BASEMAP_CYCLE,
  BasemapKey,
  BASEMAPS,
  classifySeaState,
  EMPTY_FC,
  haversineNm,        // ← add this
  idSafe,
  PIN_ICON_SVG,
  PORT_LOCATIONS,
  ProjectionKey,
  SHIP_ICON_SVG,
  SHIP_LOCATIONS,
  getPortFacilityStatus,
  PortFacilityStatus,
  WorkshopStatus,
} from '@/lib/globe';
import { ShipInfo } from '@/components/ship_panel/shipPanel';
import { injectPhotosIntoPopup } from '@/lib/portImageService';

const pointStyle = `
  background:#FFFFFF;
  color:#1A1A1A;
  border-radius:10px;
  padding:14px;
  font-family:ui-monospace, 'JetBrains Mono', monospace;
  border:1px solid #E2E4EA;
  box-shadow:0 8px 24px rgba(20,20,40,0.12);
`;

type UseGlobeMapEngineArgs = {
  initialCenter: [number, number];
  initialZoom: number;
  showGrid: boolean;
  onShipClick: (ship: ShipInfo) => void;
};

export function useGlobeMapEngine({ initialCenter, initialZoom, showGrid, onShipClick }: UseGlobeMapEngineArgs) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);
  const shipMarkersRef = useRef<maplibregl.Marker[]>([]);
  const portMarkersRef = useRef<maplibregl.Marker[]>([]);

  const [mapReady, setMapReady] = useState(false);
  const [gridOn, setGridOn] = useState(showGrid);
  const gridOnRef = useRef(gridOn);

  const [basemap, setBasemap] = useState<BasemapKey>('light');
  const [projection, setProjection] = useState<ProjectionKey>('mercator');

  const [pointerInfo, setPointerInfo] = useState<{ lat: number; lng: number; zoom: number }>({
    lat: initialCenter[1],
    lng: initialCenter[0],
    zoom: initialZoom,
  });

  useEffect(() => {
    gridOnRef.current = gridOn;
  }, [gridOn]);

  const setGeo = useCallback((source: string, features: any[]) => {
    const src = mapRef.current?.getSource(source) as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData({ type: 'FeatureCollection', features });
  }, []);

  const setVis = useCallback((ids: string[], visible: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    ids.forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    });
  }, []);

  const buildGrid = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const zoom = map.getZoom();

    let spacing = 20;
    if (zoom > 1) spacing = 15;
    if (zoom > 2) spacing = 10;
    if (zoom > 3) spacing = 5;
    if (zoom > 5) spacing = 2.5;
    if (zoom > 6.5) spacing = 1;
    if (zoom > 8.5) spacing = 0.5;
    if (zoom > 11) spacing = 0.25;

    const minorLines: any[] = [];
    const majorLines: any[] = [];
    const points: any[] = [];

    for (let lat = -80; lat <= 80; lat += spacing) {
      const coords: [number, number][] = [];
      for (let lng = -180; lng <= 180; lng += 5) coords.push([lng, lat]);
      const isMajor = Math.abs(lat % (spacing * 5)) < 1e-6;
      const feature = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: { major: isMajor },
      };
      (isMajor ? majorLines : minorLines).push(feature);
    }

    for (let lng = -180; lng <= 180; lng += spacing) {
      const coords: [number, number][] = [];
      for (let lat = -85; lat <= 85; lat += 5) coords.push([lng, lat]);
      const isMajor = Math.abs(lng % (spacing * 5)) < 1e-6;
      const feature = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: { major: isMajor },
      };
      (isMajor ? majorLines : minorLines).push(feature);
    }

    const pointSpacing = zoom < 3 ? spacing : spacing * 1.5;
    for (let lat = -80; lat <= 80; lat += pointSpacing) {
      for (let lng = -180; lng <= 180; lng += pointSpacing) {
        points.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: { lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) },
        });
      }
    }

    setGeo('grid-lines-minor', minorLines);
    setGeo('grid-lines-major', majorLines);
    setGeo('grid-points', points);
  }, [setGeo]);

  const closePointInfo = useCallback(() => {
    popupRef.current?.remove();
    popupRef.current = null;
  }, []);

  const popup = useCallback((coords: [number, number], html: string) => {
    const map = mapRef.current;
    if (!map) return;
    popupRef.current?.remove();
    popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '300px', offset: 12 })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map);
  }, []);

 const showPointInfo = useCallback(
  (lat: number, lng: number) => {
    const latR = Number(lat.toFixed(4));
    const lngR = Number(lng.toFixed(4));
    const safeId = `${idSafe(latR)}-${idSafe(lngR)}`.replace(/\./g, '_');
    const locId = `grid-loc-${safeId}`;
    const seaId = `grid-sea-${safeId}`;

    // ── Naval asset calculations ──────────────────────────────────────────
    const RADIUS_NM = 50;

    // All 8 ships with their distance from the clicked point
    const shipsWithDist = SHIP_LOCATIONS
      .map((s) => ({ ...s, distNm: Math.round(haversineNm(lat, lng, s.lat, s.lng)) }))
      .sort((a, b) => a.distNm - b.distNm);

    // Ships within 50 NM (these are "Friendly" naval assets)
    const shipsInRadius = shipsWithDist.filter((s) => s.distNm <= RADIUS_NM);

    // Deterministic pseudo-random vessel counts seeded on lat/lng
    // so they're stable per grid point but vary across the map
    const seed = Math.abs(Math.round(latR * 100 + lngR * 37));
    const pseudoRand = (offset: number) => {
      let h = (seed + offset * 2654435761) >>> 0;
      h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
      return (h >>> 0) / 0xffffffff;
    };

    const merchantCount  = Math.round(pseudoRand(1) * 24 + 8);   // 8–32
    const fishingCount   = Math.round(pseudoRand(2) * 18 + 4);   // 4–22
    const supportCount   = Math.round(pseudoRand(3) * 3 + 1);    // 1–4
    const patrolAircraft = Math.round(pseudoRand(4) * 3 + 1);    // 1–4
    const helicopters    = Math.round(pseudoRand(5) * 3);         // 0–3
    const unknownCount   = Math.round(pseudoRand(6) * 2);         // 0–2

    // ── Build the nearby ships HTML rows ─────────────────────────────────
    const MAX_SHOWN = 4; // show closest 4 to keep popup compact
    const shipRowsHtml = shipsWithDist.slice(0, MAX_SHOWN).map((s) => {
      const inRange = s.distNm <= RADIUS_NM;
      const color = inRange ? '#0B3D91' : '#6B7280';
      const badge = inRange
        ? `<span style="background:#EFF6FF;color:#0B3D91;border-radius:4px;padding:1px 5px;font-size:9px;font-weight:700;">IN RANGE</span>`
        : '';
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid #F3F4F6;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="display:inline-flex;width:18px;height:18px;border-radius:50%;background:${color};align-items:center;justify-content:center;">
              ${SHIP_ICON_SVG.replace('width="14"', 'width="10"').replace('height="14"', 'height="10"')}
            </span>
            <span style="font-size:10px;font-weight:600;color:#1A1A1A;">${s.name}</span>
          </div>
          <div style="display:flex;align-items:center;gap:5px;">
            ${badge}
            <span style="font-size:10px;font-weight:700;color:${color};">${s.distNm} NM</span>
          </div>
        </div>`;
    }).join('');

    // ── Vessel count rows ─────────────────────────────────────────────────
const vesselRows: [string, string, string][] = [
  ['Friendly Ships',   '—', '#16A34A'],
  ['Merchant Ships',   '—', '#374151'],
  ['Fishing Boats',    '—', '#374151'],
  ['Support Vessels',  '—', '#374151'],
  ['Patrol Aircraft',  '—', '#EA580C'],
  ['Helicopters',      '—', '#EA580C'],
  ['Unknown',          '—', '#DC2626'],
];

    const vesselRowsHtml = vesselRows.map(([label, count, color]) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:2.5px 0;">
        <span style="font-size:10px;color:#555;">${label}</span>
        <span style="font-size:10px;font-weight:700;color:${color};">${count}</span>
      </div>`
    ).join('');

    // ── Full popup HTML ───────────────────────────────────────────────────
    popup([lng, lat], `
      <div style="${pointStyle};min-width:280px;max-width:300px;">
        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="font-weight:700;font-size:12px;letter-spacing:0.06em;color:#3949AB;">GRID POINT</div>
          <button
            onclick="window.__saveGlobePin && window.__saveGlobePin(${latR}, ${lngR}); this.innerText='Saved ✓'; this.disabled=true; this.style.opacity=0.6;"
            style="display:flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:#fff;background:#DC2626;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;"
          >
            ${PIN_ICON_SVG} Save
          </button>
        </div>

        <!-- Coordinates -->
        <div style="font-size:11px;color:#444;line-height:1.6;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #EEE;">
          LAT &nbsp;${latR}<br/>LNG &nbsp;${lngR}
        </div>

        <!-- Location (reverse geocode) -->
        <div id="${locId}" style="font-size:10px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #EEE;color:#999;">
          Loading location…
        </div>

        <!-- Nearby Naval Assets -->
        <div style="margin-bottom:8px;">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.07em;color:#0B3D91;margin-bottom:6px;">
            ⚓ NEARBY NAVAL ASSETS
          </div>
          ${shipRowsHtml}
          ${shipsWithDist.length > MAX_SHOWN
            ? `<div style="font-size:9px;color:#9CA3AF;padding-top:4px;text-align:right;">
                +${shipsWithDist.length - MAX_SHOWN} more vessels
               </div>`
            : ''}
        </div>

        <!-- Within 50 NM summary -->
        <div style="background:#F8F9FA;border-radius:6px;padding:8px;margin-bottom:8px;">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.07em;color:#374151;margin-bottom:6px;">
            📡 WITHIN ${RADIUS_NM} NM
          </div>
          ${vesselRowsHtml}
        </div>

        <!-- Sea state -->
        <div id="${seaId}" style="font-size:10px;padding-top:8px;border-top:1px solid #EEE;color:#999;">
          Loading sea state…
        </div>
      </div>
    `);

    // Async: reverse geocode
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latR}&lon=${lngR}&zoom=10`)
      .then((r) => r.json())
      .then((j) => {
        const el = document.getElementById(locId);
        if (el) el.textContent = j.display_name || 'No nearby location data';
      })
      .catch(() => {
        const el = document.getElementById(locId);
        if (el) el.textContent = 'Location lookup failed';
      });

    // Async: sea state
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${latR}&longitude=${lngR}&current=wave_height,wave_period,wave_direction,sea_surface_temperature`
    )
      .then((r) => r.json())
      .then((j) => {
        const el = document.getElementById(seaId);
        if (!el) return;
        const c = j?.current;
        if (!c || c.wave_height == null) {
          el.innerHTML = `<span style="color:#999;">No marine data (likely inland)</span>`;
          return;
        }
        const { label } = classifySeaState(c.wave_height);
        el.innerHTML = `
          <div style="font-weight:700;font-size:10px;letter-spacing:0.06em;color:#00897B;margin-bottom:4px;">
            🌊 SEA STATE — ${label.toUpperCase()}
          </div>
          <div style="color:#444;font-size:10px;line-height:1.6;">
            Wave height &nbsp;${c.wave_height} m<br/>
            ${c.wave_period != null ? `Wave period &nbsp;${c.wave_period} s<br/>` : ''}
            ${c.wave_direction != null ? `Wave dir &nbsp;${c.wave_direction}°<br/>` : ''}
            ${c.sea_surface_temperature != null ? `SST &nbsp;${c.sea_surface_temperature} °C` : ''}
          </div>`;
      })
      .catch(() => {
        const el = document.getElementById(seaId);
        if (el) el.innerHTML = `<span style="color:#999;">Sea state lookup failed</span>`;
      });
  },
  [popup]
);

  const handleGridClick = useCallback(
    (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      showPointInfo(p.lat, p.lng);
    },
    [showPointInfo]
  );

  const initGridLayers = useCallback(
    (map: maplibregl.Map) => {
      if (!map.getSource('grid-lines-minor')) {
        map.addSource('grid-lines-minor', { type: 'geojson', data: EMPTY_FC });
      }
      if (!map.getSource('grid-lines-major')) {
        map.addSource('grid-lines-major', { type: 'geojson', data: EMPTY_FC });
      }
      if (!map.getSource('grid-points')) {
        map.addSource('grid-points', { type: 'geojson', data: EMPTY_FC });
      }

      if (!map.getLayer('grid-lines-minor-layer')) {
        map.addLayer({
          id: 'grid-lines-minor-layer',
          type: 'line',
          source: 'grid-lines-minor',
          paint: { 'line-color': '#3949AB', 'line-width': 0.5, 'line-opacity': 0.2 },
        });
      }
      if (!map.getLayer('grid-lines-major-layer')) {
        map.addLayer({
          id: 'grid-lines-major-layer',
          type: 'line',
          source: 'grid-lines-major',
          paint: { 'line-color': '#3949AB', 'line-width': 1.1, 'line-opacity': 0.45 },
        });
      }
      if (!map.getLayer('grid-points-hit')) {
        map.addLayer({
          id: 'grid-points-hit',
          type: 'circle',
          source: 'grid-points',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 6, 10, 14],
            'circle-color': '#3949AB',
            'circle-opacity': 0,
          },
        });
      }
      if (!map.getLayer('grid-points-layer')) {
        map.addLayer({
          id: 'grid-points-layer',
          type: 'circle',
          source: 'grid-points',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 1.5, 6, 4, 10, 6],
            'circle-color': '#3949AB',
            'circle-opacity': 0.6,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-opacity': 0.9,
          },
        });
      }

      // @ts-ignore
      map.setProjection?.({ type: projection });
      // @ts-ignore
      map.setSky?.({
        'sky-color': '#0b1026',
        'sky-horizon-blend': 0.5,
        'horizon-color': '#1a2240',
        'horizon-fog-blend': 0.5,
        'fog-color': '#dfe9f5',
        'fog-ground-blend': 0.5,
      });

      setVis(
        ['grid-lines-minor-layer', 'grid-lines-major-layer', 'grid-points-layer', 'grid-points-hit'],
        gridOnRef.current
      );
      if (gridOnRef.current) buildGrid();
    },
    [projection, setVis, buildGrid]
  );

  // Mount map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAPS.dark,
      center: initialCenter,
      zoom: initialZoom,
      minZoom: 0,
      maxZoom: 18,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      mapRef.current = map;
      initGridLayers(map);

      SHIP_LOCATIONS.forEach((ship) => {
        const el = document.createElement('div');
        el.style.cssText = `
          width:26px;height:26px;border-radius:50%;
          background:#0B3D91;border:2px solid #FFFFFF;
          display:flex;align-items:center;justify-content:center;
          cursor:pointer;
          box-shadow:0 2px 8px rgba(0,0,0,0.4);
        `;
        el.innerHTML = SHIP_ICON_SVG;
        el.title = ship.name;

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onShipClick(ship);
        });

        const marker = new maplibregl.Marker({ element: el }).setLngLat([ship.lng, ship.lat]).addTo(map);
        shipMarkersRef.current.push(marker);
      });

      PORT_LOCATIONS.forEach((port) => {
        const statusColor =
          port.portStatus === 'Self'
            ? '#16A34A'
            : port.portStatus === 'Adversary'
              ? '#DC2626'
              : '#EA580C'; // Friendly = orange

        const el = document.createElement('div');
        el.style.cssText = `
    width:24px;height:24px;border-radius:50%;
    background:${statusColor};border:2px solid #FFFFFF;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;
    box-shadow:0 2px 8px rgba(0,0,0,0.4);
  `;
        el.innerHTML = ANCHOR_ICON_SVG;
        el.title = port.name;

        const osmUrl = `https://www.openstreetmap.org/?mlat=${port.lat}&mlon=${port.lng}&zoom=14`;

        const f: PortFacilityStatus = getPortFacilityStatus(port.name);

        const statusDot = (s: WorkshopStatus) =>
          `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;background:${s === 'Available' ? '#16A34A' : s === 'Busy' ? '#EA580C' : '#9CA3AF'
          };"></span>`;

        const operationalColor =
          f.operational === 'Operational' ? '#16A34A' :
            f.operational === 'Reduced Capacity' ? '#EA580C' :
              f.operational === 'Under Maintenance' ? '#FACC15' : '#DC2626';

        const secColor =
          f.securityLevel === 'Normal' ? '#16A34A' :
            f.securityLevel === 'Elevated' ? '#EA580C' :
              f.securityLevel === 'High' ? '#DC2626' : '#7C3AED';

        const weatherIcon: Record<string, string> = {
          Clear: '☀️', Cloudy: '⛅', Rain: '🌧️', Storm: '⛈️', Fog: '🌫️', Snow: '❄️',
        };

        const photoId = `port-photo-${idSafe(port.name)}`;

        const portPopupHtml = `
  <div style="${pointStyle};min-width:260px;">
    <style>
      .maplibregl-popup-content .photo-credit,
      .maplibregl-popup-content [class*="credit"],
      .maplibregl-popup-content [class*="attribution"],
      .maplibregl-popup-content figure figcaption,
      .maplibregl-popup-content [class*="photographer"],
      .maplibregl-popup-content [class*="source"],
      .maplibregl-popup-content [class*="caption"] { display:none !important; }
    </style>

    <!-- Photo slot — injected async, starts hidden -->
    <div id="${photoId}" style="margin-bottom:8px;border-radius:6px;overflow:hidden;display:none;"></div>

    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div style="font-weight:700;font-size:12px;letter-spacing:0.06em;color:${statusColor};">
        ${port.name.toUpperCase()}
      </div>
      <a href="${osmUrl}" target="_blank" rel="noopener noreferrer"
        style="display:flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:#fff;background:${statusColor};border-radius:6px;padding:4px 8px;text-decoration:none;white-space:nowrap;line-height:1;">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
          <path d="M7 2H2v12h12V9" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M10 2h4v4M14 2L8 8" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Open Map
      </a>
    </div>

    <!-- Port meta -->
    <div style="font-size:11px;color:#555;line-height:1.7;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #EEE;">
      ${port.category} &nbsp;·&nbsp;
      <span style="font-weight:600;color:${statusColor};">${port.portStatus}</span><br/>
      ${port.country}<br/>
      LAT ${port.lat.toFixed(4)} &nbsp; LNG ${port.lng.toFixed(4)}
    </div>

    <!-- Status grid -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
      <div style="background:#F8F9FA;border-radius:6px;padding:6px 8px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.07em;color:#888;margin-bottom:2px;">STATUS</div>
        <div style="font-size:11px;font-weight:600;color:${operationalColor};">${f.operational}</div>
      </div>
      <div style="background:#F8F9FA;border-radius:6px;padding:6px 8px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.07em;color:#888;margin-bottom:2px;">DRY DOCKS</div>
        <div style="font-size:11px;font-weight:600;color:#1A1A1A;">${f.dryDocks} Available</div>
      </div>
      <div style="background:#F8F9FA;border-radius:6px;padding:6px 8px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.07em;color:#888;margin-bottom:2px;">WEATHER</div>
        <div style="font-size:11px;font-weight:600;color:#1A1A1A;">${weatherIcon[f.weather] ?? ''} ${f.weather}</div>
      </div>
      <div style="background:#F8F9FA;border-radius:6px;padding:6px 8px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.07em;color:#888;margin-bottom:2px;">SECURITY</div>
        <div style="font-size:11px;font-weight:600;color:${secColor};">${f.securityLevel}</div>
      </div>
    </div>

    <!-- Maintenance facilities -->
    <div style="background:#F8F9FA;border-radius:6px;padding:8px;">
      <div style="font-size:9px;font-weight:700;letter-spacing:0.07em;color:#888;margin-bottom:6px;">MAINTENANCE FACILITIES</div>
      <div style="font-size:10px;line-height:2;color:#333;">
        <div style="display:flex;justify-content:space-between;gap:8px;">
          <span style="white-space:nowrap;">Gas Turbine Workshop</span>
          <span style="white-space:nowrap;">${statusDot(f.gasTurbineWorkshop)}${f.gasTurbineWorkshop}</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:8px;">
          <span style="white-space:nowrap;">Electrical Workshop</span>
          <span style="white-space:nowrap;">${statusDot(f.electricalWorkshop)}${f.electricalWorkshop}</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:8px;">
          <span style="white-space:nowrap;">Weapon Calibration</span>
          <span style="white-space:nowrap;">${statusDot(f.weaponCalibration)}${f.weaponCalibration}</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:8px;">
          <span style="white-space:nowrap;">Radar Testing</span>
          <span style="white-space:nowrap;">${statusDot(f.radarTesting)}${f.radarTesting}</span>
        </div>
      </div>
    </div>
  </div>
`;

        const portPopup = new maplibregl.Popup({ offset: 16, maxWidth: '320px' }).setHTML(portPopupHtml);

        portPopup.on('open', () => {
          requestAnimationFrame(() => {
            const photoSlot = document.getElementById(photoId);
            if (photoSlot) {
              injectPhotosIntoPopup(
                photoSlot,           // <-- target only the photo slot div, not the whole popup
                port.name,
                port.category,
                port.country,
                port.lat,
                port.lng,
                osmUrl
              );
              // Once photo service puts content in, reveal the slot
              const observer = new MutationObserver(() => {
                if (photoSlot.innerHTML.trim()) {
                  photoSlot.style.display = 'block';
                  observer.disconnect();
                }
              });
              observer.observe(photoSlot, { childList: true, subtree: true });
            }
          });
        });
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([port.lng, port.lat])
          .setPopup(portPopup)
          .addTo(map);

        portMarkersRef.current.push(marker);
      });

      map.on('click', 'grid-points-hit', handleGridClick);
      map.on('mouseenter', 'grid-points-hit', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'grid-points-hit', () => {
        map.getCanvas().style.cursor = '';
      });

      map.on('mousemove', (e) => {
        setPointerInfo({ lat: e.lngLat.lat, lng: e.lngLat.lng, zoom: map.getZoom() });
      });
      map.on('zoom', () => {
        setPointerInfo((prev) => ({ ...prev, zoom: map.getZoom() }));
      });

      setMapReady(true);
    });

    return () => {
      shipMarkersRef.current.forEach((m) => m.remove());
      shipMarkersRef.current = [];
      portMarkersRef.current.forEach((m) => m.remove());
      portMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild grid on zoom
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    let t: ReturnType<typeof setTimeout>;

    const handler = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (gridOnRef.current) buildGrid();
      }, 200);
    };

    map.on('zoomend', handler);
    return () => {
      map.off('zoomend', handler);
      clearTimeout(t);
    };
  }, [mapReady, buildGrid]);

  // Toggle grid visibility
  useEffect(() => {
    if (!mapReady) return;
    setVis(
      ['grid-lines-minor-layer', 'grid-lines-major-layer', 'grid-points-layer', 'grid-points-hit'],
      gridOn
    );
    if (gridOn) buildGrid();
    else {
      setGeo('grid-lines-minor', []);
      setGeo('grid-lines-major', []);
      setGeo('grid-points', []);
    }
  }, [mapReady, gridOn, setVis, setGeo, buildGrid]);

  // Switch basemap
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const onStyleLoad = () => {
      initGridLayers(map);
    };

    map.once('style.load', onStyleLoad);
    map.setStyle(BASEMAPS[basemap]);

    return () => {
      map.off('style.load', onStyleLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap]);

  // Switch projection
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    // @ts-ignore
    map.setProjection?.({ type: projection });
  }, [projection, mapReady]);

  const cycleBasemap = useCallback(() => {
    setBasemap((prev) => {
      const idx = BASEMAP_CYCLE.indexOf(prev);
      return BASEMAP_CYCLE[(idx + 1) % BASEMAP_CYCLE.length];
    });
  }, []);

  return {
    containerRef,
    mapRef,
    searchMarkerRef,
    mapReady,
    gridOn,
    setGridOn,
    basemap,
    cycleBasemap,
    projection,
    setProjection,
    pointerInfo,
    showPointInfo,
    pointStyle,
    closePointInfo,
  };
}