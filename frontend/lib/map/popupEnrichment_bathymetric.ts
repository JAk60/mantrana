// ─── 1. REVERSE GEOCODE — Nominatim (CORS-open) ───────────────────────────────

import { classifySeaState } from "../globe";

export async function fetchLocation(
  latR: number, lngR: number, elementId: string, signal: AbortSignal,
) {
  const el = document.getElementById(elementId);
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latR}&lon=${lngR}&zoom=10`,
      { signal, headers: { 'Accept-Language': 'en' } },
    );
    const j = await r.json();
    if (!el) return;
    const name = j?.display_name || null;
    if (!name) {
      el.innerHTML = `<span style="color:#9CA3AF;font-size:10px;">Open ocean — no named feature</span>`;
      return;
    }
    el.innerHTML = `<div style="font-size:10px;color:#374151;line-height:1.5;">${name}</div>`;
  } catch (e: any) {
    if (e.name === 'AbortError') return;
    if (el) el.innerHTML = `<span style="color:#9CA3AF;font-size:10px;">Location unavailable</span>`;
  }
}

// ─── 2. FULL BATHYMETRIC + NAVAL OCEAN PROFILE ───────────────────────────────
// Fetches in parallel:
//   • Copernicus DEM GLO-90 (via Open-Meteo elevation API) — seafloor depth
//   • Open-Meteo marine — SST, currents, waves
// Renders into depthId (depth + sound speed profile) and seabedId (water column layers)

export async function fetchBathymetricProfile(
  latR: number,
  lngR: number,
  depthId: string,
  seabedId: string,
  signal: AbortSignal,
) {
  const depthEl = document.getElementById(depthId);
  const seabedEl = document.getElementById(seabedId);

  try {
    const [elevRes, marineRes] = await Promise.allSettled([
      fetch(
        `https://api.odb.ntu.edu.tw/gebco?lon=${lngR}&lat=${latR}&mode=zonly`,
        { signal },
      ),
      fetch(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${latR}&longitude=${lngR}` +
        `&current=sea_surface_temperature,ocean_current_velocity,ocean_current_direction,` +
        `wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,` +
        `swell_wave_direction,sea_level_height_msl`,
        { signal },
      ),
    ]);

    let elevM: number | null = null;
    if (elevRes.status === 'fulfilled' && elevRes.value.ok) {
      const ej = await elevRes.value.json();
      elevM = Array.isArray(ej?.z) ? ej.z[0] : null;
      // ODB returns 0 for some ocean tiles — treat 0 as unknown, not land
      if (elevM === 0) elevM = null;
    }

    // ── Parse marine ─────────────────────────────────────────────────────────
    let marine: Record<string, number | null> = {};
    if (marineRes.status === 'fulfilled' && marineRes.value.ok) {
      const mj = await marineRes.value.json();
      marine = mj?.current ?? {};
    }

    const sst: number | null = marine.sea_surface_temperature ?? null;

    // ── On land ──────────────────────────────────────────────────────────────
    if (elevM !== null && elevM > 0) {
      if (depthEl) depthEl.innerHTML = `<span style="color:#9CA3AF;font-size:10px;">On land — no bathymetric data</span>`;
      if (seabedEl) seabedEl.innerHTML = `<span style="color:#9CA3AF;font-size:10px;">—</span>`;
      return;
    }

    const depthM = elevM !== null ? Math.abs(elevM) : null;

    // ── Depth zone classification ─────────────────────────────────────────────
    const zone = depthM !== null ? classifyDepthZone(depthM) : null;

    // ── Sound speed profile via Mackenzie (1981) ──────────────────────────────
    // Real SST at surface, physics-based temperature gradient below
    const surfaceT = sst ?? 20;
    const S = 35; // standard open-ocean salinity (PSU)

    function mackenzie(T: number, depth: number): number {
      const D = Math.min(depth, 8000);
      return Math.round(
        1448.96 + 4.591 * T - 5.304e-2 * T ** 2 + 2.374e-4 * T ** 3
        + 1.340 * (S - 35) + 1.630e-2 * D + 1.675e-7 * D ** 2
        - 1.025e-2 * T * (S - 35) - 7.139e-13 * T * D ** 3,
      );
    }

    // Temperature model: mixed layer → thermocline → deep isothermal
    function modelTemp(depth: number): number {
      if (depth <= 50) return surfaceT;
      if (depth <= 200) return surfaceT - ((depth - 50) / 150) * (surfaceT - 8);
      if (depth <= 800) return 8 - ((depth - 200) / 600) * (8 - 4);
      if (depth <= 4000) return 4 - ((depth - 800) / 3200) * 2;
      return 2;
    }

    const maxD = depthM ?? 5000;
    const sampleDepths = [0, 50, 100, 200, 300, 500, 800, 1000, 2000, 4000]
      .filter(d => d <= maxD);
    if (sampleDepths[sampleDepths.length - 1] < Math.round(maxD)) {
      sampleDepths.push(Math.round(maxD));
    }

    const profile = sampleDepths.map(d => ({
      depth: d,
      temp: parseFloat(modelTemp(d).toFixed(1)),
      speed: mackenzie(modelTemp(d), d),
    }));

    const soundSfc = mackenzie(surfaceT, 0);
    const soundBot = depthM !== null ? mackenzie(modelTemp(maxD), maxD) : null;
    const fathoms = depthM !== null ? Math.round(depthM * 0.546807) : null;

    // ── RENDER: DEPTH PANEL ───────────────────────────────────────────────────
    if (depthEl) {
      if (depthM !== null) {
        const { color, label } = zone!;

        const badges = [
          depthM < 200 ? `<span style="background:#FEF3C7;color:#92400E;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;margin-left:4px;">⚠ SHALLOW</span>` : '',
          depthM > 4000 ? `<span style="background:#EEF2FF;color:#3730A3;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;margin-left:4px;">ABYSSAL</span>` : '',
          depthM > 6000 ? `<span style="background:#1E1B4B;color:#C7D2FE;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;margin-left:4px;">HADAL</span>` : '',
        ].join('');

        depthEl.innerHTML = `
          <div style="font-weight:700;font-size:10px;letter-spacing:0.06em;color:${color};margin-bottom:7px;display:flex;align-items:center;flex-wrap:wrap;gap:2px;">
            🌊 DEPTH — ${label.toUpperCase()}${badges}
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:8px;">
            <div style="background:#EEF2FF;border-radius:5px;padding:6px 8px;">
              <div style="font-size:8px;font-weight:700;color:#6366F1;letter-spacing:0.07em;margin-bottom:1px;">DEPTH</div>
              <div style="font-size:13px;font-weight:700;color:#1E3A8A;">${depthM.toFixed(0)} m</div>
              <div style="font-size:9px;color:#6B7280;">${fathoms} fathoms</div>
            </div>
            <div style="background:#F0F9FF;border-radius:5px;padding:6px 8px;">
              <div style="font-size:8px;font-weight:700;color:#0284C7;letter-spacing:0.07em;margin-bottom:1px;">SEA SURFACE TEMP</div>
              <div style="font-size:13px;font-weight:700;color:#0369A1;">${sst !== null ? sst.toFixed(1) + ' °C' : 'N/A'}</div>
              <div style="font-size:9px;color:#6B7280;">live · ECMWF</div>
            </div>
            <div style="background:#F0FDF4;border-radius:5px;padding:6px 8px;">
              <div style="font-size:8px;font-weight:700;color:#15803D;letter-spacing:0.07em;margin-bottom:1px;">SOUND SPD · SURFACE</div>
              <div style="font-size:13px;font-weight:700;color:#065F46;">${soundSfc} m/s</div>
              <div style="font-size:9px;color:#6B7280;">sonar reference</div>
            </div>
            <div style="background:#F0FDF4;border-radius:5px;padding:6px 8px;">
              <div style="font-size:8px;font-weight:700;color:#15803D;letter-spacing:0.07em;margin-bottom:1px;">SOUND SPD · SEAFLOOR</div>
              <div style="font-size:13px;font-weight:700;color:#065F46;">${soundBot !== null ? soundBot + ' m/s' : '—'}</div>
              <div style="font-size:9px;color:#6B7280;">Mackenzie (1981)</div>
            </div>
          </div>

          <div style="margin-bottom:3px;">
            <div style="font-size:8px;font-weight:700;letter-spacing:0.07em;color:#374151;margin-bottom:5px;">ACOUSTIC PROFILE — SOUND SPEED vs DEPTH</div>
            ${renderSoundSpeedProfile(profile)}
          </div>
          <div style="font-size:8px;color:#9CA3AF;margin-top:3px;">src: Copernicus DEM GLO-90 via Open-Meteo · SST: MeteoFrance/ECMWF</div>`;
      } else {
        depthEl.innerHTML = `<span style="color:#9CA3AF;font-size:10px;">Depth data unavailable for this location</span>`;
      }
    }

    // ── RENDER: WATER COLUMN LAYERS ───────────────────────────────────────────
    if (seabedEl) {
      const layers = classifyWaterColumn(maxD, surfaceT);
      const sofarZone = sofarChannelNote(maxD);

      seabedEl.innerHTML = `
        <div style="font-weight:700;font-size:10px;letter-spacing:0.06em;color:#7C3AED;margin-bottom:7px;">
          🔵 NAVAL WATER COLUMN
        </div>
        ${layers.map(l => `
          <div style="display:flex;align-items:flex-start;gap:7px;padding:4px 0;border-bottom:1px solid #F3F4F6;">
            <div style="width:3px;align-self:stretch;background:${l.color};border-radius:2px;flex-shrink:0;"></div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:10px;font-weight:600;color:#111827;">${l.name}</div>
              <div style="font-size:9px;color:#6B7280;margin-top:1px;">${l.range}</div>
              <div style="font-size:9px;color:#9CA3AF;">${l.note}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-size:10px;font-weight:700;color:${l.color};">${l.temp}</div>
              <div style="font-size:8px;color:#9CA3AF;">${l.speed} m/s</div>
            </div>
          </div>`).join('')}
        ${sofarZone ? `
          <div style="margin-top:6px;padding:5px 7px;background:#FFFBEB;border-left:3px solid #F59E0B;border-radius:0 4px 4px 0;">
            <div style="font-size:9px;font-weight:700;color:#92400E;">⚡ SOFAR CHANNEL</div>
            <div style="font-size:9px;color:#B45309;margin-top:1px;">${sofarZone}</div>
          </div>` : ''}`;
    }

  } catch (e: any) {
    if (e.name === 'AbortError') return;
    const msg = `<span style="color:#9CA3AF;font-size:10px;">Data unavailable</span>`;
    if (depthEl) depthEl.innerHTML = msg;
    if (seabedEl) seabedEl.innerHTML = msg;
  }
}

// ─── 3. CURRENTS + TIDES (single combined fetch) ──────────────────────────────

export async function fetchCurrentsAndTides(
  latR: number,
  lngR: number,
  currentId: string,
  tideId: string,
  signal: AbortSignal,
) {
  const currentEl = document.getElementById(currentId);
  const tideEl = document.getElementById(tideId);

  try {
    const today = new Date().toISOString().split('T')[0];

    const [curRes, tideRes] = await Promise.allSettled([
      fetch(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${latR}&longitude=${lngR}` +
        `&current=ocean_current_velocity,ocean_current_direction`,
        { signal },
      ),
      fetch(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${latR}&longitude=${lngR}` +
        `&hourly=sea_level_height_msl&start_date=${today}&end_date=${today}&timezone=UTC`,
        { signal },
      ),
    ]);

    // ── Currents ──────────────────────────────────────────────────────────────
    if (currentEl) {
      if (curRes.status === 'fulfilled' && curRes.value.ok) {
        const cj = await curRes.value.json();
        const c = cj?.current;
        if (c?.ocean_current_velocity != null) {
          const kts = (c.ocean_current_velocity * 1.944).toFixed(1);
          const mps = c.ocean_current_velocity.toFixed(2);
          const dir = c.ocean_current_direction != null ? `${Math.round(c.ocean_current_direction)}°` : '—';
          const bear = compassBearing(c.ocean_current_direction);
          const spd = parseFloat(kts);
          const tactColor = spd > 2 ? '#DC2626' : spd > 0.5 ? '#EA580C' : '#16A34A';
          const tactNote = spd > 2
            ? '⚠ Strong — AUV/submarine ops significantly affected'
            : spd > 0.5
              ? 'Moderate — account for set and drift'
              : 'Weak — minimal navigational impact';

          currentEl.innerHTML = `
            <div style="font-weight:700;font-size:10px;letter-spacing:0.06em;color:#0284C7;margin-bottom:6px;">
              🌊 SURFACE CURRENT
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:5px;">
              <div style="background:#F0F9FF;border-radius:5px;padding:5px 8px;">
                <div style="font-size:8px;font-weight:700;color:#0284C7;letter-spacing:0.06em;margin-bottom:1px;">SPEED</div>
                <div style="font-size:13px;font-weight:700;color:#0369A1;">${kts} kt</div>
                <div style="font-size:9px;color:#6B7280;">${mps} m/s</div>
              </div>
              <div style="background:#F0F9FF;border-radius:5px;padding:5px 8px;">
                <div style="font-size:8px;font-weight:700;color:#0284C7;letter-spacing:0.06em;margin-bottom:1px;">DIRECTION</div>
                <div style="font-size:13px;font-weight:700;color:#0369A1;">${dir}</div>
                <div style="font-size:9px;color:#6B7280;">${bear}</div>
              </div>
            </div>
            <div style="font-size:9px;font-weight:600;color:${tactColor};padding:3px 6px;background:${tactColor}15;border-radius:4px;">${tactNote}</div>`;
        } else {
          currentEl.innerHTML = `<span style="color:#9CA3AF;font-size:10px;">Current data unavailable (inland or unsupported area)</span>`;
        }
      } else {
        currentEl.innerHTML = `<span style="color:#9CA3AF;font-size:10px;">Current lookup failed</span>`;
      }
    }

    // ── Tides ─────────────────────────────────────────────────────────────────
    if (tideEl) {
      if (tideRes.status === 'fulfilled' && tideRes.value.ok) {
        const tj = await tideRes.value.json();
        const hourly = tj?.hourly;
        if (hourly?.sea_level_height_msl?.length) {
          const nowH = new Date().getUTCHours();
          const all = hourly.sea_level_height_msl as (number | null)[];
          const levels = all.filter((v): v is number => v != null);
          const current = all[nowH] ?? levels[0];
          const prev = all[Math.max(0, nowH - 1)] ?? current;
          const trend = current > prev ? '↑ Rising' : current < prev ? '↓ Falling' : '→ Slack';
          const trendC = current > prev ? '#16A34A' : current < prev ? '#DC2626' : '#6B7280';
          const min = Math.min(...levels);
          const max = Math.max(...levels);
          const range = (max - min).toFixed(2);

          tideEl.innerHTML = `
            <div style="font-weight:700;font-size:10px;letter-spacing:0.06em;color:#0369A1;margin-bottom:6px;">
              🌊 TIDAL STATE
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:6px;">
              <div style="background:#F0F9FF;border-radius:5px;padding:5px 8px;">
                <div style="font-size:8px;font-weight:700;color:#0369A1;letter-spacing:0.06em;margin-bottom:1px;">SEA LEVEL</div>
                <div style="font-size:13px;font-weight:700;color:#0C4A6E;">${current?.toFixed(2)} m</div>
                <div style="font-size:9px;color:#6B7280;">above MSL</div>
              </div>
              <div style="background:#F0F9FF;border-radius:5px;padding:5px 8px;">
                <div style="font-size:8px;font-weight:700;color:#0369A1;letter-spacing:0.06em;margin-bottom:1px;">TREND</div>
                <div style="font-size:13px;font-weight:700;color:${trendC};">${trend}</div>
                <div style="font-size:9px;color:#6B7280;">range ${range} m</div>
              </div>
            </div>
            <div style="display:flex;align-items:flex-end;gap:6px;">
              <span style="font-size:9px;color:#6B7280;white-space:nowrap;">Lo ${min.toFixed(1)} m</span>
              ${renderTideSparkline(all, nowH)}
              <span style="font-size:9px;color:#6B7280;white-space:nowrap;">Hi ${max.toFixed(1)} m</span>
            </div>`;
        } else {
          tideEl.innerHTML = `<span style="color:#9CA3AF;font-size:10px;">Tidal data unavailable</span>`;
        }
      } else {
        tideEl.innerHTML = `<span style="color:#9CA3AF;font-size:10px;">Tidal data unavailable</span>`;
      }
    }

  } catch (e: any) {
    if (e.name === 'AbortError') return;
    if (currentEl) currentEl.innerHTML = `<span style="color:#9CA3AF;font-size:10px;">Unavailable</span>`;
    if (tideEl) tideEl.innerHTML = `<span style="color:#9CA3AF;font-size:10px;">Unavailable</span>`;
  }
}

// ─── 4. SEA STATE — Open-Meteo Marine ────────────────────────────────────────

export async function fetchSeaState(
  latR: number, lngR: number, elementId: string, signal: AbortSignal,
) {
  console.log("fetchSeaState called");

  try {
    console.log("Before fetch");

    const r = await fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${latR}&longitude=${lngR}` +
      `&current=wave_height,wave_period,wave_direction,swell_wave_height,` +
      `swell_wave_period,swell_wave_direction,sea_surface_temperature`,
      { signal },
    );

    console.log("Response:", r.status, r.ok);

    const text = await r.text();

    console.log("Raw response:", text);

    const j = JSON.parse(text);

    console.log("Parsed:", j);
    const el = document.getElementById(elementId);
    console.log("Sea element:", elementId, el);
    if (!el) return;

    const c = j?.current;
    if (!c || c.wave_height == null) {
      console.log("About to render sea state");
      el.innerHTML = `<span style="color:#9CA3AF;font-size:10px;">No marine data (likely inland)</span>`;
      return;
    }

    const { label, number: ssNum } = classifySeaState(c.wave_height);
    const ssColor = ssNum <= 2 ? '#16A34A' : ssNum <= 4 ? '#EA580C' : '#DC2626';
    const swellBear = compassBearing(c.swell_wave_direction);
    const waveBear = compassBearing(c.wave_direction);

    el.innerHTML = `
      <div style="font-weight:700;font-size:10px;letter-spacing:0.06em;color:${ssColor};margin-bottom:6px;">
        🌊 SEA STATE — SS${ssNum} ${label.toUpperCase()}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:4px;">
        <div style="background:#F0FDF4;border-radius:5px;padding:5px 8px;">
          <div style="font-size:8px;font-weight:700;color:#15803D;letter-spacing:0.06em;margin-bottom:1px;">WAVE HEIGHT</div>
          <div style="font-size:13px;font-weight:700;color:#065F46;">${c.wave_height} m</div>
          <div style="font-size:9px;color:#6B7280;">${c.wave_period != null ? c.wave_period + ' s period' : ''}</div>
        </div>
        <div style="background:#F0FDF4;border-radius:5px;padding:5px 8px;">
          <div style="font-size:8px;font-weight:700;color:#15803D;letter-spacing:0.06em;margin-bottom:1px;">WAVE DIR</div>
          <div style="font-size:13px;font-weight:700;color:#065F46;">${c.wave_direction != null ? Math.round(c.wave_direction) + '°' : '—'}</div>
          <div style="font-size:9px;color:#6B7280;">${waveBear}</div>
        </div>
        ${c.swell_wave_height != null ? `
        <div style="background:#ECFDF5;border-radius:5px;padding:5px 8px;">
          <div style="font-size:8px;font-weight:700;color:#047857;letter-spacing:0.06em;margin-bottom:1px;">SWELL HEIGHT</div>
          <div style="font-size:13px;font-weight:700;color:#047857;">${c.swell_wave_height} m</div>
          <div style="font-size:9px;color:#6B7280;">${c.swell_wave_period != null ? c.swell_wave_period + ' s' : ''}</div>
        </div>
        <div style="background:#ECFDF5;border-radius:5px;padding:5px 8px;">
          <div style="font-size:8px;font-weight:700;color:#047857;letter-spacing:0.06em;margin-bottom:1px;">SWELL DIR</div>
          <div style="font-size:13px;font-weight:700;color:#047857;">${c.swell_wave_direction != null ? Math.round(c.swell_wave_direction) + '°' : '—'}</div>
          <div style="font-size:9px;color:#6B7280;">${swellBear}</div>
        </div>` : ''}
        ${c.sea_surface_temperature != null ? `
        <div style="background:#FFF7ED;border-radius:5px;padding:5px 8px;grid-column:span 2;">
          <div style="font-size:8px;font-weight:700;color:#C2410C;letter-spacing:0.06em;margin-bottom:1px;">SEA SURFACE TEMP</div>
          <div style="font-size:13px;font-weight:700;color:#9A3412;">${c.sea_surface_temperature} °C</div>
        </div>` : ''}
      </div>`;
  } catch (e: any) {
  console.error("SEA STATE ERROR:", e);
}
}

// ─── Domain helpers ───────────────────────────────────────────────────────────

export function classifyDepthZone(depthM: number): { label: string; color: string } {
  if (depthM < 200) return { label: 'Epipelagic — Sunlight Zone', color: '#0284C7' };
  if (depthM < 1000) return { label: 'Mesopelagic — Twilight Zone', color: '#1D4ED8' };
  if (depthM < 4000) return { label: 'Bathypelagic — Midnight Zone', color: '#3730A3' };
  if (depthM < 6000) return { label: 'Abyssopelagic — Abyssal', color: '#4C1D95' };
  return { label: 'Hadopelagic — Hadal Zone', color: '#581C87' };
}

export interface WaterLayer {
  name: string; range: string; note: string; temp: string; speed: string; color: string;
}

export function classifyWaterColumn(maxDepth: number, sst: number): WaterLayer[] {
  const S = 35;
  function mac(T: number, D: number): number {
    const d = Math.min(D, 8000);
    return Math.round(
      1448.96 + 4.591 * T - 5.304e-2 * T ** 2 + 2.374e-4 * T ** 3
      + 1.340 * (S - 35) + 1.630e-2 * d + 1.675e-7 * d ** 2
      - 1.025e-2 * T * (S - 35) - 7.139e-13 * T * d ** 3
    );
  }

  const layers: WaterLayer[] = [];

  if (maxDepth >= 0) {
    layers.push({
      name: 'Mixed Layer',
      range: `0 – ${Math.min(50, Math.round(maxDepth))} m`,
      note: 'Wind-mixed, near-isothermal, sonar near-field',
      temp: `${sst.toFixed(1)} °C`,
      speed: `${mac(sst, 0)} m/s`,
      color: '#0EA5E9',
    });
  }

  if (maxDepth > 50) {
    const tBot = Math.max(8, sst - ((Math.min(200, maxDepth) - 50) / 150) * (sst - 8));
    layers.push({
      name: 'Seasonal Thermocline',
      range: `50 – ${Math.min(200, Math.round(maxDepth))} m`,
      note: 'Steep temp gradient — sonar refraction and deflection',
      temp: `${sst.toFixed(1)} → ${tBot.toFixed(1)} °C`,
      speed: `${mac(sst, 50)} → ${mac(tBot, 200)} m/s`,
      color: '#6366F1',
    });
  }

  if (maxDepth > 200) {
    layers.push({
      name: 'Deep Scattering Layer',
      range: `200 – ${Math.min(600, Math.round(maxDepth))} m`,
      note: 'Biological organisms cause sonar masking (dusk migration)',
      temp: '6 – 8 °C',
      speed: `${mac(7, 400)} m/s`,
      color: '#7C3AED',
    });
  }

  if (maxDepth > 600) {
    layers.push({
      name: 'Permanent Thermocline',
      range: `600 – ${Math.min(4000, Math.round(maxDepth))} m`,
      note: 'Stable cold gradient — SOSUS detection band, sub ops depth',
      temp: '2 – 6 °C',
      speed: `${mac(4, 1000)} → ${mac(2, 3000)} m/s`,
      color: '#1E3A8A',
    });
  }

  if (maxDepth > 4000) {
    layers.push({
      name: 'Abyssal Zone',
      range: `> 4000 m`,
      note: 'Near-freezing, extreme pressure — speed increases with depth',
      temp: '~2 °C',
      speed: `${mac(2, 4000)} m/s`,
      color: '#0F172A',
    });
  }

  return layers;
}

export function sofarChannelNote(depthM: number): string | null {
  // SOFAR (Sound Fixing And Ranging) channel: minimum sound speed axis ~600–1200 m
  if (depthM < 600) return null; // too shallow for SOFAR
  if (depthM < 1200) return `Partially within SOFAR channel (min. sound speed axis ~${Math.round(depthM * 0.9)} m). Long-range acoustic propagation possible.`;
  return `SOFAR channel present (~600–1200 m). Sound trapped → long-range propagation. SOSUS/hydrophone detection range elevated.`;
}

// ─── Rendering helpers ────────────────────────────────────────────────────────

export function renderSoundSpeedProfile(
  profile: Array<{ depth: number; temp: number; speed: number }>,
): string {
  if (!profile.length) return '';
  const speeds = profile.map(p => p.speed);
  const minS = Math.min(...speeds);
  const maxS = Math.max(...speeds);
  const range = maxS - minS || 1;

  const rows = profile.map(p => {
    const pct = Math.max(4, Math.round(((p.speed - minS) / range) * 70));
    const barColor = p.depth === 0 ? '#0EA5E9'
      : p.depth <= 200 ? '#6366F1'
        : p.depth <= 800 ? '#7C3AED'
          : '#1E3A8A';
    return `
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;">
        <span style="width:32px;font-size:8px;color:#9CA3AF;text-align:right;flex-shrink:0;">${p.depth}m</span>
        <div style="flex:1;background:#E5E7EB;border-radius:2px;height:6px;position:relative;">
          <div style="width:${pct}%;background:${barColor};height:6px;border-radius:2px;min-width:4px;"></div>
        </div>
        <span style="width:54px;font-size:8px;font-weight:600;color:#374151;flex-shrink:0;">${p.speed} m/s</span>
        <span style="width:34px;font-size:8px;color:#6B7280;flex-shrink:0;">${p.temp}°C</span>
      </div>`;
  }).join('');

  return `<div>${rows}</div>`;
}

export function renderTideSparkline(levels: (number | null)[], nowH: number): string {
  const vals = levels.filter((v): v is number => v != null);
  if (!vals.length) return '';
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const H = 20;
  const W = 2;
  const gap = 0.5;
  const total = levels.slice(0, 24);

  const bars = total.map((v, i) => {
    const h = v != null ? Math.max(2, Math.round(((v - min) / (max - min || 1)) * H)) : 2;
    const x = i * (W + gap);
    const active = i === nowH;
    return `<rect x="${x}" y="${H - h}" width="${W}" height="${h}" fill="${active ? '#0369A1' : '#BAE6FD'}" rx="0.5"/>`;
  }).join('');

  const totalW = total.length * (W + gap);
  return `<svg width="${totalW}" height="${H + 2}" viewBox="0 0 ${totalW} ${H + 2}" style="vertical-align:middle;flex-shrink:0;">${bars}</svg>`;
}

export function compassBearing(deg: number | null): string {
  if (deg == null) return '';
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}