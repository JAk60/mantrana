// ─── Web Mercator tile math ────────────────────────────────────────────────
// Converts a lat/lng at a given zoom into the fractional XYZ tile coordinate,
// which Esri's Wayback tile URLs consume as {level}/{row}/{col} (row = y,
// col = x). Standard slippy-map formulas — same math Leaflet/Mapbox use.

export interface TileCoord {
  col: number; // x
  row: number; // y
}

export function lonLatToTile(lon: number, lat: number, zoom: number): TileCoord {
  const latRad = (lat * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  const x = ((lon + 180) / 360) * n;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { col: Math.floor(x), row: Math.floor(y) };
}

/**
 * Returns the coordinates for an NxN grid of tiles centered on the given
 * center tile, in row-major order (top-left to bottom-right). Used to
 * stitch a wider view than a single ~256px tile can show.
 */
export function tileGridAround(center: TileCoord, radius: number): TileCoord[] {
  const coords: TileCoord[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      coords.push({ col: center.col + dx, row: center.row + dy });
    }
  }
  return coords;
}

export function buildTileUrl(
  itemUrlTemplate: string,
  zoom: number,
  tile: TileCoord,
): string {
  return itemUrlTemplate
    .replace('{level}', String(zoom))
    .replace('{row}', String(tile.row))
    .replace('{col}', String(tile.col));
}
