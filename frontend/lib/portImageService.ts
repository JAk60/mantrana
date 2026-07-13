/**
 * portImageService.ts
 * Fetches a single real Unsplash photo and renders a rich port card
 * directly inside the existing MapLibre popup content node.
 *
 * Env: NEXT_PUBLIC_UNSPLASH_ACCESS_KEY
 */

async function fetchPhoto(query: string): Promise<{
  thumb: string;
  full: string;
} | null> {
  const key = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${key}` } }
    );
    const data = await res.json();
    const p = data?.results?.[0];
    if (!p) return null;
    return {
      thumb: p.urls.small,
      full: p.urls.regular,
    };
  } catch {
    return null;
  }
}

/**
 * Call ONCE per popup open.
 * Completely replaces the popup inner HTML with a rich card.
 */
export async function injectPhotosIntoPopup(
  container: HTMLElement,
  portName: string,
  category: string,
  country: string,
  lat: number,
  lng: number,
  mapsUrl: string
) {
  if (container.dataset.pphDone === '1') return;
  container.dataset.pphDone = '1';

  const parsedLat = typeof lat === 'number' ? lat : parseFloat(lat as any);
  const parsedLng = typeof lng === 'number' ? lng : parseFloat(lng as any);
  const latFormatted = isNaN(parsedLat) ? '0.0000' : parsedLat.toFixed(4);
  const lngFormatted = isNaN(parsedLng) ? '0.0000' : parsedLng.toFixed(4);

  // ── 1. Render skeleton card immediately ───────────────────────────────────
  container.innerHTML = `
    <div style="
      font-family: ui-monospace, 'JetBrains Mono', monospace;
      width: 260px;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
    ">
      <!-- Photo area -->
      <div id="__pph_img_wrap" style="
        position: relative;
        width: 100%;
        padding-top: 55%;
        background: linear-gradient(135deg, #1a1208 0%, #2d1f0e 100%);
        overflow: hidden;
      ">
        <div id="__pph_shimmer" style="
          position: absolute; inset: 0;
          background: linear-gradient(90deg,
            transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: __pph_shimmer 1.4s infinite;
        "></div>
        <style>
          @keyframes __pph_shimmer {
            0%   { background-position: -200% 0; }
            100% { background-position:  200% 0; }
          }
        </style>
        <div id="__pph_placeholder" style="
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          opacity: 0.15;
        ">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
            stroke="#B5651D" stroke-width="1.5">
            <circle cx="12" cy="5" r="2"/>
            <line x1="12" y1="7" x2="12" y2="19"/>
            <path d="M5 12H2a10 10 0 0 0 20 0h-3"/>
          </svg>
        </div>
      </div>

      <div style="margin: 10px 14px 0; border-top: 1px solid #f0ece6;"></div>
    </div>
  `;

  // ── 2. Fetch photo, swap in when ready ────────────────────────────────────
  const photo = await fetchPhoto(`${portName} port`);

  const shimmer     = container.querySelector<HTMLElement>('#__pph_shimmer');
  const placeholder = container.querySelector<HTMLElement>('#__pph_placeholder');
  const wrap        = container.querySelector<HTMLElement>('#__pph_img_wrap');
  const footer      = container.querySelector<HTMLElement>('#__pph_footer');

  if (!photo) {
    shimmer?.remove();
    return;
  }

  const img = new Image();
  img.onload = () => {
    if (!wrap) return;

    shimmer?.remove();
    placeholder?.remove();

    // Swap in the actual photo
    const imgEl = document.createElement('img');
    imgEl.src = photo.thumb;
    imgEl.alt = portName;
    imgEl.style.cssText = `
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      object-fit: cover; display: block;
    `;
    wrap.appendChild(imgEl);

    // Inject "View Full Size" button into footer
    if (footer) {
      const fullSizeBtn = document.createElement('a');
      fullSizeBtn.href = photo.full;
      fullSizeBtn.target = '_blank';
      fullSizeBtn.rel = 'noopener noreferrer';
      fullSizeBtn.style.cssText = `
        display: inline-flex; align-items: center; gap: 5px;
        padding: 6px 12px; border-radius: 7px;
        background: #1a1a1a; color: #fff;
        font-size: 10px; font-weight: 700; letter-spacing: .07em;
        text-decoration: none;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        order: -1;
      `;
      fullSizeBtn.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5">
          <polyline points="15 3 21 3 21 9"/>
          <polyline points="9 21 3 21 3 15"/>
          <line x1="21" y1="3" x2="14" y2="10"/>
          <line x1="3" y1="21" x2="10" y2="14"/>
        </svg>
        FULL SIZE
      `;
      footer.insertBefore(fullSizeBtn, footer.firstChild);
    }
  };
  img.src = photo.thumb;
}