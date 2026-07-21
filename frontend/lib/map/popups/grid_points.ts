import {
  haversineNm,
  idSafe,
  PIN_ICON_SVG,
  SHIP_ICON_SVG,
  SHIP_LOCATIONS
} from '@/lib/globe';
import { pointStyle, RADIUS_NM } from '../mapConfig';

// ─── All APIs used here are CORS-open — NO PROXY NEEDED ─────────────────────
//
//   https://api.open-meteo.com/v1/elevation
//     → Copernicus DEM GLO-90 (90 m resolution seafloor depth)
//
//   https://marine-api.open-meteo.com/v1/marine
//     → SST, ocean currents, waves, swell, sea level height (Access-Control-Allow-Origin: *)
//
//   https://nominatim.openstreetmap.org/reverse
//     → Reverse geocoding (CORS enabled for browser use)

// ─── Shared DOM-ID helpers ────────────────────────────────────────────────────


// ─── Skeleton loader ──────────────────────────────────────────────────────────
const tabButtonStyle = `
display:flex;
align-items:center;
justify-content:flex-start;
gap:8px;
padding:10px 12px;
background:#F8FAFC;
border:1px solid #E5E7EB;
border-radius:10px;
cursor:pointer;
font-size:11px;
font-weight:600;
transition:.2s;
`;
function skeletonHtml(lines = 2): string {
  const style = `height:8px;border-radius:3px;margin-bottom:5px;background:linear-gradient(90deg,#E5E7EB 25%,#F3F4F6 50%,#E5E7EB 75%);background-size:200% 100%;animation:sk-shimmer 1.4s infinite;`;
  const widths = ['80%', '65%', '72%', '55%', '88%'];
  const bars = Array.from({ length: lines }, (_, i) =>
    `<div style="${style}width:${widths[i % widths.length]};"></div>`
  ).join('');
  return `<style>@keyframes sk-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}</style>${bars}`;
}


export function gridPopupIds(latR: number, lngR: number) {
  const safeId = `${idSafe(latR)}-${idSafe(lngR)}`.replace(/\./g, '_');
  return {
    locId:     `grid-loc-${safeId}`,
    seaId:     `grid-sea-${safeId}`,
    depthId:   `grid-depth-${safeId}`,
    seabedId:  `grid-seabed-${safeId}`,
    currentId: `grid-current-${safeId}`,
    tideId:    `grid-tide-${safeId}`,
  };
}

// ─── Grid popup HTML ──────────────────────────────────────────────────────────

export function buildGridPopupHtml(lat: number, lng: number): string {
  const latR = Number(lat.toFixed(4));
  const lngR = Number(lng.toFixed(4));
  const { locId, seaId, depthId, seabedId, currentId, tideId } = gridPopupIds(latR, lngR);

  const shipsWithDist = SHIP_LOCATIONS
    .map((s) => ({ ...s, distNm: Math.round(haversineNm(lat, lng, s.lat, s.lng)) }))
    .sort((a, b) => a.distNm - b.distNm);

  const shipsInRadius = shipsWithDist.filter((s) => s.distNm <= RADIUS_NM);

  const MAX_SHOWN = 4;
  const shipRowsHtml = shipsWithDist.slice(0, MAX_SHOWN).map((s) => {
    const inRange = s.distNm <= RADIUS_NM;
    const color   = inRange ? '#0B3D91' : '#6B7280';
    const badge   = inRange
      ? `<span style="background:#EFF6FF;color:#0B3D91;border-radius:4px;padding:1px 5px;font-size:9px;font-weight:700;">IN RANGE</span>`
      : '';
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid #F3F4F6;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="display:inline-flex;width:18px;height:18px;border-radius:50%;background:${color};align-items:center;justify-content:center;">
            ${SHIP_ICON_SVG.replace('width="14"', 'width="10"').replace('height="14"', 'height="10"')}
          </span>
          <span style="font-size:10px;font-weight:600;color:#1A1A1A;">${s.name}</span>
        </div>
        <div style="display:flex;align-items:center;gap:5px;">
          ${badge}
          <span style="font-size:10px;font-weight:700;color:${color};">${s.distNm} NM</span>
        </div>
      </div>`;
  }).join('');

  return `
<div style="display:flex;align-items:flex-start;">

  <!-- MAIN POPUP -->
  <div style="${pointStyle};width:300px;min-width:300px;">

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div style="font-weight:700;font-size:12px;letter-spacing:.06em;color:#3949AB;">
        GRID POINT
      </div>

      <button
        onclick="window.__saveGlobePin && window.__saveGlobePin(${latR}, ${lngR}); this.innerText='Saved ✓'; this.disabled=true;"
        style="display:flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:#fff;background:#DC2626;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;"
      >
        ${PIN_ICON_SVG} Save
      </button>
    </div>

    <div style="font-size:11px;color:#444;line-height:1.6;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #EEE;">
      LAT&nbsp;&nbsp;${latR}<br/>
      LNG&nbsp;&nbsp;${lngR}
    </div>

    <!-- LEFT MENU -->
    <div style="display:flex;flex-direction:column;gap:8px;">

      <button onclick="window.__gridPopupTab('${depthId}',this)"
        style="${tabButtonStyle}">
        🌊 Bathymetry
      </button>

      <button onclick="window.__gridPopupTab('${seabedId}',this)"
        style="${tabButtonStyle}">
        🌡 Water Column
      </button>

      <button onclick="window.__gridPopupTab('${currentId}',this)"
        style="${tabButtonStyle}">
        🌀 Currents
      </button>

      <button onclick="window.__gridPopupTab('${tideId}',this)"
        style="${tabButtonStyle}">
        🌙 Tides
      </button>

      <button onclick="window.__gridPopupTab('${seaId}',this)"
        style="${tabButtonStyle}">
        🌊 Sea State
      </button>

      <button onclick="window.__gridPopupTab('ships-${locId}',this)"
        style="${tabButtonStyle}">
        ⚓ Nearby Assets
      </button>

    </div>

  </div>


  <!-- RIGHT DRAWER -->
  <div
      id="drawer-${locId}"
      style="
        width:0;
        overflow:hidden;
        transition:width .25s ease;
        margin-left:10px;
      ">

      <div style="
          width:360px;
          background:white;
          border-radius:12px;
          border:1px solid #E5E7EB;
          padding:14px;
          box-shadow:0 8px 24px rgba(0,0,0,.15);
      ">

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">

              <div id="drawer-title-${locId}"
                   style="font-size:12px;font-weight:700;color:#3949AB;">
              </div>

              <button
                  onclick="window.__closeGridPopupDrawer('drawer-${locId}')"
                  style="border:none;background:none;font-size:18px;cursor:pointer;">
                  ✕
              </button>

          </div>

          <div id="drawer-content-${locId}">

              <div id="${locId}" style="display:none">
                  ${skeletonHtml(2)}
              </div>

              <div id="${depthId}" style="display:none">
                  ${skeletonHtml(4)}
              </div>

              <div id="${seabedId}" style="display:none">
                  ${skeletonHtml(3)}
              </div>

              <div id="${currentId}" style="display:none">
                  ${skeletonHtml(2)}
              </div>

              <div id="${tideId}" style="display:none">
                  ${skeletonHtml(2)}
              </div>

              <div id="${seaId}" style="display:none">
                  ${skeletonHtml(3)}
              </div>

              <div id="ships-${locId}" style="display:none">
                  ${shipRowsHtml}

                  ${
                    shipsWithDist.length > MAX_SHOWN
                      ? `<div style="font-size:9px;color:#9CA3AF;padding-top:6px;text-align:right;">+${shipsWithDist.length-MAX_SHOWN} more vessels</div>`
                      : ''
                  }

                  <div style="background:#F8F9FA;border-radius:8px;padding:10px;margin-top:10px;">

                      <div style="font-size:10px;font-weight:700;margin-bottom:8px;">
                          WITHIN ${RADIUS_NM} NM
                      </div>

                      Friendly Ships :
                      <b>${shipsInRadius.length}</b>

                      <div style="margin-top:6px;font-size:10px;color:#9CA3AF;">
                          Live vessel traffic unavailable
                      </div>

                  </div>

              </div>

          </div>

      </div>

  </div>

</div>
`;
                }



