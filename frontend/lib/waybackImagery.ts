// ─── Wayback data layer ────────────────────────────────────────────────────
// Thin wrapper around @esri/wayback-core (the library behind Esri's own
// World Imagery Wayback app: https://livingatlas.arcgis.com/wayback/).
//
//   npm install @esri/wayback-core
//
// getWaybackItemsWithLocalChanges() is used instead of getWaybackItems() —
// it returns only the releases where the imagery at this exact point
// actually changed, which is what you want for a per-port timeline (the
// full archive has 150+ releases, most of which are pixel-identical at any
// given spot).

import {
  getWaybackItemsWithLocalChanges,
  getMetadata,
  type WaybackItem,
  type WaybackMetadata,
} from '@esri/wayback-core';
import { buildTileUrl, lonLatToTile, tileGridAround, TileCoord } from './map/historyMaps/tileMath';

export const WAYBACK_ZOOM = 17; // ~1.2 m/px — good port/dock-scale detail
const GRID_RADIUS = 1; // 1 => 3x3 tile grid for a wider stitched view

export interface HistoricalImageryEntry {
  id: number; // releaseNum, doubles as a stable React key
  date: string; // releaseDateLabel, e.g. "2023-12-07"
  releaseNum: number;
  itemTitle: string;
  layerIdentifier: string;
  centerTileUrl: string; // single tile, used for thumbnails / downloads
  gridTiles: string[]; // 3x3 stitched grid, row-major, for the main viewer
}

export interface PortLike {
  name: string;
  lat: number;
  lng: number;
}

export async function fetchHistoricalImagery(
  port: PortLike,
  zoom: number = WAYBACK_ZOOM,
  signal?: AbortSignal,
): Promise<HistoricalImageryEntry[]> {
  const items: WaybackItem[] = await getWaybackItemsWithLocalChanges(
    { longitude: port.lng, latitude: port.lat },
    zoom,
    { signal },
  );

  const centerTile = lonLatToTile(port.lng, port.lat, zoom);
  const grid = tileGridAround(centerTile, GRID_RADIUS);

  return items
    .sort((a, b) => b.releaseDatetime - a.releaseDatetime) // newest first
    .map((item) => ({
      id: item.releaseNum,
      date: item.releaseDateLabel,
      releaseNum: item.releaseNum,
      itemTitle: item.itemTitle,
      layerIdentifier: item.layerIdentifier,
      centerTileUrl: buildTileUrl(item.itemURL, zoom, centerTile),
      gridTiles: grid.map((tile: TileCoord) => buildTileUrl(item.itemURL, zoom, tile)),
    }));
}

export interface ResolvedMetadata extends WaybackMetadata {
  lat: number;
  lng: number;
}

const metadataCache = new Map<string, ResolvedMetadata>();

export async function fetchEntryMetadata(
  port: PortLike,
  entry: HistoricalImageryEntry,
  zoom: number = WAYBACK_ZOOM,
): Promise<ResolvedMetadata> {
  const cacheKey = `${port.lat.toFixed(5)},${port.lng.toFixed(5)}:${entry.releaseNum}:${zoom}`;
  const cached = metadataCache.get(cacheKey);
  if (cached) return cached;

  const metadata = await getMetadata(
    { longitude: port.lng, latitude: port.lat },
    zoom,
    entry.releaseNum,
  );

  const resolved: ResolvedMetadata = { ...metadata, lat: port.lat, lng: port.lng };
  metadataCache.set(cacheKey, resolved);
  return resolved;
}
