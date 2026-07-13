// 'use client';

// import { useCallback, useEffect, useState } from 'react';
// import maplibregl from 'maplibre-gl';
// import 'maplibre-gl/dist/maplibre-gl.css';
// import {
//   PromptInput,
//   PromptInputAction,
//   PromptInputActions,
//   PromptInputTextarea,
// } from '@/components/ui/pinput';
// import { Button } from '@/components/ui/button';
// import { ArrowUp, Loader2, MapPin, Globe as GlobeIcon, Map as MapIcon, Layers } from 'lucide-react';
// import CommandNavbar from './navbar';
// import ShipDependabilityPanel, { ShipCandidate } from './Shipdependabilitypanel';
// import ShipInfoPanel, { ShipInfo } from '@/components/ship_panel/shipPanel';
// import {
//   CANDIDATE_SHIP_COUNT,
//   extractCoordinatesFromText,
//   getNearestShips,
//   GlobeMapProps,
//   KNOWN_WATER_BODIES,
//   PANEL_WIDTH,
//   parseCoordinateString,
//   SHIP_PANEL_WIDTH,
// } from '@/lib/globe';
// import { useGlobeMapEngine } from '@/hooks/Useglobemapengine';
// import { parseShipActivityQuery } from '@/lib/shipActivity';
// import ShipActivityPanel from './globe/views/ShipActivityPanel';


// import WholeKG from './wholeKG';

// export default function GlobeMap({
//   initialCenter = [77.209, 28.6139],
//   initialZoom = 1.8,
//   showGrid = true,
// }: GlobeMapProps) {
//   type SavedPin = { id: string; lat: number; lng: number; savedAt: number };
//   const [savedPins, setSavedPins] = useState<SavedPin[]>([]);
//   const savedMarkersRefState = useState<Map<string, maplibregl.Marker>>(new Map())[0];

//   // Ship-dependability split panel
//   const [panelOpen, setPanelOpen] = useState(false);
//   const [candidateShips, setCandidateShips] = useState<ShipCandidate[]>([]);
//   const [incidentCoords, setIncidentCoords] = useState<{ lat: number; lng: number } | null>(null);

//   // Per-ship info split panel
//   const [shipPanelOpen, setShipPanelOpen] = useState(false);
//   const [selectedShip, setSelectedShip] = useState<ShipInfo | null>(null);

//   // Prompt-style location search/jump input
//   const [query, setQuery] = useState('');
//   const [isSearching, setIsSearching] = useState(false);
//   const [searchError, setSearchError] = useState<string | null>(null);

//   // Ship activity tracking panels
//   const [activityPanelOpen, setActivityPanelOpen] = useState(false);
//   const [activityShipIds, setActivityShipIds] = useState<string[]>([]);

//   // Track all possible side panel visibility settings
//   const anyPanelOpen = panelOpen || shipPanelOpen || activityPanelOpen;

//   // Compute right offset for the map container based on which panel is open.
//   // ShipInfoPanel wins if multiple are somehow open simultaneously.
//   const activePanelWidth = shipPanelOpen
//     ? SHIP_PANEL_WIDTH
//     : panelOpen || activityPanelOpen
//     ? PANEL_WIDTH
//     : 0;

//   const openShipInfoPanel = useCallback((ship: ShipInfo) => {
//     setSelectedShip(ship);
//     setPanelOpen(false);
//     setShipPanelOpen(true);
//   }, []);
//   const {
//     containerRef,
//     mapRef,
//     searchMarkerRef,
//     mapReady,
//     basemap,
//     cycleBasemap,
//     projection,
//     setProjection,
//     pointerInfo,
//     showPointInfo,
//     pointStyle,
//     closePointInfo,
//   } = useGlobeMapEngine({ initialCenter, initialZoom, showGrid, onShipClick: openShipInfoPanel });

//   // Resize the MapLibre canvas after the panel slide transition completes (300 ms).
//   // This ensures MapLibre occupies the correct visible area and re-centers properly.
//   useEffect(() => {
//     const map = mapRef.current;
//     if (!map || !mapReady) return;
//     const t = setTimeout(() => map.resize(), 310);
//     return () => clearTimeout(t);
//   }, [activePanelWidth, mapReady, mapRef]);

//   const closeShipInfoPanel = useCallback(() => {
//     setShipPanelOpen(false);
//   }, []);

//   const savePin = useCallback((lat: number, lng: number) => {
//     const id = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
//     setSavedPins((prev) => (prev.some((p) => p.id === id) ? prev : [...prev, { id, lat, lng, savedAt: Date.now() }]));
//   }, []);

//   const removePin = useCallback((id: string) => {
//     setSavedPins((prev) => prev.filter((p) => p.id !== id));
//   }, []);

//   // Expose savePin to the raw-HTML popup buttons
//   useEffect(() => {
//     (window as any).__saveGlobePin = savePin;
//     return () => {
//       delete (window as any).__saveGlobePin;
//     };
//   }, [savePin]);

//   // Sync savedPins state -> red pinpoint markers on the map
//   useEffect(() => {
//     const map = mapRef.current;
//     if (!map || !mapReady) return;

//     const currentIds = new Set(savedPins.map((p) => p.id));

//     savedMarkersRefState.forEach((marker, id) => {
//       if (!currentIds.has(id)) {
//         marker.remove();
//         savedMarkersRefState.delete(id);
//       }
//     });

//     savedPins.forEach((pin) => {
//       if (savedMarkersRefState.has(pin.id)) return;
//       const marker = new maplibregl.Marker({ color: '#DC2626' })
//         .setLngLat([pin.lng, pin.lat])
//         .setPopup(
//           new maplibregl.Popup({ offset: 12 }).setHTML(`
//             <div style="${pointStyle}">
//               <div style="font-weight:700;font-size:12px;letter-spacing:0.06em;color:#DC2626;margin-bottom:6px;">
//                 SAVED PINPOINT
//               </div>
//               <div style="font-size:11px;color:#444;line-height:1.5;">
//                 LAT &nbsp;${pin.lat.toFixed(4)}<br/>
//                 LNG &nbsp;${pin.lng.toFixed(4)}
//               </div>
//             </div>
//           `)
//         )
//         .addTo(map);
//       savedMarkersRefState.set(pin.id, marker);
//     });
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [savedPins, mapReady]);

//   // Computes the nearest CANDIDATE_SHIP_COUNT ship stations to an incident position
//   const openShipPanelForIncident = useCallback((lat: number, lng: number) => {
//     setIncidentCoords({ lat, lng });
//     setCandidateShips(getNearestShips(lat, lng, CANDIDATE_SHIP_COUNT));
//     setShipPanelOpen(false);
//     setPanelOpen(true);
//   }, []);

//   // Combined execution block handles normal queries and intercepting ship activity lookups safely
//   const handleSearchSubmit = useCallback(async () => {
//     const map = mapRef.current;
//     if (!map || !query.trim() || isSearching) return;

//     setSearchError(null);

//     // Intercept ship activity lookups here safely instead of breaking the render pipeline
//     const shipIds = parseShipActivityQuery(query);
//     if (shipIds) {
//       setActivityShipIds(shipIds);
//       setActivityPanelOpen(true);
//       setPanelOpen(false);
//       setShipPanelOpen(false);
//       setQuery('');
//       return;
//     }

//     const dropMarkerAndShowInfo = (lat: number, lng: number) => {
//       searchMarkerRef.current?.remove();
//       searchMarkerRef.current = new maplibregl.Marker({ color: '#DC2626' })
//         .setLngLat([lng, lat])
//         .addTo(map);
//       showPointInfo(lat, lng);
//     };

//     const extracted = extractCoordinatesFromText(query);
//     if (extracted) {
//       map.flyTo({ center: [extracted.lng, extracted.lat], zoom: Math.max(map.getZoom(), 6), essential: true });
//       map.once('moveend', () => dropMarkerAndShowInfo(extracted.lat, extracted.lng));
//       openShipPanelForIncident(extracted.lat, extracted.lng);
//       setQuery('');
//       return;
//     }

//     const coords = parseCoordinateString(query);
//     if (coords) {
//       map.flyTo({ center: [coords.lng, coords.lat], zoom: Math.max(map.getZoom(), 6), essential: true });
//       map.once('moveend', () => dropMarkerAndShowInfo(coords.lat, coords.lng));
//       openShipPanelForIncident(coords.lat, coords.lng);
//       setQuery('');
//       return;
//     }

//     const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ');
//     const known = KNOWN_WATER_BODIES[normalized];
//     if (known) {
//       map.flyTo({ center: [known.lng, known.lat], zoom: known.zoom ?? 5, essential: true });
//       map.once('moveend', () => dropMarkerAndShowInfo(known.lat, known.lng));
//       setQuery('');
//       return;
//     }

//     setIsSearching(true);
//     try {
//       const res = await fetch(
//         `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
//           query.trim()
//         )}&limit=8&addressdetails=0`
//       );
//       const results = await res.json();
//       if (!results?.length) {
//         setSearchError('No matching location');
//         return;
//       }

//       const waterMatch = results.find((r: any) =>
//         ['sea', 'bay', 'strait', 'water', 'natural'].includes(r.class) ||
//         ['sea', 'bay', 'strait', 'ocean', 'gulf'].includes(r.type)
//       );
//       const preferred = waterMatch || results[0];

//       const { lat, lon } = preferred;
//       map.flyTo({ center: [Number(lon), Number(lat)], zoom: 6, essential: true });
//       map.once('moveend', () => dropMarkerAndShowInfo(Number(lat), Number(lon)));
//       setQuery('');
//     } catch {
//       setSearchError('Search failed');
//     } finally {
//       setIsSearching(false);
//     }
//   }, [query, isSearching, showPointInfo, openShipPanelForIncident, mapRef, searchMarkerRef]);

//   return (
//     <div className="relative w-full h-full bg-black overflow-hidden">
//       <div className="absolute top-0 left-0 right-0 z-20">
//         <CommandNavbar />
//       </div>

//       {/* Map container — right edge pulls left by the active panel width so the
//           map always fills only the visible area. The CSS transition matches the
//           panel slide-in animation duration. */}
//       <div
//         ref={containerRef}
//         style={{
//           position: 'absolute',
//           top: 0,
//           left: 0,
//           bottom: 0,
//           right: activePanelWidth,
//           transition: 'right 300ms ease-in-out',
//         }}
//       />

//       {/* Bottom-left control cluster — icon buttons + live coordinate readout */}
//       <div
//         className="absolute bottom-4 left-4 z-10 flex flex-col items-start gap-2 transition-all duration-300 ease-in-out"
//       >
//         <div className="flex gap-2">
//           <button
//             onClick={() => setProjection((p) => (p === 'globe' ? 'mercator' : 'globe'))}
//             title={projection === 'globe' ? 'Switch to flat map' : 'Switch to globe'}
//             className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#150f28]/90 border border-violet-500/30 backdrop-blur-md shadow-[0_0_16px_rgba(139,92,246,0.25)] text-violet-300 hover:text-violet-100 hover:border-violet-400/70 transition-colors"
//           >
//             {projection === 'globe' ? <GlobeIcon className="size-4" /> : <MapIcon className="size-4" />}
//           </button>
//           <button
//             onClick={cycleBasemap}
//             title={`Basemap: ${basemap}`}
//             className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#150f28]/90 border border-emerald-500/30 backdrop-blur-md shadow-[0_0_16px_rgba(16,185,129,0.25)] text-emerald-300 hover:text-emerald-100 hover:border-emerald-400/70 transition-colors"
//           >
//             <Layers className="size-4" />
//           </button>
//         </div>

//         <div className="px-3 py-1.5 rounded-lg bg-[#0c0818]/90 border border-violet-500/20 backdrop-blur-md font-mono text-[10px] tracking-wide text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.15)]">
//           <span className="text-violet-400 font-semibold">COORD</span>{' '}
//           {pointerInfo.lat.toFixed(4)}, {pointerInfo.lng.toFixed(4)}
//           <span className="mx-2 text-violet-700">|</span>
//           <span className="text-violet-400 font-semibold">Z</span> {pointerInfo.zoom.toFixed(1)}
//         </div>
//       </div>

//       {/* Prompt-style location search — hidden when any panel is open */}
//       {!anyPanelOpen && (
//         <div className="absolute bottom-4 left-1/2 z-10 w-full max-w-[720px] px-4 flex flex-col items-center gap-1 -translate-x-1/2">
//           <PromptInput
//             value={query}
//             onValueChange={(v) => {
//               setQuery(v);
//               if (searchError) setSearchError(null);
//             }}
//             isLoading={isSearching}
//             onSubmit={handleSearchSubmit}
//             className="bg-black text-white w-full shadow-lg"
//           >
//             <PromptInputTextarea placeholder="Search a place, lat, lng, DMS, or paste a report containing coordinates…" />
//             <PromptInputActions className="flex items-center justify-end pt-2">
//               <PromptInputAction tooltip={isSearching ? 'Searching…' : 'Go to location'}>
//                 <Button
//                   variant="default"
//                   size="icon"
//                   className="h-8 w-8 rounded-full"
//                   onClick={handleSearchSubmit}
//                   disabled={isSearching || !query.trim()}
//                 >
//                   {isSearching ? (
//                     <Loader2 className="size-4 animate-spin" />
//                   ) : (
//                     <ArrowUp className="size-5" />
//                   )}
//                 </Button>
//               </PromptInputAction>
//             </PromptInputActions>
//           </PromptInput>
//           {searchError && (
//             <div className="flex items-center gap-1 text-[10px] text-red-600 bg-white px-2 py-0.5 rounded shadow-sm">
//               <MapPin className="size-3" />
//               {searchError}
//             </div>
//           )}
//         </div>
//       )}

//       <ShipDependabilityPanel
//         open={panelOpen}
//         onClose={() => {
//           setPanelOpen(false);
//           searchMarkerRef.current?.remove();
//           searchMarkerRef.current = null;
//           closePointInfo();
//         }}
//         ships={candidateShips}
//         incident={incidentCoords}
//         onOpenDashboard={(shipName) => {
//           const ship = candidateShips.find((s) => s.name === shipName);
//           if (ship) {
//             openShipInfoPanel({
//               name: ship.name,
//               lat: ship.lat,
//               lng: ship.lng,
//             } as ShipInfo);
//           }
//         }}
//       />

//       <ShipInfoPanel
//         open={shipPanelOpen}
//         onClose={closeShipInfoPanel}
//         ship={selectedShip}
//         width={SHIP_PANEL_WIDTH}
//       />

//       <ShipActivityPanel
//         open={activityPanelOpen}
//         onClose={() => setActivityPanelOpen(false)}
//         shipIds={activityShipIds}
//         width={PANEL_WIDTH}
//       />
//     </div>
//   );
// }



'use client';

import { useCallback, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/ui/pinput';
import { Button } from '@/components/ui/button';
import { ArrowUp, Loader2, MapPin, Globe as GlobeIcon, Map as MapIcon, Layers, X } from 'lucide-react';
import CommandNavbar from './navbar';
import ShipDependabilityPanel, { ShipCandidate } from './Shipdependabilitypanel';
import ShipInfoPanel, { ShipInfo } from '@/components/ship_panel/shipPanel';
import {
  CANDIDATE_SHIP_COUNT,
  extractCoordinatesFromText,
  getNearestShips,
  GlobeMapProps,
  KNOWN_WATER_BODIES,
  PANEL_WIDTH,
  parseCoordinateString,
  SHIP_PANEL_WIDTH,
} from '@/lib/globe';
import { useGlobeMapEngine } from '@/hooks/Useglobemapengine';
import { parseShipActivityQuery } from '@/lib/shipActivity';
import ShipActivityPanel from './globe/views/ShipActivityPanel';

import eightShip from "./eightShip.json";
import GraphCanvas from './GraphCanvas';

// Phrases that should open the full knowledge-graph overlay instead of
// being treated as a place/coordinate/ship-activity search.
const KG_TRIGGERS = ['show complete knowledge graph', 'full graph', 'show graph', 'load graph', 'graph'];

function isKnowledgeGraphQuery(raw: string): boolean {
  const val = raw.trim().toLowerCase();
  if (!val) return false;
  return KG_TRIGGERS.some(t => val === t || val.includes(t));
}

export default function GlobeMap({
  initialCenter = [77.209, 28.6139],
  initialZoom = 1.8,
  showGrid = true,
}: GlobeMapProps) {
  type SavedPin = { id: string; lat: number; lng: number; savedAt: number };
  const [savedPins, setSavedPins] = useState<SavedPin[]>([]);
  const savedMarkersRefState = useState<Map<string, maplibregl.Marker>>(new Map())[0];

  // Ship-dependability split panel
  const [panelOpen, setPanelOpen] = useState(false);
  const [candidateShips, setCandidateShips] = useState<ShipCandidate[]>([]);
  const [incidentCoords, setIncidentCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Per-ship info split panel
  const [shipPanelOpen, setShipPanelOpen] = useState(false);
  const [selectedShip, setSelectedShip] = useState<ShipInfo | null>(null);

  // Prompt-style location search/jump input
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Ship activity tracking panels
  const [activityPanelOpen, setActivityPanelOpen] = useState(false);
  const [activityShipIds, setActivityShipIds] = useState<string[]>([]);

  // Full knowledge-graph overlay (WholeKG)
  const [kgPanelOpen, setKgPanelOpen] = useState(false);

  // Track all possible side panel / overlay visibility settings
  const anyPanelOpen = panelOpen || shipPanelOpen || activityPanelOpen || kgPanelOpen;

  // Compute right offset for the map container based on which panel is open.
  // ShipInfoPanel wins if multiple are somehow open simultaneously.
  const activePanelWidth = shipPanelOpen
    ? SHIP_PANEL_WIDTH
    : panelOpen || activityPanelOpen
    ? PANEL_WIDTH
    : 0;

  const openShipInfoPanel = useCallback((ship: ShipInfo) => {
    setSelectedShip(ship);
    setPanelOpen(false);
    setShipPanelOpen(true);
  }, []);
  const {
    containerRef,
    mapRef,
    searchMarkerRef,
    mapReady,
    basemap,
    cycleBasemap,
    projection,
    setProjection,
    pointerInfo,
    showPointInfo,
    pointStyle,
    closePointInfo,
  } = useGlobeMapEngine({ initialCenter, initialZoom, showGrid, onShipClick: openShipInfoPanel });

  // Resize the MapLibre canvas after the panel slide transition completes (300 ms).
  // This ensures MapLibre occupies the correct visible area and re-centers properly.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const t = setTimeout(() => map.resize(), 310);
    return () => clearTimeout(t);
  }, [activePanelWidth, mapReady, mapRef]);

  const closeShipInfoPanel = useCallback(() => {
    setShipPanelOpen(false);
  }, []);

  const closeKgPanel = useCallback(() => {
    setKgPanelOpen(false);
  }, []);

  const savePin = useCallback((lat: number, lng: number) => {
    const id = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
    setSavedPins((prev) => (prev.some((p) => p.id === id) ? prev : [...prev, { id, lat, lng, savedAt: Date.now() }]));
  }, []);

  const removePin = useCallback((id: string) => {
    setSavedPins((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Expose savePin to the raw-HTML popup buttons
  useEffect(() => {
    (window as any).__saveGlobePin = savePin;
    return () => {
      delete (window as any).__saveGlobePin;
    };
  }, [savePin]);

  // Sync savedPins state -> red pinpoint markers on the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const currentIds = new Set(savedPins.map((p) => p.id));

    savedMarkersRefState.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        savedMarkersRefState.delete(id);
      }
    });

    savedPins.forEach((pin) => {
      if (savedMarkersRefState.has(pin.id)) return;
      const marker = new maplibregl.Marker({ color: '#DC2626' })
        .setLngLat([pin.lng, pin.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 12 }).setHTML(`
            <div style="${pointStyle}">
              <div style="font-weight:700;font-size:12px;letter-spacing:0.06em;color:#DC2626;margin-bottom:6px;">
                SAVED PINPOINT
              </div>
              <div style="font-size:11px;color:#444;line-height:1.5;">
                LAT &nbsp;${pin.lat.toFixed(4)}<br/>
                LNG &nbsp;${pin.lng.toFixed(4)}
              </div>
            </div>
          `)
        )
        .addTo(map);
      savedMarkersRefState.set(pin.id, marker);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPins, mapReady]);

  // Computes the nearest CANDIDATE_SHIP_COUNT ship stations to an incident position
  const openShipPanelForIncident = useCallback((lat: number, lng: number) => {
    setIncidentCoords({ lat, lng });
    setCandidateShips(getNearestShips(lat, lng, CANDIDATE_SHIP_COUNT));
    setShipPanelOpen(false);
    setPanelOpen(true);
  }, []);

  // Combined execution block handles normal queries and intercepting ship activity
  // lookups and full-knowledge-graph requests safely, before falling through to
  // coordinate parsing / place-name geocoding.
  const handleSearchSubmit = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !query.trim() || isSearching) return;

    setSearchError(null);

    // Intercept "show full graph" (and variants) — opens the WholeKG overlay
    // instead of running it through geocoding/coordinate parsing.
    if (isKnowledgeGraphQuery(query)) {
      setKgPanelOpen(true);
      setPanelOpen(false);
      setShipPanelOpen(false);
      setActivityPanelOpen(false);
      setQuery('');
      return;
    }

    // Intercept ship activity lookups here safely instead of breaking the render pipeline
    const shipIds = parseShipActivityQuery(query);
    if (shipIds) {
      setActivityShipIds(shipIds);
      setActivityPanelOpen(true);
      setPanelOpen(false);
      setShipPanelOpen(false);
      setKgPanelOpen(false);
      setQuery('');
      return;
    }

    const dropMarkerAndShowInfo = (lat: number, lng: number) => {
      searchMarkerRef.current?.remove();
      searchMarkerRef.current = new maplibregl.Marker({ color: '#DC2626' })
        .setLngLat([lng, lat])
        .addTo(map);
      showPointInfo(lat, lng);
    };

    const extracted = extractCoordinatesFromText(query);
    if (extracted) {
      map.flyTo({ center: [extracted.lng, extracted.lat], zoom: Math.max(map.getZoom(), 6), essential: true });
      map.once('moveend', () => dropMarkerAndShowInfo(extracted.lat, extracted.lng));
      openShipPanelForIncident(extracted.lat, extracted.lng);
      setQuery('');
      return;
    }

    const coords = parseCoordinateString(query);
    if (coords) {
      map.flyTo({ center: [coords.lng, coords.lat], zoom: Math.max(map.getZoom(), 6), essential: true });
      map.once('moveend', () => dropMarkerAndShowInfo(coords.lat, coords.lng));
      openShipPanelForIncident(coords.lat, coords.lng);
      setQuery('');
      return;
    }

    const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ');
    const known = KNOWN_WATER_BODIES[normalized];
    if (known) {
      map.flyTo({ center: [known.lng, known.lat], zoom: known.zoom ?? 5, essential: true });
      map.once('moveend', () => dropMarkerAndShowInfo(known.lat, known.lng));
      setQuery('');
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query.trim()
        )}&limit=8&addressdetails=0`
      );
      const results = await res.json();
      if (!results?.length) {
        setSearchError('No matching location');
        return;
      }

      const waterMatch = results.find((r: any) =>
        ['sea', 'bay', 'strait', 'water', 'natural'].includes(r.class) ||
        ['sea', 'bay', 'strait', 'ocean', 'gulf'].includes(r.type)
      );
      const preferred = waterMatch || results[0];

      const { lat, lon } = preferred;
      map.flyTo({ center: [Number(lon), Number(lat)], zoom: 6, essential: true });
      map.once('moveend', () => dropMarkerAndShowInfo(Number(lat), Number(lon)));
      setQuery('');
    } catch {
      setSearchError('Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [query, isSearching, showPointInfo, openShipPanelForIncident, mapRef, searchMarkerRef]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <div className="absolute top-0 left-0 right-0 z-20">
        <CommandNavbar />
      </div>

      {/* Map container — right edge pulls left by the active panel width so the
          map always fills only the visible area. The CSS transition matches the
          panel slide-in animation duration. */}
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          right: activePanelWidth,
          transition: 'right 300ms ease-in-out',
        }}
      />

      {/* Bottom-left control cluster — icon buttons + live coordinate readout */}
      <div
        className="absolute bottom-4 left-4 z-10 flex flex-col items-start gap-2 transition-all duration-300 ease-in-out"
      >
        <div className="flex gap-2">
          <button
            onClick={() => setProjection((p) => (p === 'globe' ? 'mercator' : 'globe'))}
            title={projection === 'globe' ? 'Switch to flat map' : 'Switch to globe'}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#150f28]/90 border border-violet-500/30 backdrop-blur-md shadow-[0_0_16px_rgba(139,92,246,0.25)] text-violet-300 hover:text-violet-100 hover:border-violet-400/70 transition-colors"
          >
            {projection === 'globe' ? <GlobeIcon className="size-4" /> : <MapIcon className="size-4" />}
          </button>
          <button
            onClick={cycleBasemap}
            title={`Basemap: ${basemap}`}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#150f28]/90 border border-emerald-500/30 backdrop-blur-md shadow-[0_0_16px_rgba(16,185,129,0.25)] text-emerald-300 hover:text-emerald-100 hover:border-emerald-400/70 transition-colors"
          >
            <Layers className="size-4" />
          </button>
        </div>

        <div className="px-3 py-1.5 rounded-lg bg-[#0c0818]/90 border border-violet-500/20 backdrop-blur-md font-mono text-[10px] tracking-wide text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.15)]">
          <span className="text-violet-400 font-semibold">COORD</span>{' '}
          {pointerInfo.lat.toFixed(4)}, {pointerInfo.lng.toFixed(4)}
          <span className="mx-2 text-violet-700">|</span>
          <span className="text-violet-400 font-semibold">Z</span> {pointerInfo.zoom.toFixed(1)}
        </div>
      </div>

      {/* Prompt-style location search — hidden when any panel is open */}
      {!anyPanelOpen && (
        <div className="absolute bottom-4 left-1/2 z-10 w-full max-w-[720px] px-4 flex flex-col items-center gap-1 -translate-x-1/2">
          <PromptInput
            value={query}
            onValueChange={(v) => {
              setQuery(v);
              if (searchError) setSearchError(null);
            }}
            isLoading={isSearching}
            onSubmit={handleSearchSubmit}
            className="bg-black text-white w-full shadow-lg"
          >
            <PromptInputTextarea placeholder='Search a place, lat, lng, DMS, paste a report, or type "show complete knowledge graph"…' />
            <PromptInputActions className="flex items-center justify-end pt-2">
              <PromptInputAction tooltip={isSearching ? 'Searching…' : 'Go to location'}>
                <Button
                  variant="default"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={handleSearchSubmit}
                  disabled={isSearching || !query.trim()}
                >
                  {isSearching ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowUp className="size-5" />
                  )}
                </Button>
              </PromptInputAction>
            </PromptInputActions>
          </PromptInput>
          {searchError && (
            <div className="flex items-center gap-1 text-[10px] text-red-600 bg-white px-2 py-0.5 rounded shadow-sm">
              <MapPin className="size-3" />
              {searchError}
            </div>
          )}
        </div>
      )}

      <ShipDependabilityPanel
        open={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          searchMarkerRef.current?.remove();
          searchMarkerRef.current = null;
          closePointInfo();
        }}
        ships={candidateShips}
        incident={incidentCoords}
        onOpenDashboard={(shipName) => {
          const ship = candidateShips.find((s) => s.name === shipName);
          if (ship) {
            openShipInfoPanel({
              name: ship.name,
              lat: ship.lat,
              lng: ship.lng,
            } as ShipInfo);
          }
        }}
      />

      <ShipInfoPanel
        open={shipPanelOpen}
        onClose={closeShipInfoPanel}
        ship={selectedShip}
        width={SHIP_PANEL_WIDTH}
      />

      <ShipActivityPanel
        open={activityPanelOpen}
        onClose={() => setActivityPanelOpen(false)}
        shipIds={activityShipIds}
        width={PANEL_WIDTH}
      />

      {/* Full knowledge-graph overlay — triggered by typing "show full graph"
          (or a close variant) into the Atlas prompt above. Renders WholeKG
          full-screen over the globe and auto-loads the graph data on open. */}
      {kgPanelOpen && (
        <div className="absolute inset-0 z-30 bg-[#0c0c10]">
          <button
            onClick={closeKgPanel}
            title="Close knowledge graph"
            className="absolute top-4 right-4 z-40 flex items-center justify-center w-9 h-9 rounded-xl bg-[#18181f]/90 border border-violet-500/30 backdrop-blur-md text-violet-300 hover:text-white hover:border-violet-400/70 transition-colors"
          >
            <X className="size-4" />
          </button>
          {/* <WholeKG autoLoad data={eightShip} /> */}
          <GraphCanvas graph={eightShip}/>
        </div>
      )}
    </div>
  );
}