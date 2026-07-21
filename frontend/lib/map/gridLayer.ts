import maplibregl from 'maplibre-gl';
import { EMPTY_FC, ProjectionKey } from '@/lib/globe';
import { SKY_DARK, SKY_LIGHT } from './mapConfig';
import { BasemapKey } from '@/lib/globe';

// ─── Grid layer IDs ───────────────────────────────────────────────────────────
// Single source of truth — used in the hook for visibility toggling.

export const GRID_LAYER_IDS = [
  'grid-lines-minor-layer',
  'grid-lines-major-layer',
  'grid-points-layer',
  'grid-points-hit',
] as const;

// ─── Sky helper ───────────────────────────────────────────────────────────────

export function applySky(map: maplibregl.Map, basemap: BasemapKey) {
  // @ts-ignore — setSky is not in MapLibre's TS types yet
  map.setSky?.(basemap === 'dark' ? SKY_DARK : SKY_LIGHT);
}

// ─── Grid source + layer registration ────────────────────────────────────────
// Idempotent — safe to call after every style swap.

export function initGridLayers(
  map: maplibregl.Map,
  projection: ProjectionKey,
  basemap: BasemapKey,
  gridOn: boolean,
) {
  if (!map.getSource('grid-lines-minor')) map.addSource('grid-lines-minor', { type: 'geojson', data: EMPTY_FC });
  if (!map.getSource('grid-lines-major')) map.addSource('grid-lines-major', { type: 'geojson', data: EMPTY_FC });
  if (!map.getSource('grid-points'))      map.addSource('grid-points',      { type: 'geojson', data: EMPTY_FC });

  if (!map.getLayer('grid-lines-minor-layer')) {
    map.addLayer({
      id: 'grid-lines-minor-layer', type: 'line', source: 'grid-lines-minor',
      paint: { 'line-color': '#3949AB', 'line-width': 0.5, 'line-opacity': 0.2 },
    });
  }
  if (!map.getLayer('grid-lines-major-layer')) {
    map.addLayer({
      id: 'grid-lines-major-layer', type: 'line', source: 'grid-lines-major',
      paint: { 'line-color': '#3949AB', 'line-width': 1.1, 'line-opacity': 0.45 },
    });
  }
  if (!map.getLayer('grid-points-hit')) {
    map.addLayer({
      id: 'grid-points-hit', type: 'circle', source: 'grid-points',
      paint: {
        'circle-radius':  ['interpolate', ['linear'], ['zoom'], 0, 6, 10, 14],
        'circle-color':   '#3949AB',
        'circle-opacity': 0,
      },
    });
  }
  if (!map.getLayer('grid-points-layer')) {
    map.addLayer({
      id: 'grid-points-layer', type: 'circle', source: 'grid-points',
      paint: {
        'circle-radius':        ['interpolate', ['linear'], ['zoom'], 0, 1.5, 6, 4, 10, 6],
        'circle-color':         '#3949AB',
        'circle-opacity':       0.6,
        'circle-stroke-width':  1,
        'circle-stroke-color':  '#FFFFFF',
        'circle-stroke-opacity': 0.9,
      },
    });
  }

  // @ts-ignore
  map.setProjection?.({ type: projection });
  applySky(map, basemap);

  const vis = gridOn ? 'visible' : 'none';
  GRID_LAYER_IDS.forEach((id) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
  });
}
