import { ShipInfo } from "@/components/ship_panel/shipPanel";
import { ShipCandidate } from "@/components/Shipdependabilitypanel";
import maplibregl from "maplibre-gl";
import { useRef, useState, useEffect, useCallback } from "react";

export interface GlobeMapProps {
  initialCenter?: [number, number]; // [lng, lat]
  initialZoom?: number;
  showGrid?: boolean;
}

export type BasemapKey = 'light' | 'dark' | 'satellite';
export type ProjectionKey = 'globe' | 'mercator';

// Order the single basemap button cycles through on each click
export const BASEMAP_CYCLE: BasemapKey[] = ['light', 'dark', 'satellite'];

// Width (px) of the split panels (ship-dependability panel AND the
// per-ship info panel) — used both by the panels themselves and here to
// shrink the map when either panel is open.
export const PANEL_WIDTH = 420;
export const SHIP_PANEL_WIDTH = 720;

// How many of the nearest ship stations to surface in the split panel
// when an incident position is submitted.
export const CANDIDATE_SHIP_COUNT = 8;

export const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

export const BASEMAPS: Record<BasemapKey, string | maplibregl.StyleSpecification> = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  satellite: {
    version: 8,
    sources: {
      'esri-satellite': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        // attribution: 'Esri, Maxar, Earthstar Geographics',
      },
      'esri-labels': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        // attribution: 'Esri',
      },
    },
    layers: [
      { id: 'esri-satellite-layer', type: 'raster', source: 'esri-satellite' },
      { id: 'esri-labels-layer', type: 'raster', source: 'esri-labels' },
    ],
  } as maplibregl.StyleSpecification,
};

export function idSafe(s: any): string {
  return String(s ?? '').replace(/[^a-zA-Z0-9_.\-]/g, '');
}

// 8 notional ship stations surrounding India (Arabian Sea, Lakshadweep Sea,
// southern Indian Ocean, Bay of Bengal, Andaman Sea)
export const SHIP_LOCATIONS: { name: string; lat: number; lng: number }[] = [
  { name: 'INS KOLKATA', lat: 18.5, lng: 70.0 }, // Arabian Sea, west of Mumbai
  { name: 'INS CHENNAI', lat: 22.0, lng: 68.0 }, // Arabian Sea, off Gulf of Kutch
  { name: 'INS TUSHIL', lat: 11.0, lng: 71.5 }, // Lakshadweep Sea
  { name: 'INS TABAR', lat: 6.0, lng: 77.0 }, // Indian Ocean, south of Kanyakumari
  { name: 'INS SARYU', lat: 8.5, lng: 81.5 }, // Bay of Bengal, south of Sri Lanka
  { name: 'INS IMPHAL', lat: 12.5, lng: 83.0 }, // Bay of Bengal, off Chennai
  { name: 'INS VISAKHAPATNAM', lat: 18.0, lng: 87.5 }, // Bay of Bengal, off Visakhapatnam
  { name: 'INS TAMAL', lat: 11.5, lng: 93.0 }, // Andaman Sea
];

// Top ~30 Indian ports plus the world's biggest container/cargo hubs
// elsewhere, so the port layer isn't India-only. Coordinates are the
// port/harbour location itself, not the city centroid.
export type PortStatus = 'Friendly' | 'Adversary' | 'Self';

export const PORT_LOCATIONS: {
  name: string;
  lat: number;
  lng: number;
  country: string;
  category: 'Major Port' | 'Minor/Intermediate Port';
  portStatus: PortStatus;
}[] = [
  // India — Self (own borders)
  { name: 'Mumbai Port', lat: 18.9388, lng: 72.8354, country: 'India (Maharashtra)', category: 'Major Port', portStatus: 'Self' },
  { name: 'Jawaharlal Nehru Port (JNPT)', lat: 18.9490, lng: 72.9525, country: 'India (Maharashtra)', category: 'Major Port', portStatus: 'Self' },
  { name: 'Deendayal Port (Kandla)', lat: 23.0333, lng: 70.2167, country: 'India (Gujarat)', category: 'Major Port', portStatus: 'Self' },
  { name: 'Mormugao Port', lat: 15.4090, lng: 73.8020, country: 'India (Goa)', category: 'Major Port', portStatus: 'Self' },
  { name: 'New Mangalore Port', lat: 12.9186, lng: 74.8025, country: 'India (Karnataka)', category: 'Major Port', portStatus: 'Self' },
  { name: 'Cochin Port', lat: 9.9667, lng: 76.2667, country: 'India (Kerala)', category: 'Major Port', portStatus: 'Self' },
  { name: 'V.O. Chidambaranar Port (Tuticorin)', lat: 8.7642, lng: 78.2100, country: 'India (Tamil Nadu)', category: 'Major Port', portStatus: 'Self' },
  { name: 'Chennai Port', lat: 13.0975, lng: 80.2929, country: 'India (Tamil Nadu)', category: 'Major Port', portStatus: 'Self' },
  { name: 'Kamarajar Port (Ennore)', lat: 13.2333, lng: 80.3333, country: 'India (Tamil Nadu)', category: 'Major Port', portStatus: 'Self' },
  { name: 'Visakhapatnam Port', lat: 17.6868, lng: 83.2185, country: 'India (Andhra Pradesh)', category: 'Major Port', portStatus: 'Self' },
  { name: 'Paradip Port', lat: 20.3167, lng: 86.6167, country: 'India (Odisha)', category: 'Major Port', portStatus: 'Self' },
  { name: 'Kolkata Port', lat: 22.5697, lng: 88.3131, country: 'India (West Bengal)', category: 'Major Port', portStatus: 'Self' },

  // China — Adversary
  { name: 'Port of Shanghai', lat: 31.3300, lng: 121.6900, country: 'China', category: 'Major Port', portStatus: 'Adversary' },
  { name: 'Ningbo-Zhoushan Port', lat: 29.8683, lng: 121.9500, country: 'China', category: 'Major Port', portStatus: 'Adversary' },
  { name: 'Port of Shenzhen', lat: 22.5000, lng: 114.0500, country: 'China', category: 'Major Port', portStatus: 'Adversary' },
  { name: 'Port of Guangzhou', lat: 23.1000, lng: 113.4500, country: 'China', category: 'Major Port', portStatus: 'Adversary' },
  { name: 'Port of Qingdao', lat: 36.0800, lng: 120.3200, country: 'China', category: 'Major Port', portStatus: 'Adversary' },
  { name: 'Port of Tianjin', lat: 38.9800, lng: 117.7300, country: 'China', category: 'Major Port', portStatus: 'Adversary' },
  { name: 'Port of Hong Kong', lat: 22.2900, lng: 114.1700, country: 'Hong Kong', category: 'Major Port', portStatus: 'Adversary' },
  { name: 'Port of Xiamen', lat: 24.4500, lng: 118.0800, country: 'China', category: 'Major Port', portStatus: 'Adversary' },

  // Friendly — partner/allied nations
  { name: 'Port of Singapore', lat: 1.2650, lng: 103.8200, country: 'Singapore', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of Busan', lat: 35.0951, lng: 129.0756, country: 'South Korea', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of Kaohsiung', lat: 22.6100, lng: 120.2800, country: 'Taiwan', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of Yokohama', lat: 35.4437, lng: 139.6380, country: 'Japan', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port Klang', lat: 3.0000, lng: 101.4000, country: 'Malaysia', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Tanjung Pelepas Port', lat: 1.3667, lng: 103.5500, country: 'Malaysia', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Laem Chabang Port', lat: 13.0827, lng: 100.8833, country: 'Thailand', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Tanjung Priok Port (Jakarta)', lat: -6.1050, lng: 106.8800, country: 'Indonesia', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of Colombo', lat: 6.9497, lng: 79.8420, country: 'Sri Lanka', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of Chittagong', lat: 22.3300, lng: 91.8000, country: 'Bangladesh', category: 'Major Port', portStatus: 'Adversary' },
  { name: 'Jebel Ali Port', lat: 25.0100, lng: 55.0600, country: 'UAE', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of Salalah', lat: 16.9333, lng: 54.0000, country: 'Oman', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of Rotterdam', lat: 51.9500, lng: 4.1400, country: 'Netherlands', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of Antwerp-Bruges', lat: 51.2900, lng: 4.3400, country: 'Belgium', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of Hamburg', lat: 53.5400, lng: 9.9600, country: 'Germany', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of Felixstowe', lat: 51.9600, lng: 1.3500, country: 'United Kingdom', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of Piraeus', lat: 37.9400, lng: 23.6300, country: 'Greece', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of Valencia', lat: 39.4500, lng: -0.3200, country: 'Spain', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of Algeciras', lat: 36.1400, lng: -5.4400, country: 'Spain', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of Los Angeles', lat: 33.7300, lng: -118.2600, country: 'USA', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of Long Beach', lat: 33.7550, lng: -118.2100, country: 'USA', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of New York and New Jersey', lat: 40.6700, lng: -74.1200, country: 'USA', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of Vancouver', lat: 49.2900, lng: -123.1100, country: 'Canada', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of Balboa (Panama)', lat: 8.9500, lng: -79.5667, country: 'Panama', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of Santos', lat: -23.9600, lng: -46.3300, country: 'Brazil', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of Buenos Aires', lat: -34.6000, lng: -58.3667, country: 'Argentina', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of Durban', lat: -29.8700, lng: 31.0400, country: 'South Africa', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of Mombasa', lat: -4.0500, lng: 39.6667, country: 'Kenya', category: 'Major Port', portStatus: 'Friendly' },
  { name: 'Port of Sydney (Botany Bay)', lat: -33.9700, lng: 151.2100, country: 'Australia', category: 'Major Port', portStatus: 'Friendly' },

  // Adversary
  { name: 'Port of Karachi', lat: 24.8100, lng: 66.9700, country: 'Pakistan', category: 'Major Port', portStatus: 'Adversary' },
  { name: 'Bandar Abbas Port', lat: 27.1500, lng: 56.2500, country: 'Iran', category: 'Major Port', portStatus: 'Adversary' },
];

// Common seas/oceans/bays/straits — geocoders rank these poorly against
// small towns or businesses that happen to share the same name, so we
// resolve well-known ones locally before ever hitting Nominatim.
export const KNOWN_WATER_BODIES: Record<string, { lat: number; lng: number; zoom?: number }> = {
  'bay of bengal': { lat: 15.0, lng: 88.0, zoom: 5 },
  'arabian sea': { lat: 15.0, lng: 65.0, zoom: 5 },
  'indian ocean': { lat: -20.0, lng: 75.0, zoom: 3 },
  'andaman sea': { lat: 11.0, lng: 95.0, zoom: 6 },
  'laccadive sea': { lat: 8.0, lng: 73.0, zoom: 5 },
  'lakshadweep sea': { lat: 8.0, lng: 73.0, zoom: 5 },
  'south china sea': { lat: 12.0, lng: 113.0, zoom: 4 },
  'persian gulf': { lat: 26.5, lng: 52.0, zoom: 6 },
  'gulf of oman': { lat: 24.8, lng: 58.5, zoom: 6 },
  'gulf of kutch': { lat: 22.5, lng: 69.5, zoom: 7 },
  'gulf of mannar': { lat: 8.8, lng: 79.0, zoom: 7 },
  'red sea': { lat: 20.0, lng: 38.0, zoom: 5 },
  'pacific ocean': { lat: 0.0, lng: -160.0, zoom: 2 },
  'atlantic ocean': { lat: 10.0, lng: -40.0, zoom: 2 },
  'mediterranean sea': { lat: 35.0, lng: 18.0, zoom: 4 },
  'south atlantic ocean': { lat: -30.0, lng: -15.0, zoom: 3 },
  'bering sea': { lat: 58.0, lng: -178.0, zoom: 4 },
  'caribbean sea': { lat: 15.0, lng: -75.0, zoom: 4 },
};

// Inline pin icon (lucide "map-pin" style) for use inside raw popup HTML strings
export const PIN_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

// Clean naval ship glyph (bow/hull silhouette) for ship station markers
export const SHIP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.5 0 2.5 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
  <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>
  <path d="M19 13V7a2 2 0 0 0-2-2h-3"/>
  <path d="M12 10V4"/>
  <path d="M3 13.4V9.5l9-3.4 9 3.4"/>
</svg>`;

// Lucide "anchor" glyph for port markers
export const ANCHOR_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="5" r="3"/>
  <line x1="12" x2="12" y1="22" y2="8"/>
  <path d="M5 12H2a10 10 0 0 0 20 0h-3"/>
</svg>`;

function dmsToDecimal(deg: number, min: number, sec: number, dir?: string): number {
  let dec = deg + min / 60 + sec / 3600;
  if (dir === 'S' || dir === 'W') dec = -dec;
  return dec;
}

// Matches one DMS token, direction letter optional on either side, with
// degree/minute/second symbols tolerant of straight/curly quotes and typos
// (e.g. missing closing " on seconds). Examples it accepts:
//   N 10°42'28.6"   10°42'28.6"N   N10 42 28.6   92°57'19.4
export const DMS_TOKEN_RE =
  /([NSEW])?\s*(\d{1,3}(?:\.\d+)?)\s*(?:°|º|deg\.?)?\s*(?:(\d{1,2}(?:\.\d+)?)\s*(?:'|′|m|min\.?))?\s*(?:(\d{1,2}(?:\.\d+)?)\s*(?:"|″|s|sec\.?)?)?\s*([NSEW])?/gi;

// Parses "N 10°42'28.6" E 92°57'19.4" style input (and plain "lat, lng"
// decimal as a fallback). Returns null if it can't make sense of it.
// Intended for inputs that ARE a coordinate pair (nothing else in the
// string) — for coordinates embedded inside a longer passage of prose,
// use extractCoordinatesFromText instead.
export function parseCoordinateString(input: string): { lat: number; lng: number } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Fast path: plain decimal "lat, lng"
  const decimalParts = trimmed.replace(/;/g, ',').split(/[,\s]+/).filter(Boolean);
  if (
    decimalParts.length === 2 &&
    !Number.isNaN(Number(decimalParts[0])) &&
    !Number.isNaN(Number(decimalParts[1]))
  ) {
    const lat = Number(decimalParts[0]);
    const lng = Number(decimalParts[1]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }

  // DMS path
  const matches = [...trimmed.matchAll(DMS_TOKEN_RE)].filter((m) => m[2] !== undefined);
  if (matches.length < 2) return null;

  const parsed = matches.slice(0, 2).map((m) => {
    const dir = (m[1] || m[5] || '').toUpperCase();
    const deg = Number(m[2]) || 0;
    const min = Number(m[3]) || 0;
    const sec = Number(m[4]) || 0;
    return { dir, value: dmsToDecimal(deg, min, sec, dir) };
  });

  let latEntry = parsed.find((p) => p.dir === 'N' || p.dir === 'S');
  let lngEntry = parsed.find((p) => p.dir === 'E' || p.dir === 'W');

  // No direction letters at all — assume input order is lat, lng
  if (!latEntry && !lngEntry) {
    latEntry = parsed[0];
    lngEntry = parsed[1];
  } else if (!latEntry || !lngEntry) {
    // Only one had a direction letter — assign the other by elimination
    const remaining = parsed.find((p) => p !== latEntry && p !== lngEntry);
    if (!latEntry && remaining) latEntry = remaining;
    if (!lngEntry && remaining) lngEntry = remaining;
  }

  if (!latEntry || !lngEntry) return null;

  const lat = latEntry.value;
  const lng = lngEntry.value;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
}

// Stricter than DMS_TOKEN_RE: for scanning free text we require the
// degree symbol to actually be present (mandatory, not optional), and
// minute/second groups must carry their own '/" mark. DMS_TOKEN_RE makes
// every symbol optional, which is fine when the *entire* input is known
// to be a coordinate (parseCoordinateString) but is dangerous inside a
// paragraph: a bare number with a stray nearby letter — "on 09 June",
// "June 2025" — can get misread as a direction + degree value. Requiring
// "°" as an anchor rules those out, since ordinary dates/times/counts in
// prose are never glued to a degree symbol.
export const FREE_TEXT_COORD_RE =
  /([NSEW])?\s*(\d{1,3}(?:\.\d+)?)\s*(?:°|º)\s*(?:(\d{1,2}(?:\.\d+)?)\s*(?:'|′)\s*)?(?:(\d{1,2}(?:\.\d+)?)\s*(?:"|″)\s*)?([NSEW])?/gi;

// Scans free-form text (intel reports, sitreps, pasted paragraphs, etc.)
// for a lat/lng pair by looking for numbers explicitly tagged with a
// degree symbol AND an N/S or E/W direction letter — in decimal-degree
// form ("10.2650°N") or DMS form ("10°42'28.6\"N"). If more than one
// N/S or E/W candidate is present, the first of each is used.
export function extractCoordinatesFromText(text: string): { lat: number; lng: number } | null {
  if (!text) return null;

  const matches = [...text.matchAll(FREE_TEXT_COORD_RE)].filter(
    (m) => m[2] !== undefined && (m[1] || m[5])
  );
  if (!matches.length) return null;

  const toEntry = (m: RegExpMatchArray) => {
    const dir = (m[1] || m[5] || '').toUpperCase();
    const deg = Number(m[2]) || 0;
    const min = Number(m[3]) || 0;
    const sec = Number(m[4]) || 0;
    return { dir, value: dmsToDecimal(deg, min, sec, dir) };
  };

  const entries = matches.map(toEntry);
  const latEntry = entries.find((e) => e.dir === 'N' || e.dir === 'S');
  const lngEntry = entries.find((e) => e.dir === 'E' || e.dir === 'W');
  if (!latEntry || !lngEntry) return null;

  const { value: lat } = latEntry;
  const { value: lng } = lngEntry;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
}

// Simplified Douglas sea-state scale from significant wave height (m)
export function classifySeaState(waveHeightM: number): { code: number; label: string } {
  if (waveHeightM < 0.1) return { code: 0, label: 'Calm (glassy)' };
  if (waveHeightM < 0.5) return { code: 1, label: 'Calm (rippled)' };
  if (waveHeightM < 1.25) return { code: 2, label: 'Smooth' };
  if (waveHeightM < 2.5) return { code: 3, label: 'Slight' };
  if (waveHeightM < 4) return { code: 4, label: 'Moderate' };
  if (waveHeightM < 6) return { code: 5, label: 'Rough' };
  if (waveHeightM < 9) return { code: 6, label: 'Very rough' };
  if (waveHeightM < 14) return { code: 7, label: 'High' };
  if (waveHeightM < 20) return { code: 8, label: 'Very high' };
  return { code: 9, label: 'Phenomenal' };
}

// Great-circle distance in nautical miles between two lat/lng points.
export function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R_NM = 3440.065;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R_NM * c;
}

// Ranks the fixed ship stations by distance from an incident position and
// returns the closest `count` of them, annotated with that distance.
export function getNearestShips(lat: number, lng: number, count: number): ShipCandidate[] {
  return [...SHIP_LOCATIONS]
    .map((s) => ({ ...s, distanceNm: haversineNm(lat, lng, s.lat, s.lng) }))
    .sort((a, b) => a.distanceNm - b.distanceNm)
    .slice(0, count);
}



export type WorkshopStatus = 'Available' | 'Busy' | 'Offline';
export type PortOperationalStatus = 'Operational' | 'Reduced Capacity' | 'Under Maintenance' | 'Closed';
export type SecurityLevel = 'Normal' | 'Elevated' | 'High' | 'Critical';
export type WeatherCondition = 'Clear' | 'Cloudy' | 'Rain' | 'Storm' | 'Fog' | 'Snow';

export interface PortFacilityStatus {
  operational: PortOperationalStatus;
  dryDocks: number;           // available count
  weather: WeatherCondition;
  securityLevel: SecurityLevel;
  gasTurbineWorkshop: WorkshopStatus;
  electricalWorkshop: WorkshopStatus;
  weaponCalibration: WorkshopStatus;
  radarTesting: WorkshopStatus;
}

// Seeded pseudo-random so status is stable per port (doesn't change on re-render)
function seededRand(seed: string, index: number): number {
  let h = index * 2654435761;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 2246822519);
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 0xffffffff;
}

function pick<T>(arr: T[], seed: string, idx: number): T {
  return arr[Math.floor(seededRand(seed, idx) * arr.length)];
}

export function getPortFacilityStatus(portName: string): PortFacilityStatus {
  const s = portName;
  return {
    operational:       pick(['Operational','Operational','Operational','Reduced Capacity','Under Maintenance','Closed'], s, 0),
    dryDocks:          Math.floor(seededRand(s, 1) * 5) + 1,
    weather:           pick(['Clear','Clear','Cloudy','Rain','Storm','Fog'], s, 2),
    securityLevel:     pick(['Normal','Normal','Elevated','High','Critical'], s, 3),
    gasTurbineWorkshop: pick(['Available','Available','Busy','Offline'], s, 4),
    electricalWorkshop: pick(['Available','Busy','Busy','Offline'], s, 5),
    weaponCalibration:  pick(['Available','Available','Busy','Offline'], s, 6),
    radarTesting:       pick(['Available','Busy','Busy','Offline'], s, 7),
  };
}