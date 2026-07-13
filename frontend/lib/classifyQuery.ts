// ─── Ship registry ────────────────────────────────────────────────────────────
// Add all known ships here. Keys are lowercase aliases the user might type,
// values are the canonical id + name the backend expects.

const SHIP_REGISTRY: Array<{ aliases: string[]; ship_id: string; ship_name: string }> = [
  {
    aliases: ['ins kolkata', 'kolkata', 'inskolkata'],
    ship_id: 'd03d2f7e-01b0-4758-b482-c0d7fe2b0a6e',
    ship_name: 'INS KOLKATA',
  },
  {
    aliases: ['ins chennai', 'chennai', 'inschennai'],
    ship_id: 'c0ace891-e99a-4234-96c0-5e8d0855db60',
    ship_name: 'INS CHENNAI',
  },
  // Add more ships here as needed:
  // {
  //   aliases: ['ins tushil', 'tushil'],
  //   ship_id: '...',
  //   ship_name: 'INS TUSHIL',
  // },
];

// ─── /chat endpoint ship mapping ───────────────────────────────────────────────
// The /chat endpoint only accepts "ins one" and "ins two" formats.
// This mapping converts new ship names/IDs back to the old format for backward compatibility.
export const CHAT_ENDPOINT_SHIP_MAPPING: Record<string, string> = {
  // New ship name → old format (for /chat endpoint)
  'inskolkata': 'ins one',
  'ins kolkata': 'ins one',
  'kolkata': 'ins one',
  'inschennai': 'ins two',
  'ins chennai': 'ins two',
  'chennai': 'ins two',
  // Keep old formats as-is for backward compatibility
  'insone': 'ins one',
  'ins one': 'ins one',
  'instwo': 'ins two',
  'ins two': 'ins two',
};

/**
 * Transforms query string to /chat endpoint format by replacing new ship names
 * with the legacy "ins one"/"ins two" format that the backend /chat endpoint expects.
 */
export function transformQueryForChatEndpoint(query: string): string {
  let transformed = query.toLowerCase();
  // Sort by length (longest first) to avoid partial replacements
  const mappingEntries = Object.entries(CHAT_ENDPOINT_SHIP_MAPPING).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [newName, oldFormat] of mappingEntries) {
    const regex = new RegExp(`\\b${newName}\\b`, 'gi');
    transformed = transformed.replace(regex, oldFormat);
  }
  return transformed;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchedShip {
  ship_id: string;
  ship_name: string;
}

interface Classifier {
  intent: string;
  intents: string[];
  matched: string;
  signals: {
    matched_ships: MatchedShip[];
    has_multiple_ships: boolean;
    has_negation: boolean;
    has_comparison: boolean;
  };
}

// ─── classifyQuery ────────────────────────────────────────────────────────────

const KG_KEYWORDS = [
  'maintenance',
  'failure',
  'failure mode',
  'fault',
  'repair',
  'reliability',
  'command',
  'fleet',
  'ship',
  'system',
  'equipment', 'equipments',
  'assembly', 'assemblies',
  'subassembly', 'subassemblies',
  'symptom',
  'cause',
  'effect',
  'consequence',
  'decision',
  'risk',
  'downtime',
  'oem',
  'serial number',
  'equipment code',
  'clogging',
  'seizing',
  'leaking',
  'vibration',
  'pressure',
  'oil analysis',
  'visual inspection',
  'bearing wear',
  'impeller wear',
  'fuel contamination',
  'dust accumulation',
  'particle accumulation',
  'corrosion',
  'fatigue',
  'flow restriction',
  'reduced oil flow',
  'reduced air flow',
  'system shutdown',
  'predictive maintenance',
  'condition based',
  'time based maintenance',
  'cbm',
  'tbm',
  'mtbf',
  'mttr',
  'overhaul',
  'cost'
];



export function classifyQuery(query: string): Classifier {
  const q = query.toLowerCase();

  // ── Intent ──────────────────────────────────────────────────────────────────
  let intent = 'GENERAL';
  let matched = '';
if (q.includes('rul') || q.includes('remaining useful life')) {
  intent = 'RUL';
  matched = 'anchor:rul';
} else if (
  q.includes('sensor') ||
  q.includes('values') ||
  q.includes('readings') ||
  q.includes('show me values')
) {
  intent = 'SENSOR';
  matched = 'anchor:sensor_readings';
} else if (KG_KEYWORDS.some(keyword => q.includes(keyword))) {
  intent = 'KG';
  matched = 'anchor:kg_query';
}

  // ── Ship matching ────────────────────────────────────────────────────────────
  const matched_ships: MatchedShip[] = [];
  for (const ship of SHIP_REGISTRY) {
    if (ship.aliases.some(alias => q.includes(alias))) {
      matched_ships.push({ ship_id: ship.ship_id, ship_name: ship.ship_name });
    }
  }

  return {
    intent,
    intents: [intent],
    matched,
    signals: {
      matched_ships,
      has_multiple_ships: matched_ships.length > 1,
      has_negation: q.includes(" not ") || q.includes("n't") || q.includes("no "),
      has_comparison: q.includes("compar") || q.includes(" vs ") || q.includes(" versus "),
    },
  };
}