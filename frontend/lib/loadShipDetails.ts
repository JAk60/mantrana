// lib/loadShipDetails.ts
// replaces ProConMetric for gaps
export interface GapMetric {
  metric: string;
  type?: 'warning' | 'critical';
  value?: number;
  unit?: string;
  status?: string; // only for type === 'warning'
}

export interface ProConMetric {
  metric: string;
  value: number;
  unit: string;
}

export type StrikeMap = Record<string, 'Yes' | 'No' | string>;

export interface ShipEnrichment {
  strike: StrikeMap;
  strengths: ProConMetric[];
  gaps: GapMetric[];
}

// "INS Two" -> "instwo", "INS Eight" -> "inseight"
function shipNameToSlug(name: string): string {
  const words = name.toLowerCase().split(/\s+/);
  // ["ins", "two"] -> "instwo"
  return words.join('');
}

// Map new ship IDs to legacy file names for backward compatibility
const LEGACY_SHIP_FILE_MAP: Record<string, string> = {
  'inskolkata': 'insone',
  'inschennai': 'instwo',
  'instushil': 'insthree',
  'instabar': 'insfour',
  'inssaryu': 'insfive',   // ← was 'inssaryu', name is actually SARYU
  'insimphal': 'inssix',
  'insvisakhapatnam': 'insseven',
  'instamal': 'inseight',  // ← was 'istamal' (typo) and name is TAMAL not TAMAL
};

function getShipFileSlug(shipId: string): string {
  return LEGACY_SHIP_FILE_MAP[shipId] ?? shipId;
}

const cache = new Map<string, ShipEnrichment>();

export async function fetchShipEnrichment(shipName: string): Promise<ShipEnrichment | null> {
  const slug = shipNameToSlug(shipName);
  if (cache.has(slug)) return cache.get(slug)!;
  try {
    const fileSlug = getShipFileSlug(slug);
    console.log(`[enrichShips] name="${shipName}" slug="${slug}" fileSlug="${fileSlug}"`); // ← add this
    const res = await fetch(`/ships/${fileSlug}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    const enrichment: ShipEnrichment = {
      strike: data.strike ?? {},
      strengths: data.strengths ?? [],
      gaps: data.gaps ?? [],
    };
    cache.set(slug, enrichment);
    return enrichment;
  } catch {
    return null;
  }
}

export async function enrichShips<T extends { name: string }>(
  ships: T[]
): Promise<(T & ShipEnrichment)[]> {
  return Promise.all(
    ships.map(async (ship) => {
      const enrichment = await fetchShipEnrichment(ship.name);
      return {
        ...ship,
        strike: enrichment?.strike ?? {},
        strengths: enrichment?.strengths ?? [],
        gaps: enrichment?.gaps ?? [],
      };
    })
  );
}