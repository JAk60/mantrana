/**
 * kgGlobals.ts
 *
 * Call registerKGGlobals() once inside the map 'load' handler in useGlobeMapEngine.
 * It registers window globals used by inline onclick handlers in popup HTML:
 *
 *   window.__buildGridKG(snapshot)  → GraphData
 *   window.__mountKGDrawer(canvasId, graphData, title)
 *   window.__openKGFromStore(key, title)   ← NEW: open full modal by store key
 *
 * Port KGs are stashed at popup-render time via stashPortKG(key, data).
 * Grid KGs are built on demand from window.__gridKGData[key] snapshots.
 * Both are opened via __openKGFromStore — no payload in the HTML attribute.
 */

import { createElement } from 'react';
import { buildGridKG, type GridEnrichmentSnapshot, type GraphData } from '@/lib/map/kg/kgBuilder';
import GraphCanvas from '@/components/GraphCanvas';

// ─── Grid snapshot registry ──────────────────────────────────────────────────

const gridRegistry = new Map<string, GridEnrichmentSnapshot>();

export function stashGridKGData(
  latR: number,
  lngR: number,
  partial: Partial<GridEnrichmentSnapshot>,
) {
  const key = `${latR}_${lngR}`;
  const existing = gridRegistry.get(key) ?? { lat: latR, lng: lngR };
  const merged: GridEnrichmentSnapshot = { ...existing, ...partial };
  gridRegistry.set(key, merged);
  if (typeof window !== 'undefined') {
    if (!window.__gridKGData) window.__gridKGData = {};
    window.__gridKGData[key] = merged;
  }
}

// ─── Port / generic KG store ─────────────────────────────────────────────────
// Keyed by an arbitrary string (e.g. port name safe-id).
// stashPortKG is called at popup-render time in ports.ts so the data is
// always available when the user clicks "Full" — no payload in HTML.

const portKGStore = new Map<string, GraphData>();

export function stashPortKG(key: string, data: GraphData) {
  portKGStore.set(key, data);
  if (typeof window !== 'undefined') {
    if (!window.__kgStore) window.__kgStore = {};
    window.__kgStore[key] = data;
  }
}

// ─── Root cache ───────────────────────────────────────────────────────────────

const rootCache = new Map<string, ReturnType<typeof import('react-dom/client')['createRoot']>>();

// ─── Register globals ─────────────────────────────────────────────────────────

export function registerKGGlobals() {
  if (typeof window === 'undefined') return;

  // Grid KG builder
  (window as any).__buildGridKG = (snapshot: GridEnrichmentSnapshot): GraphData =>
    buildGridKG(snapshot);

  // Mount compact GraphCanvas into a popup drawer div
  (window as any).__mountKGDrawer = async (
    canvasId: string,
    data: GraphData,
    title: string,
  ) => {
    const el = document.getElementById(canvasId);
    if (!el) return;

    const { createRoot } = await import('react-dom/client');

    let root = rootCache.get(canvasId);
    if (!root) {
      root = createRoot(el);
      rootCache.set(canvasId, root);
    }

    root.render(
      createElement(GraphCanvas, {
        graph:    data,
        graphKey: title,
        compact:  true,
        height:   320,
      }),
    );
  };

  // Open full-screen KG modal by store key.
  // For ports: key = port safe-id, data already in __kgStore.
  // For grids: key = "lat_lng", data built on demand from __gridKGData.
  (window as any).__openKGFromStore = (key: string, title: string) => {
    if (!window.__openKGModal) {
      console.warn('__openKGModal not registered — is KGPortalModal mounted?');
      return;
    }

    // Try port store first
    const portData = (window.__kgStore ?? {})[key];
    if (portData) {
      window.__openKGModal(portData, title);
      return;
    }

    // Fall back to grid: build from snapshot
    const snapshot = (window.__gridKGData ?? {})[key];
    if (snapshot && (window as any).__buildGridKG) {
      const gridData = (window as any).__buildGridKG(snapshot);
      window.__openKGModal(gridData, title);
      return;
    }

    console.warn('__openKGFromStore: no data found for key', key);
  };

  // Initialise stores
  if (!window.__gridKGData) window.__gridKGData = {};
  if (!window.__kgStore)    window.__kgStore    = {};
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export function unregisterKGGlobals() {
  if (typeof window === 'undefined') return;
  delete (window as any).__buildGridKG;
  delete (window as any).__mountKGDrawer;
  delete (window as any).__openKGFromStore;
  rootCache.forEach((root) => { try { root.unmount(); } catch (_) {} });
  rootCache.clear();
  gridRegistry.clear();
  portKGStore.clear();
}