import maplibregl from 'maplibre-gl';
import { Palette } from './mapConfig';
import { addGeoJSONSource } from './mapUtils';

// ─── Base geographic layers ───────────────────────────────────────────────────
// Idempotent: safe to call after every style swap.
// Palette is passed in by the caller — no basemap detection here.

export function addBaseGeoLayers(map: maplibregl.Map, palette: Palette) {
  // 1. Ocean
  addGeoJSONSource(map, 'ocean-src', 'Ocean.geojson');
  if (!map.getLayer('ocean-fill')) {
    map.addLayer({
      id: 'ocean-fill', type: 'fill', source: 'ocean-src',
      paint: { 'fill-color': palette.ocean, 'fill-opacity': palette.oceanOpacity },
    });
  } else {
    map.setPaintProperty('ocean-fill', 'fill-color',   palette.ocean);
    map.setPaintProperty('ocean-fill', 'fill-opacity', palette.oceanOpacity);
  }

  // 2. Countries
  addGeoJSONSource(map, 'countries-src', 'countries.geojson');
  if (!map.getLayer('countries-fill')) {
    map.addLayer({
      id: 'countries-fill', type: 'fill', source: 'countries-src',
      paint: { 'fill-color': palette.countryFill, 'fill-opacity': 1 },
    });
  } else {
    map.setPaintProperty('countries-fill', 'fill-color', palette.countryFill);
  }
  if (!map.getLayer('countries-outline')) {
    map.addLayer({
      id: 'countries-outline', type: 'line', source: 'countries-src',
      paint: { 'line-color': palette.countryOutline, 'line-width': 0.4, 'line-opacity': 0.8 },
    });
  } else {
    map.setPaintProperty('countries-outline', 'line-color', palette.countryOutline);
  }

  // 3. Coastline
  addGeoJSONSource(map, 'coastline-src', 'Coastline.geojson');
  if (!map.getLayer('coastline-line')) {
    map.addLayer({
      id: 'coastline-line', type: 'line', source: 'coastline-src',
      paint: { 'line-color': palette.coastline, 'line-width': 0.4, 'line-opacity': 0.8 },
    });
  } else {
    map.setPaintProperty('coastline-line', 'line-color', palette.coastline);
  }

  // 4. India
  addGeoJSONSource(map, 'india-src', 'india.geojson');
  if (!map.getLayer('india-fill')) {
    map.addLayer({
      id: 'india-fill', type: 'fill', source: 'india-src',
      paint: { 'fill-color': palette.indiaFill, 'fill-opacity': 1 },
    });
  } else {
    map.setPaintProperty('india-fill', 'fill-color', palette.indiaFill);
  }
  if (!map.getLayer('india-outline')) {
    map.addLayer({
      id: 'india-outline', type: 'line', source: 'india-src',
      paint: { 'line-color': palette.indiaOutline, 'line-width': 0.4, 'line-opacity': 0.8 },
    });
  } else {
    map.setPaintProperty('india-outline', 'line-color', palette.indiaOutline);
  }

  // 5. States — minzoom 3 keeps feature count low at world scale
  if (!map.getSource('states-src')) {
    map.addSource('states-src', {
      type: 'geojson',
      data: '/geojson/states.geojson',
      generateId: true,
      buffer: 64,
      tolerance: 0.375,
    });
  }
  if (!map.getLayer('states-outline')) {
    map.addLayer({
      id: 'states-outline', type: 'line', source: 'states-src', minzoom: 3,
      paint: {
        'line-color':   palette.statesOutline,
        'line-width':   ['interpolate', ['linear'], ['zoom'], 3, 0.3, 6, 0.8, 10, 1.2],
        'line-opacity': palette.statesOutlineOpacity,
      },
    });
  } else {
    map.setPaintProperty('states-outline', 'line-color',   palette.statesOutline);
    map.setPaintProperty('states-outline', 'line-opacity', palette.statesOutlineOpacity);
  }

  // 6. Country labels
  if (!map.getSource('country-labels-src')) {
    map.addSource('country-labels-src', {
      type: 'geojson',
      data: '/geojson/country_label_points.geojson',
    });
  }
  if (!map.getLayer('country-labels')) {
    map.addLayer({
      id: 'country-labels', type: 'symbol', source: 'country-labels-src',
      minzoom: 0.5, maxzoom: 10,
      filter: ['<=', ['get', 'min_label'], ['zoom']],
      layout: {
        'text-field':            ['get', 'name'],
        'text-font':             ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size':             ['interpolate', ['linear'], ['zoom'], 0, 8, 3, 10, 5, 12, 8, 14],
        'text-anchor':           'center',
        'text-allow-overlap':    false,
        'text-ignore-placement': false,
        'symbol-sort-key':       ['get', 'min_label'],
      },
      paint: {
        'text-color':      palette.labelColor,
        'text-halo-color': palette.labelHalo,
        'text-halo-width': 1.5,
        'text-halo-blur':  0.5,
        'text-opacity':    ['interpolate', ['linear'], ['zoom'], 0.5, 0, 1.5, 1],
      },
    });
  } else {
    map.setPaintProperty('country-labels', 'text-color',      palette.labelColor);
    map.setPaintProperty('country-labels', 'text-halo-color', palette.labelHalo);
  }

  // 7. State labels
  if (!map.getSource('state-labels-src')) {
    map.addSource('state-labels-src', {
      type: 'geojson',
      data: '/geojson/state_label_points.geojson',
    });
  }
  if (!map.getLayer('state-labels')) {
    map.addLayer({
      id: 'state-labels', type: 'symbol', source: 'state-labels-src',
      minzoom: 3, maxzoom: 14,
      filter: ['<=', ['get', 'min_label'], ['zoom']],
      layout: {
        'text-field':            ['get', 'name'],
        'text-font':             ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size':             ['interpolate', ['linear'], ['zoom'], 3, 8, 6, 10, 9, 12],
        'text-anchor':           'center',
        'text-allow-overlap':    false,
        'text-ignore-placement': false,
        'symbol-sort-key':       ['get', 'min_label'],
      },
      paint: {
        'text-color':      palette.labelColor,
        'text-halo-color': palette.labelHalo,
        'text-halo-width': 1.2,
        'text-halo-blur':  0.5,
        'text-opacity':    ['interpolate', ['linear'], ['zoom'], 2.5, 0, 3.5, 0.85],
      },
    });
  } else {
    map.setPaintProperty('state-labels', 'text-color',      palette.labelColor);
    map.setPaintProperty('state-labels', 'text-halo-color', palette.labelHalo);
  }
}
