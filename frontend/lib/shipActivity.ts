const SHIP_ID_ALIASES: Record<string, string> = {
  // Old names (backward compatibility)
  'ins one': 'inskolkata', 'ins 1': 'inskolkata',
  'ins two': 'inschennai', 'ins 2': 'inschennai',
  'ins three': 'instushil', 'ins 3': 'instushil',
  'ins four': 'instabar', 'ins 4': 'instabar',
  'ins five': 'inssaryu', 'ins 5': 'inssaryu',
  'ins six': 'insimphal', 'ins 6': 'insimphal',
  'ins seven': 'insvisakhapatnam', 'ins 7': 'insvisakhapatnam',
  'ins eight': 'istamal', 'ins 8': 'istamal',
  // New names
  'ins kolkata': 'inskolkata', 'kolkata': 'inskolkata',
  'ins chennai': 'inschennai', 'chennai': 'inschennai',
  'ins tushil': 'instushil', 'tushil': 'instushil',
  'ins tabar': 'instabar', 'tabar': 'instabar',
  'ins saryu': 'inssaryu', 'saryu': 'inssaryu',
  'ins imphal': 'insimphal', 'imphal': 'insimphal',
  'ins visakhapatnam': 'insvisakhapatnam', 'visakhapatnam': 'insvisakhapatnam',
  'ins tamal': 'istamal', 'tamal': 'istamal',
};

export const SHIP_LABELS: Record<string, string> = {
  inskolkata: 'INS KOLKATA', inschennai: 'INS CHENNAI', instushil: 'INS TUSHIL', instabar: 'INS TABAR',
  inssaryu: 'INS SARYU', insimphal: 'INS IMPHAL', insvisakhapatnam: 'INS VISAKHAPATNAM', istamal: 'INS TAMAL',
};

// Triggers on "activity", "timeline", "history", "movements", "log"
const ACTIVITY_TRIGGER = /\b(activity|timeline|history|movements?|log)\b/i;

/**
 * "show me activity of ship kolkata" -> ['inskolkata']
 * "show me activity of ins one and chennai" -> ['inskolkata', 'inschennai']
 * returns null if the query isn't a ship-activity request
 */
export function parseShipActivityQuery(raw: string): string[] | null {
  const q = raw.toLowerCase().trim();
  if (!ACTIVITY_TRIGGER.test(q)) return null;

  const found: string[] = [];
  // Match both old format (ins one/two/etc) and new format (kolkata/chennai/etc)
  const oldFormatRe = /\bins[\s-]?(one|two|three|four|five|six|seven|eight|\d)\b/gi;
  const newFormatRe = /\b(kolkata|chennai|tushil|tabar|saryu|imphal|visakhapatnam|tamal)\b/gi;
  
  // Try old format first
  let m: RegExpExecArray | null;
  while ((m = oldFormatRe.exec(q)) !== null) {
    const key = `ins ${m[1]}`.toLowerCase();
    const id = SHIP_ID_ALIASES[key];
    if (id && !found.includes(id)) found.push(id);
  }
  
  // Then try new format
  while ((m = newFormatRe.exec(q)) !== null) {
    const key = m[1].toLowerCase();
    const id = SHIP_ID_ALIASES[key];
    if (id && !found.includes(id)) found.push(id);
  }
  return found.length > 0 ? found : null;
}

export type ShipTimelineEntry = {
  timestamp: string;
  location: string;
  baseLocation?: string;
  dockyard?: string;
  missionType?: string;
  companionUnits?: string[];
  coordinates?: string;
  log: string;
};

// Map new ship IDs to legacy file names for backward compatibility
const LEGACY_SHIP_FILE_MAP: Record<string, string> = {
  'inskolkata': 'insone',
  'inschennai': 'instwo',
  'instushil': 'insthree',
  'instabar': 'insfour',
  'inssaryu': 'insfive',
  'insimphal': 'inssix',
  'insvisakhapatnam': 'insseven',
  'instamal': 'inseight',
};

function getShipFileSlug(shipId: string): string {
  return LEGACY_SHIP_FILE_MAP[shipId] ?? shipId;
}

export async function fetchShipTimeline(shipId: string): Promise<ShipTimelineEntry[]> {
  const fileSlug = getShipFileSlug(shipId);
  const res = await fetch(`/ships/${fileSlug}.json`);
  if (!res.ok) throw new Error(`Failed to load timeline for ${shipId}`);
  const data = await res.json();
  return Object.entries(data.timeline as Record<string, Omit<ShipTimelineEntry, 'timestamp'>>)
    .map(([timestamp, entry]) => ({ timestamp, ...entry }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}