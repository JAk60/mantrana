import maplibregl from 'maplibre-gl';

// ─── LazyLayer type ───────────────────────────────────────────────────────────
// addFn is called exactly once (guarded by getSource in the hook).
// All subsequent toggles just flip visibility.

export type LazyLayer = {
  ids:      string[];
  sourceId: string;
  addFn:    () => void;
};

// ─── Bathymetry ───────────────────────────────────────────────────────────────

export function addBathyLayer(map: maplibregl.Map) {
  map.addSource('bathymetry-src', {
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    tileSize: 512,
    encoding: 'terrarium',
    minzoom: 0,
    maxzoom: 8,
    attribution: '© GEBCO / AWS Terrain Tiles',
  });

  map.addLayer({
    id: 'bathymetry-color',
    type: 'raster',
    source: 'bathymetry-src',
    maxzoom: 10,
    paint: {
      'raster-color': [
        'interpolate', ['linear'], ['raster-value'],
        -11000, '#03045e',
        -4000,  '#023e8a',
        -1000,  '#0077b6',
        -200,   '#48cae4',
        0,      '#caf0f8',
      ],
      'raster-color-range': [-11000, 0],
      'raster-opacity': 0.55,
    },
  }, 'ocean-fill');
}

export function makeBathyDescriptor(map: maplibregl.Map): LazyLayer {
  return {
    sourceId: 'bathymetry-src',
    ids:      ['bathymetry-color'],
    addFn:    () => addBathyLayer(map),
  };
}

// ─── EEZ ─────────────────────────────────────────────────────────────────────

export function addEezLayer(map: maplibregl.Map) {
  map.addSource('eez-src', {
    type: 'geojson',
    data: '/geojson/eez_v12.geojson',
    tolerance: 0.75,
    buffer: 32,
  });

  map.addLayer({
    id: 'eez-line', type: 'line', source: 'eez-src',
    minzoom: 1, maxzoom: 12,
    paint: {
      'line-color':     '#FFA000',
      'line-width':     ['interpolate', ['linear'], ['zoom'], 1, 0.5, 6, 1.2],
      'line-opacity':   0.65,
      'line-dasharray': [4, 3],
    },
  });

  map.addLayer({
    id: 'eez-label', type: 'symbol', source: 'eez-src',
    minzoom: 4, maxzoom: 10,
    layout: {
      'text-field':         ['coalesce', ['get', 'SOVEREIGN1'], ['get', 'TERRITORY1'], ''],
      'text-font':          ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-size':          10,
      'text-anchor':        'center',
      'text-allow-overlap': false,
      'symbol-placement':   'line-center',
    },
    paint: {
      'text-color':      '#FFA000',
      'text-halo-color': 'rgba(255,255,255,0.8)',
      'text-halo-width': 1,
      'text-opacity':    0.85,
    },
  });
}

export function makeEezDescriptor(map: maplibregl.Map): LazyLayer {
  return {
    sourceId: 'eez-src',
    ids:      ['eez-line', 'eez-label'],
    addFn:    () => addEezLayer(map),
  };
}

// ─── Isobaths ─────────────────────────────────────────────────────────────────

export function addIsobathsLayer(map: maplibregl.Map) {
  map.addSource('isobaths-src', {
    type: 'geojson',
    data: '/geojson/isobaths_200m.geojson',
    tolerance: 0.5,
    buffer: 16,
  });

  map.addLayer({
    id: 'isobaths-line', type: 'line', source: 'isobaths-src',
    minzoom: 3, maxzoom: 14,
    paint: {
      'line-color': [
        'step', ['get', 'depth'],
        '#90CAF9',
        200,  '#42A5F5',
        1000, '#1565C0',
        4000, '#0D47A1',
      ],
      'line-width':   ['interpolate', ['linear'], ['zoom'], 3, 0.4, 8, 1, 12, 1.5],
      'line-opacity': 0.55,
    },
  });

  map.addLayer({
    id: 'isobaths-label', type: 'symbol', source: 'isobaths-src',
    minzoom: 6, maxzoom: 14,
    layout: {
      'text-field':         ['concat', ['get', 'depth'], ' m'],
      'text-font':          ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-size':          9,
      'symbol-placement':   'line',
      'symbol-spacing':     300,
      'text-allow-overlap': false,
    },
    paint: {
      'text-color':      '#1565C0',
      'text-halo-color': 'rgba(255,255,255,0.75)',
      'text-halo-width': 1,
      'text-opacity':    0.8,
    },
  });
}

export function makeIsobathsDescriptor(map: maplibregl.Map): LazyLayer {
  return {
    sourceId: 'isobaths-src',
    ids:      ['isobaths-line', 'isobaths-label'],
    addFn:    () => addIsobathsLayer(map),
  };
}

// ─── Shipping lanes ───────────────────────────────────────────────────────────

export function addShippingLayer(map: maplibregl.Map) {
  map.addSource('shipping-src', {
    type: 'geojson',
    data: '/geojson/shipping_lanes.geojson',
    tolerance: 0.5,
    buffer: 16,
  });

  map.addLayer({
    id: 'shipping-lane-fill', type: 'fill', source: 'shipping-src',
    minzoom: 4, maxzoom: 14,
    paint: { 'fill-color': '#B0BEC5', 'fill-opacity': 0.12 },
  });

  map.addLayer({
    id: 'shipping-lane-line', type: 'line', source: 'shipping-src',
    minzoom: 4, maxzoom: 14,
    paint: {
      'line-color':   '#78909C',
      'line-width':   ['interpolate', ['linear'], ['zoom'], 4, 0.5, 10, 1.5],
      'line-opacity': 0.5,
    },
  });
}

export function makeShippingDescriptor(map: maplibregl.Map): LazyLayer {
  return {
    sourceId: 'shipping-src',
    ids:      ['shipping-lane-fill', 'shipping-lane-line'],
    addFn:    () => addShippingLayer(map),
  };
}
