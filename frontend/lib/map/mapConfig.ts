// ─── Map configuration — pure static data, no MapLibre or React imports ───────

export const RADIUS_NM = 50;

export const pointStyle = `
  background:#FFFFFF;
  color:#1A1A1A;
  border-radius:10px;
  padding:14px;
  font-family:ui-monospace, 'JetBrains Mono', monospace;
  border:1px solid #E2E4EA;
  box-shadow:0 8px 24px rgba(20,20,40,0.12);
`;

export const WEATHER_ICON: Record<string, string> = {
  Clear:  '☀️',
  Cloudy: '⛅',
  Rain:   '🌧️',
  Storm:  '⛈️',
  Fog:    '🌫️',
  Snow:   '❄️',
};

export const LIGHT_PALETTE = {
  ocean:               '#DCEBFA',
  oceanOpacity:        0.9,
  countryFill:         '#EFEFE9',
  countryOutline:      '#B9B9AE',
  coastline:           '#4A6FA5',
  indiaFill:           '#FDE9C8',
  indiaOutline:        '#B8860B',
  statesFill:          'transparent',
  statesOutline:       '#B8860B',
  statesOutlineOpacity: 0.5,
  labelColor:          '#1A1A2E',
  labelHalo:           'rgba(255,255,255,0.85)',
};

export const DARK_PALETTE = {
  ocean:               '#6B7280',
  oceanOpacity:        0.55,
  countryFill:         '#04070A',
  countryOutline:      '#4B5563',
  coastline:           '#4B5563',
  indiaFill:           '#04070A',
  indiaOutline:        '#4B5563',
  statesFill:          'transparent',
  statesOutline:       '#6B7280',
  statesOutlineOpacity: 0.4,
  labelColor:          '#E2E8F0',
  labelHalo:           'rgba(8,28,44,0.9)',
};

export type Palette = typeof DARK_PALETTE | typeof LIGHT_PALETTE;

export const SKY_DARK = {
  'sky-color':         '#081C2C',
  'sky-horizon-blend': 0.4,
  'horizon-color':     '#081C2C',
  'horizon-fog-blend': 0.8,
  'fog-color':         '#081C2C',
  'fog-ground-blend':  0.9,
};

export const SKY_LIGHT = {
  'sky-color':         '#e8f4fd',
  'sky-horizon-blend': 0.5,
  'horizon-color':     '#b8d8f0',
  'horizon-fog-blend': 0.5,
  'fog-color':         '#dfe9f5',
  'fog-ground-blend':  0.5,
};



export function haversineNm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3440.065; // Earth radius in nautical miles

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}