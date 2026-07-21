// ─── Port popup HTML ──────────────────────────────────────────────────────────
// NOTE: this file is your original buildPortPopupHtml with two additions:
//   1. A footer action row with "Save" + "🛰 Historical Imagery" buttons.
//   2. A small bridge so the Historical Imagery button (which lives inside a
//      raw HTML string injected by maplibre — it isn't rendered by React) can
//      still open the React <HistoricalImageryDialog>. See "THE BRIDGE" below.

import {
  getPortFacilityStatus,
  PORT_LOCATIONS,
  PortFacilityStatus,
  WorkshopStatus,
} from '@/lib/globe';
import { pointStyle, WEATHER_ICON } from '../mapConfig';

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

  // Encoded so the port name/lat/lng survive round-tripping through an
  // HTML attribute untouched (names can contain quotes, unicode, etc).
  const portPayload = encodeURIComponent(
    JSON.stringify({ name: port.name, lat: port.lat, lng: port.lng }),
  );

  return `
    <div style="${pointStyle};min-width:260px;">
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

      <div style="font-size:11px;color:#555;line-height:1.7;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #EEE;">
        ${port.category} &nbsp;·&nbsp; <span style="font-weight:600;color:${statusColor};">${port.portStatus}</span><br/>
        ${port.country}<br/>LAT ${port.lat.toFixed(4)} &nbsp; LNG ${port.lng.toFixed(4)}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
        <div style="background:#F8F9FA;border-radius:6px;padding:6px 8px;">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.07em;color:#888;margin-bottom:2px;">STATUS</div>
          <div style="font-size:11px;font-weight:600;color:${operationalColor};">${f.operational}</div>
        </div>
        <div style="background:#F8F9FA;border-radius:6px;padding:6px 8px;">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.07em;color:#888;margin-bottom:2px;">DRY DOCKS</div>
          <div style="font-size:11px;font-weight:600;color:#1A1A1A;">${f.dryDocks} Available</div>
        </div>
        <div style="background:#F8F9FA;border-radius:6px;padding:6px 8px;">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.07em;color:#888;margin-bottom:2px;">WEATHER</div>
          <div style="font-size:11px;font-weight:600;color:#1A1A1A;">${WEATHER_ICON[f.weather] ?? ''} ${f.weather}</div>
        </div>
        <div style="background:#F8F9FA;border-radius:6px;padding:6px 8px;">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.07em;color:#888;margin-bottom:2px;">SECURITY</div>
          <div style="font-size:11px;font-weight:600;color:${secColor};">${f.securityLevel}</div>
        </div>
      </div>

      <div style="background:#F8F9FA;border-radius:6px;padding:8px;margin-bottom:8px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.07em;color:#888;margin-bottom:6px;">MAINTENANCE FACILITIES</div>
        <div style="font-size:10px;line-height:2;color:#333;">
          <div style="display:flex;justify-content:space-between;gap:8px;"><span>Gas Turbine Workshop</span><span>${statusDot(f.gasTurbineWorkshop)}${f.gasTurbineWorkshop}</span></div>
          <div style="display:flex;justify-content:space-between;gap:8px;"><span>Electrical Workshop</span><span>${statusDot(f.electricalWorkshop)}${f.electricalWorkshop}</span></div>
          <div style="display:flex;justify-content:space-between;gap:8px;"><span>Weapon Calibration</span><span>${statusDot(f.weaponCalibration)}${f.weaponCalibration}</span></div>
          <div style="display:flex;justify-content:space-between;gap:8px;"><span>Radar Testing</span><span>${statusDot(f.radarTesting)}${f.radarTesting}</span></div>
        </div>
      </div>

      <div style="display:flex;gap:6px;">
        <button
          type="button"
          data-action="save-port"
          data-port="${portPayload}"
          style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;font-size:11px;font-weight:600;color:#333;background:#fff;border:1px solid #DDD;border-radius:6px;padding:7px 8px;cursor:pointer;"
        >
          ☆ Save
        </button>
        <button
          type="button"
          data-action="open-historical-imagery"
          data-port="${portPayload}"
          style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;font-size:11px;font-weight:600;color:#fff;background:#0B1220;border:1px solid #0B1220;border-radius:6px;padding:7px 8px;cursor:pointer;"
        >
          🛰 Archived Images
        </button>
      </div>
    </div>`;
}

/* ────────────────────────────────────────────────────────────────────────────
   THE BRIDGE

   buildPortPopupHtml() returns a plain string that maplibre injects straight
   into the DOM — it is NOT rendered by React, so the "Historical Imagery"
   button's click can't call a React state setter directly. The standard fix
   is event delegation: listen once on the map container for clicks on
   [data-action="open-historical-imagery"], read the port payload off the
   button, and forward it into React state.

   Drop this into the component that owns the map + <HistoricalImageryDialog>:

   -----------------------------------------------------------------------
   const [imageryOpen, setImageryOpen] = useState(false);
   const [imageryPort, setImageryPort] = useState<{name:string; lat:number; lng:number} | null>(null);

   useEffect(() => {
     const container = mapRef.current?.getContainer(); // your maplibre map instance
     if (!container) return;

     const handleClick = (e: MouseEvent) => {
       const btn = (e.target as HTMLElement).closest<HTMLElement>(
         '[data-action="open-historical-imagery"]',
       );
       if (!btn) return;
       const payload = btn.dataset.port;
       if (!payload) return;
       setImageryPort(JSON.parse(decodeURIComponent(payload)));
       setImageryOpen(true);
     };

     container.addEventListener('click', handleClick);
     return () => container.removeEventListener('click', handleClick);
   }, []);

   // ... in JSX:
   <HistoricalImageryDialog
     open={imageryOpen}
     onOpenChange={setImageryOpen}
     port={imageryPort}
   />
   -----------------------------------------------------------------------

   Wire up data-action="save-port" the same way for your existing Save logic.
   ──────────────────────────────────────────────────────────────────────── */
