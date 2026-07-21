import {
  haversineNm,
  idSafe,
  PIN_ICON_SVG,
  SHIP_ICON_SVG,
  SHIP_LOCATIONS
} from '@/lib/globe';
import { pointStyle, RADIUS_NM } from '../mapConfig';
import type { GridEnrichmentSnapshot } from '@/lib/map/kg/kgBuilder';
import { jsStringLiteralForAttr } from '../jsAttr';

// ─── All APIs used here are CORS-open — NO PROXY NEEDED ─────────────────────

// ─── Global type augmentation ─────────────────────────────────────────────────
declare global {
  interface Window {
    __gridKGData: Record<string, GridEnrichmentSnapshot>;
    __kgStore: Record<string, import('@/lib/map/kg/kgBuilder').GraphData>;
    __mountKGDrawer: (canvasId: string, data: import('@/lib/map/kg/kgBuilder').GraphData, title: string) => void;
    __openKGModal:   (data: import('@/lib/map/kg/kgBuilder').GraphData, title?: string) => void;
    __openKGFromStore: (key: string, title: string) => void;
    __gridPopupTab:  (tabId: string, btn: HTMLElement) => void;
    __closeGridPopupDrawer: (drawerId: string) => void;
    __saveGlobePin?: (lat: number, lng: number) => void;
  }
}

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
    kgSafeId:  safeId,
  };
}

// ─── Grid popup HTML ──────────────────────────────────────────────────────────

export function buildGridPopupHtml(lat: number, lng: number): string {
  const latR = Number(lat.toFixed(4));
  const lngR = Number(lng.toFixed(4));
  const { locId, seaId, depthId, seabedId, currentId, tideId, kgSafeId } =
    gridPopupIds(latR, lngR);

  const kgDrawerId = `grid-kg-drawer-${kgSafeId}`;
  const kgCanvasId = `grid-kg-canvas-${kgSafeId}`;
  // Key used in window.__gridKGData — matches what stashGridKGData writes
  const kgDataKey  = `${latR}_${lngR}`;
  // Title is a plain coord string — safe in JS, no apostrophes
  const kgTitle    = `${latR}°N ${lngR}°E`;
const kgTitleJS  = jsStringLiteralForAttr(kgTitle);
  const initRegistry = `if(!window.__gridKGData)window.__gridKGData={};`;

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

  <!-- ── MAIN POPUP ──────────────────────────────────────────── -->
  <div style="${pointStyle};width:300px;min-width:300px;">

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div style="font-weight:700;font-size:12px;letter-spacing:.06em;color:#3949AB;">
        GRID POINT
      </div>

      <div style="display:flex;gap:6px;align-items:center;">
        <!-- KG toggle button -->
        <button
          type="button"
          onclick="(function(btn){
            ${initRegistry}
            var drawer = document.getElementById('${kgDrawerId}');
            if (!drawer) return;
            var isOpen = drawer.style.width && drawer.style.width !== '0px';
            if (isOpen) {
              drawer.style.width = '0';
              drawer.style.opacity = '0';
              btn.style.background = '#0B1220';
              btn.style.color = '#fff';
              btn.style.borderColor = '#0B1220';
            } else {
              drawer.style.width = '340px';
              drawer.style.opacity = '1';
              btn.style.background = '#3E8DF3';
              btn.style.color = '#fff';
              btn.style.borderColor = '#3E8DF3';
              if (!drawer.dataset.mounted) {
                drawer.dataset.mounted = '1';
                var snapshot = (window.__gridKGData || {})['${kgDataKey}'] || { lat: ${latR}, lng: ${lngR} };
                if (window.__buildGridKG && window.__mountKGDrawer) {
                  var kgData = window.__buildGridKG(snapshot);
                  window.__mountKGDrawer('${kgCanvasId}', kgData, ${kgTitleJS});
                }
              }
            }
          })(this)"
          style="display:flex;align-items:center;gap:5px;font-size:10px;font-weight:700;color:#fff;background:#0B1220;border:1px solid #0B1220;border-radius:6px;padding:5px 10px;cursor:pointer;letter-spacing:0.04em;"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="5"  r="2.2" stroke="#fff" stroke-width="1.8"/>
            <circle cx="5"  cy="19" r="2.2" stroke="#fff" stroke-width="1.8"/>
            <circle cx="19" cy="19" r="2.2" stroke="#fff" stroke-width="1.8"/>
            <circle cx="12" cy="12" r="1.8" stroke="#9FC6FF" stroke-width="1.5"/>
            <line x1="12" y1="7.2" x2="12" y2="10.2" stroke="#fff" stroke-width="1.4"/>
            <line x1="12" y1="13.8" x2="6.8"  y2="16.8" stroke="#fff" stroke-width="1.4"/>
            <line x1="12" y1="13.8" x2="17.2" y2="16.8" stroke="#fff" stroke-width="1.4"/>
          </svg>
          KG
        </button>

        <button
          onclick="window.__saveGlobePin && window.__saveGlobePin(${latR}, ${lngR}); this.innerText='Saved ✓'; this.disabled=true;"
          style="display:flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:#fff;background:#DC2626;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;"
        >
          ${PIN_ICON_SVG} Save
        </button>
      </div>
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


  <!-- ── ENRICHMENT RIGHT DRAWER (bathymetry / sea state etc.) ── -->
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
                      Friendly Ships : <b>${shipsInRadius.length}</b>
                      <div style="margin-top:6px;font-size:10px;color:#9CA3AF;">
                          Live vessel traffic unavailable
                      </div>
                  </div>

              </div>

          </div>

      </div>

  </div>

  <!-- ── KG SIDE DRAWER ─────────────────────────────────────── -->
  <div
    id="${kgDrawerId}"
    style="
      width:0;
      opacity:0;
      overflow:hidden;
      transition:width 0.25s ease, opacity 0.2s ease;
      margin-left:10px;
      flex-shrink:0;
    "
  >
    <div style="
      width:340px;
      background:#05070A;
      border-radius:12px;
      border:1px solid #232B36;
      overflow:hidden;
      box-shadow:0 8px 32px rgba(0,0,0,0.55);
      display:flex;
      flex-direction:column;
    ">
      <!-- KG drawer header -->
      <div style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding:10px 14px;
        border-bottom:1px solid #232B36;
        background:#0B0F14;
        flex-shrink:0;
      ">
        <div style="display:flex;align-items:center;gap:8px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="5"  r="2.2" stroke="#5AA9FF" stroke-width="1.8"/>
            <circle cx="5"  cy="19" r="2.2" stroke="#4FD1C5" stroke-width="1.8"/>
            <circle cx="19" cy="19" r="2.2" stroke="#4FD1C5" stroke-width="1.8"/>
            <circle cx="12" cy="12" r="1.8" stroke="#9FC6FF" stroke-width="1.5"/>
            <line x1="12" y1="7.2" x2="12" y2="10.2" stroke="#5AA9FF" stroke-width="1.4"/>
            <line x1="12" y1="13.8" x2="6.8"  y2="16.8" stroke="#4FD1C5" stroke-width="1.4"/>
            <line x1="12" y1="13.8" x2="17.2" y2="16.8" stroke="#4FD1C5" stroke-width="1.4"/>
          </svg>
          <span style="font-size:11px;font-weight:700;color:#E7ECF3;letter-spacing:0.05em;font-family:Inter,system-ui,sans-serif;">
            KNOWLEDGE GRAPH
          </span>
          <span style="font-size:9px;color:#7C8898;font-family:Inter,system-ui,sans-serif;">
            ${latR}°N ${lngR}°E
          </span>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <!-- Full screen — key lookup only, no payload in HTML -->
          <button
            type="button"
            onclick="window.__openKGFromStore && window.__openKGFromStore('${kgDataKey}', ${kgTitleJS})"
            title="Full screen"
            style="background:#11161D;border:1px solid #232B36;border-radius:5px;color:#7C8898;cursor:pointer;font-size:11px;padding:3px 8px;font-family:inherit;display:flex;align-items:center;gap:4px;"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke="#7C8898" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
            Full
          </button>
          <!-- Close -->
          <button
            type="button"
            onclick="(function(){
              var drawer = document.getElementById('${kgDrawerId}');
              if (drawer) { drawer.style.width='0'; drawer.style.opacity='0'; }
            })()"
            style="background:none;border:none;color:#7C8898;cursor:pointer;font-size:16px;line-height:1;padding:0 4px;"
          >✕</button>
        </div>
      </div>

      <!-- Canvas mount point -->
      <div id="${kgCanvasId}" style="height:320px;width:100%;"></div>
    </div>
  </div>

</div>
`;
}