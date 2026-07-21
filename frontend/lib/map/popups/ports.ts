import {
  getPortFacilityStatus,
  PORT_LOCATIONS,
  PortFacilityStatus,
  WorkshopStatus,
} from '@/lib/globe';
import { pointStyle, WEATHER_ICON } from '../mapConfig';
import { buildPortKG, type PortLike } from '@/lib/map/kg/kgBuilder';
import { stashPortKG } from '@/lib/map/kg/kgGlobals';
import { jsStringLiteralForAttr } from '../jsAttr';

// ─── Global type augmentation (shared with grid popup) ─────────────────────
declare global {
  interface Window {
    __gridPopupTab: (tabId: string, btn: HTMLElement) => void;
    __closeGridPopupDrawer: (drawerId: string) => void;
  }
}

const tabButtonStyle = `
display:flex;
align-items:center;
justify-content:flex-start;
gap:8px;
padding:8px 10px;
background:#F8FAFC;
border:1px solid #E5E7EB;
border-radius:10px;
cursor:pointer;
font-size:11px;
font-weight:600;
transition:.2s;
width:100%;
`;

export function buildPortPopupHtml(
  port: typeof PORT_LOCATIONS[number],
  statusColor: string,
  photoId: string,
): string {
  const f: PortFacilityStatus = getPortFacilityStatus(port.name);
  const osmUrl = `https://www.openstreetmap.org/?mlat=${port.lat}&mlon=${port.lng}&zoom=14`;

  const statusDot = (s: WorkshopStatus) =>
    `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;background:${
      s === 'Available' ? '#16A34A' : s === 'Busy' ? '#EA580C' : '#9CA3AF'
    };"></span>`;

  const operationalColor =
    f.operational === 'Operational'       ? '#16A34A' :
    f.operational === 'Reduced Capacity'  ? '#EA580C' :
    f.operational === 'Under Maintenance' ? '#FACC15' : '#DC2626';

  const secColor =
    f.securityLevel === 'Normal'   ? '#16A34A' :
    f.securityLevel === 'Elevated' ? '#EA580C' :
    f.securityLevel === 'High'     ? '#DC2626' : '#7C3AED';

  const portPayload = encodeURIComponent(
    JSON.stringify({ name: port.name, lat: port.lat, lng: port.lng }),
  );

  // ── Build KG data and stash in the module-level store ──────────────────────
  const portLike: PortLike = {
    name: port.name,
    lat: port.lat,
    lng: port.lng,
    country: port.country,
    category: port.category,
    portStatus: port.portStatus,
  };
  const kgData  = buildPortKG(portLike, f);
  const kgKey   = `port_${port.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const kgTitle = port.name;
  stashPortKG(kgKey, kgData);

  // Unique IDs
  const safeId    = port.name.replace(/[^a-zA-Z0-9]/g, '_');
  const drawerId  = `port-kg-drawer-${safeId}`;
  const canvasId  = `port-kg-canvas-${safeId}`;

  // IDs for the new info drawer (facilities tabs), mirrors grid popup pattern
  const infoDrawerId   = `drawer-${safeId}`;
  const locationTabId  = `port-location-${safeId}`;
  const facilitiesId   = `port-facilities-${safeId}`;
  const weatherTabId   = `port-weather-${safeId}`;
  const securityTabId  = `port-security-${safeId}`;
  const dryDocksTabId  = `port-drydocks-${safeId}`;

  const kgTitleJS = jsStringLiteralForAttr(kgTitle);

  const statRow = (label: string, value: string, valueColor = '#1A1A1A') => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #F1F3F5;">
      <span style="font-size:10px;font-weight:600;color:#888;letter-spacing:0.03em;">${label}</span>
      <span style="font-size:11px;font-weight:700;color:${valueColor};">${value}</span>
    </div>`;

  // ── Tab content blocks (rendered eagerly since data is already local) ──────
  const locationContent = `
    <div>
      ${statRow('CATEGORY', port.category)}
      ${statRow('STATUS', port.portStatus, statusColor)}
      ${statRow('COUNTRY', port.country)}
      ${statRow('LATITUDE', port.lat.toFixed(4))}
      ${statRow('LONGITUDE', port.lng.toFixed(4))}
    </div>`;

  const facilitiesContent = `
    <div>
      ${statRow('Gas Turbine Workshop', `${statusDot(f.gasTurbineWorkshop)}${f.gasTurbineWorkshop}`)}
      ${statRow('Electrical Workshop', `${statusDot(f.electricalWorkshop)}${f.electricalWorkshop}`)}
      ${statRow('Weapon Calibration', `${statusDot(f.weaponCalibration)}${f.weaponCalibration}`)}
      ${statRow('Radar Testing', `${statusDot(f.radarTesting)}${f.radarTesting}`)}
    </div>`;

  const weatherContent = `
    <div>
      ${statRow('CONDITION', `${WEATHER_ICON[f.weather] ?? ''} ${f.weather}`)}
    </div>`;

  const securityContent = `
    <div>
      ${statRow('SECURITY LEVEL', f.securityLevel, secColor)}
    </div>`;

  const dryDocksContent = `
    <div>
      ${statRow('DRY DOCKS AVAILABLE', String(f.dryDocks))}
      ${statRow('OPERATIONAL STATUS', f.operational, operationalColor)}
    </div>`;

  return `
    <div style="display:flex;align-items:flex-start;gap:0;">

      <!-- ── MAIN CARD ──────────────────────────────────────── -->
      <div style="${pointStyle};min-width:260px;max-width:260px;">
        <style>
          .maplibregl-popup-content .photo-credit,
          .maplibregl-popup-content [class*="credit"],
          .maplibregl-popup-content [class*="attribution"],
          .maplibregl-popup-content figure figcaption,
          .maplibregl-popup-content [class*="photographer"],
          .maplibregl-popup-content [class*="source"],
          .maplibregl-popup-content [class*="caption"] { display:none !important; }
        </style>

        <div id="${photoId}" style="margin-bottom:8px;border-radius:6px;overflow:hidden;display:none;"></div>

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="font-weight:700;font-size:12px;letter-spacing:0.06em;color:${statusColor};">${port.name.toUpperCase()}</div>
          <a href="${osmUrl}" target="_blank" rel="noopener noreferrer"
            style="display:flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:#fff;background:${statusColor};border-radius:6px;padding:4px 8px;text-decoration:none;white-space:nowrap;line-height:1;">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <path d="M7 2H2v12h12V9" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M10 2h4v4M14 2L8 8" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Open Map
          </a>
        </div>

        <!-- ── LEFT MENU (tabs → open right info drawer, same pattern as grid popup) ── -->
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px;">

          ${[
            { id: locationTabId, icon: '📍', label: 'Location' },
            { id: facilitiesId, icon: '🛠', label: 'Maintenance Facilities' },
            { id: dryDocksTabId, icon: '⚓', label: 'Status &amp; Dry Docks' },
            { id: weatherTabId, icon: WEATHER_ICON[f.weather] ?? '☁', label: 'Weather' },
            { id: securityTabId, icon: '🔒', label: 'Security' },
          ].map(({ id, icon, label }) => `
          <button
            data-tab-id="${id}"
            onclick="(function(btn){
              var drawer = document.getElementById('${infoDrawerId}');
              if (!drawer) return;
              var kgDrawer = document.getElementById('${drawerId}');
              if (kgDrawer) { kgDrawer.style.width = '0'; kgDrawer.style.opacity = '0'; }
              drawer.style.width = '250px';
              var content = document.getElementById('drawer-content-${safeId}');
              if (content) { Array.prototype.forEach.call(content.children, function(el){ el.style.display = 'none'; }); }
              var target = document.getElementById(btn.getAttribute('data-tab-id'));
              if (target) target.style.display = 'block';
              var title = document.getElementById('drawer-title-${safeId}');
              if (title) title.innerHTML = btn.getAttribute('data-tab-icon') + ' ' + btn.getAttribute('data-tab-label');
              var group = btn.parentElement;
              Array.prototype.forEach.call(group.querySelectorAll('button'), function(b){
                b.style.background = '#F8FAFC';
                b.style.borderColor = '#E5E7EB';
                b.style.color = '#1A1A1A';
              });
              btn.style.background = '#0B1220';
              btn.style.borderColor = '#0B1220';
              btn.style.color = '#fff';
            })(this)"
            data-tab-icon="${icon}"
            data-tab-label="${label}"
            style="${tabButtonStyle}">
            ${icon} ${label}
          </button>`).join('')}

        </div>

        <!-- ── Action buttons row ── -->
        <div style="display:flex;gap:6px;">
          <button
            type="button"
            data-action="save-port"
            data-port="${portPayload}"
            style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;font-size:11px;font-weight:600;color:#333;background:#fff;border:1px solid #DDD;border-radius:6px;padding:7px 8px;cursor:pointer;"
          >
            ☆ Save
          </button>

          <!-- KG button — toggles the KG side drawer -->
          <button
            type="button"
            onclick="(function(btn){
              var drawer = document.getElementById('${drawerId}');
              if (!drawer) return;
              var isOpen = drawer.style.width !== '0px' && drawer.style.width !== '';
              if (isOpen) {
                drawer.style.width = '0';
                drawer.style.opacity = '0';
                btn.style.background = '#0B1220';
                btn.style.color = '#fff';
              } else {
                var infoDrawer = document.getElementById('${infoDrawerId}');
                if (infoDrawer) { infoDrawer.style.width = '0'; }
                drawer.style.width = '340px';
                drawer.style.opacity = '1';
                btn.style.background = '#3E8DF3';
                btn.style.color = '#fff';
                if (!drawer.dataset.mounted) {
                  drawer.dataset.mounted = '1';
                  var kgData = (window.__kgStore || {})['${kgKey}'];
                  if (kgData && window.__mountKGDrawer) {
                    window.__mountKGDrawer('${canvasId}', kgData, ${kgTitleJS});
                  }
                }
              }
            })(this)"
            style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;font-size:11px;font-weight:600;color:#fff;background:#0B1220;border:1px solid #0B1220;border-radius:6px;padding:7px 8px;cursor:pointer;"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
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
            type="button"
            data-action="open-historical-imagery"
            data-port="${portPayload}"
            style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;font-size:11px;font-weight:600;color:#fff;background:#0B1220;border:1px solid #0B1220;border-radius:6px;padding:7px 8px;cursor:pointer;"
          >
            🛰 Imagery
          </button>
        </div>
      </div>

      <!-- ── INFO DRAWER (location / facilities / weather / security / dry docks) ── -->
      <div
        id="${infoDrawerId}"
        style="
          width:0;
          overflow:hidden;
          transition:width .25s ease;
          margin-left:10px;
          flex-shrink:0;
          align-self:flex-start;
        ">

        <div style="
            width:250px;
            background:white;
            border-radius:12px;
            border:1px solid #E5E7EB;
            padding:12px;
            box-shadow:0 8px 24px rgba(0,0,0,.15);
        ">

            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;padding-bottom:8px;border-bottom:1px solid #F1F3F5;">
                <div id="drawer-title-${safeId}"
                     style="font-size:11px;font-weight:700;color:${statusColor};letter-spacing:0.03em;">
                    📍 Location
                </div>
                <button
                    onclick="(function(){
                      var drawer = document.getElementById('${infoDrawerId}');
                      if (drawer) drawer.style.width = '0';
                    })()"
                    style="border:none;background:none;font-size:15px;line-height:1;color:#9CA3AF;cursor:pointer;padding:0 2px;"
                    aria-label="Close">
                    ✕
                </button>
            </div>

            <div id="drawer-content-${safeId}">

                <div id="${locationTabId}" style="display:block">
                    ${locationContent}
                </div>

                <div id="${facilitiesId}" style="display:none">
                    ${facilitiesContent}
                </div>

                <div id="${dryDocksTabId}" style="display:none">
                    ${dryDocksContent}
                </div>

                <div id="${weatherTabId}" style="display:none">
                    ${weatherContent}
                </div>

                <div id="${securityTabId}" style="display:none">
                    ${securityContent}
                </div>

            </div>

        </div>

      </div>

      <!-- ── KG SIDE DRAWER ─────────────────────────────────── -->
      <div
        id="${drawerId}"
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
          <!-- Drawer header -->
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
            </div>
            <div style="display:flex;gap:6px;">
              <!-- Full screen button — key lookup, no payload in HTML -->
              <button
                type="button"
                onclick="window.__openKGFromStore && window.__openKGFromStore('${kgKey}', ${kgTitleJS})"
                title="Full screen"
                style="background:#11161D;border:1px solid #232B36;border-radius:5px;color:#7C8898;cursor:pointer;font-size:11px;padding:3px 8px;font-family:inherit;display:flex;align-items:center;gap:4px;"
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                  <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke="#7C8898" stroke-width="1.6" stroke-linecap="round"/>
                </svg>
                Full
              </button>
              <!-- Close drawer -->
              <button
                type="button"
                onclick="(function(){
                  var drawer = document.getElementById('${drawerId}');
                  if (drawer) { drawer.style.width='0'; drawer.style.opacity='0'; }
                })()"
                style="background:none;border:none;color:#7C8898;cursor:pointer;font-size:16px;line-height:1;padding:0 4px;"
              >✕</button>
            </div>
          </div>

          <!-- Canvas mount point -->
          <div id="${canvasId}" style="height:320px;width:100%;"></div>
        </div>
      </div>

    </div>`;
}