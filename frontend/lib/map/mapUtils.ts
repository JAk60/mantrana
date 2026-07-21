import maplibregl from 'maplibre-gl';

// ─── Depth zone classifier ────────────────────────────────────────────────────

export function classifyDepth(depthM: number): { zone: string; color: string } {
  const abs = Math.abs(depthM);
  if (abs < 200)  return { zone: 'Continental Shelf', color: '#0077b6' };
  if (abs < 1000) return { zone: 'Continental Slope', color: '#023e8a' };
  if (abs < 4000) return { zone: 'Abyssal Plain',     color: '#03045e' };
  return               { zone: 'Deep Ocean Trench',   color: '#370617' };
}

// ─── GeoJSON source helper ────────────────────────────────────────────────────
// Safe to call multiple times — skips if source already registered.

export function addGeoJSONSource(
  map: maplibregl.Map,
  id: string,
  file: string,
  options: Partial<maplibregl.GeoJSONSourceSpecification> = {},
) {
  if (!map.getSource(id)) {
    map.addSource(id, {
      type: 'geojson',
      data: `/geojson/${file}`,
      generateId: true,
      ...options,
    });
  }
}

// ─── Grid spacing ─────────────────────────────────────────────────────────────

export function getGridSpacing(zoom: number): number {
  if (zoom > 11)  return 0.25;
  if (zoom > 8.5) return 0.5;
  if (zoom > 6.5) return 1;
  if (zoom > 5)   return 2.5;
  if (zoom > 3)   return 5;
  if (zoom > 2)   return 10;
  if (zoom > 1)   return 15;
  return 20;
}

// ─── Grid geometry builder ────────────────────────────────────────────────────
// Pure: takes the map only to read bounds and zoom, writes nothing to the map.

export function buildGridFeatures(map: maplibregl.Map): {
  minorLines: GeoJSON.Feature[];
  majorLines: GeoJSON.Feature[];
  points: GeoJSON.Feature[];
} {
  const zoom    = map.getZoom();
  const spacing = getGridSpacing(zoom);
  const bounds  = map.getBounds();
  const buffer  = spacing * 4;

  const south = Math.max(Math.floor((bounds.getSouth() - buffer) / spacing) * spacing, -80);
  const north = Math.min(Math.ceil( (bounds.getNorth() + buffer) / spacing) * spacing,  80);
  const west  = Math.max(Math.floor((bounds.getWest()  - buffer) / spacing) * spacing, -180);
  const east  = Math.min(Math.ceil( (bounds.getEast()  + buffer) / spacing) * spacing,  180);

  const minorLines: GeoJSON.Feature[] = [];
  const majorLines: GeoJSON.Feature[] = [];
  const points:     GeoJSON.Feature[] = [];

  for (let lat = south; lat <= north; lat += spacing) {
    const coords: [number, number][] = [];
    for (let lng = west; lng <= east; lng += 5) coords.push([lng, lat]);
    const isMajor = Math.abs(lat % (spacing * 5)) < 1e-6;
    (isMajor ? majorLines : minorLines).push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: { major: isMajor },
    });
  }

  for (let lng = west; lng <= east; lng += spacing) {
    const coords: [number, number][] = [];
    for (let lat = -85; lat <= 85; lat += 5) coords.push([lng, lat]);
    const isMajor = Math.abs(lng % (spacing * 5)) < 1e-6;
    (isMajor ? majorLines : minorLines).push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: { major: isMajor },
    });
  }

  const pointSpacing = zoom < 3 ? spacing : spacing * 1.5;
  for (let lat = south; lat <= north; lat += pointSpacing) {
    for (let lng = west; lng <= east; lng += pointSpacing) {
      points.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) },
      });
    }
  }

  return { minorLines, majorLines, points };
}
