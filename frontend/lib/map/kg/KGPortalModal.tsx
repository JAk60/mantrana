'use client';
/**
 * KGPortalModal.tsx
 *
 * Mounts once in the app root. Listens for window.__openKGModal(graphData, title).
 * Renders GraphCanvas inside a full-screen dark overlay via React portal.
 *
 * Usage from vanilla popup HTML:
 *   window.__openKGModal(graphData, 'Mumbai Port');
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import type { GraphData } from '@/components/GraphCanvas';

// Lazy-load GraphCanvas so vis-network doesn't bloat the main bundle
const GraphCanvas = dynamic(() => import('@/components/GraphCanvas'), { ssr: false });

// ─── Global type augmentation ────────────────────────────────────────────────
declare global {
  interface Window {
    __openKGModal: (data: GraphData, title?: string) => void;
    __openKGFromStore: (key: string, title: string) => void;
    __buildGridKG: (snapshot: import('@/lib/map/kg/kgBuilder').GridEnrichmentSnapshot) => GraphData;
    __gridKGData: Record<string, import('@/lib/map/kg/kgBuilder').GridEnrichmentSnapshot>;
    __kgStore: Record<string, GraphData>;
    __gridPopupTab: (tabId: string, btn: HTMLElement) => void;
    __saveGlobePin?: (lat: number, lng: number) => void;
    __closeGridPopupDrawer?: (drawerId: string) => void;
  }
}

interface ModalState {
  data: GraphData;
  title: string;
}

export default function KGPortalModal() {
  const [modal, setModal] = useState<ModalState | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Register the global opener
  useEffect(() => {
    window.__openKGModal = (data: GraphData, title = 'Knowledge Graph') => {
      setModal({ data, title });
    };
    return () => {
      // @ts-ignore
      delete window.__openKGModal;
    };
  }, []);
  // Register the global opener
  useEffect(() => {
    window.__openKGModal = (data: GraphData, title = 'Knowledge Graph') => {
      setModal({ data, title });
    };

    window.__openKGFromStore = (key: string, title: string) => {
      // Port popups store fully-built GraphData directly
      const stored = window.__kgStore?.[key];
      if (stored) {
        setModal({ data: stored, title });
        return;
      }

      // Grid popups store a raw snapshot that needs building
      const snapshot = window.__gridKGData?.[key];
      if (snapshot && window.__buildGridKG) {
        const built = window.__buildGridKG(snapshot);
        setModal({ data: built, title });
        return;
      }

      console.warn(`[KGPortalModal] No KG data found for key "${key}"`);
    };

    return () => {
      // @ts-ignore
      delete window.__openKGModal;
      // @ts-ignore
      delete window.__openKGFromStore;
    };
  }, []);
  const close = useCallback(() => setModal(null), []);

  // Esc key
  useEffect(() => {
    if (!modal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modal, close]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = modal ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [modal]);

  if (typeof document === 'undefined' || !modal) return null;

  return createPortal(
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) close(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        boxSizing: 'border-box',
        animation: 'kg-modal-in 0.18s ease',
      }}
    >
      <style>{`
        @keyframes kg-modal-in {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes kg-panel-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* KG icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="5" r="2.5" stroke="#5AA9FF" strokeWidth="1.8" />
            <circle cx="5" cy="19" r="2.5" stroke="#4FD1C5" strokeWidth="1.8" />
            <circle cx="19" cy="19" r="2.5" stroke="#4FD1C5" strokeWidth="1.8" />
            <circle cx="12" cy="12" r="2" stroke="#9FC6FF" strokeWidth="1.5" />
            <line x1="12" y1="7.5" x2="12" y2="10" stroke="#5AA9FF" strokeWidth="1.4" />
            <line x1="12" y1="14" x2="6.8" y2="17.2" stroke="#4FD1C5" strokeWidth="1.4" />
            <line x1="12" y1="14" x2="17.2" y2="17.2" stroke="#4FD1C5" strokeWidth="1.4" />
          </svg>
          <span style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 700,
            fontSize: '15px',
            color: '#E7ECF3',
            letterSpacing: '0.04em',
          }}>
            {modal.title}
          </span>
          <span style={{
            fontSize: '11px',
            color: '#7C8898',
            background: '#11161D',
            border: '1px solid #232B36',
            borderRadius: '5px',
            padding: '2px 8px',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            KNOWLEDGE GRAPH
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{
            fontSize: '11px',
            color: '#7C8898',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            {modal.data.nodes.length} nodes · {modal.data.edges.length} edges
          </span>
          <button
            onClick={close}
            style={{
              background: '#11161D',
              border: '1px solid #232B36',
              borderRadius: '7px',
              color: '#7C8898',
              cursor: 'pointer',
              fontSize: '18px',
              lineHeight: 1,
              padding: '4px 10px',
              fontFamily: 'inherit',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = '#E7ECF3';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#5AA9FF';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = '#7C8898';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#232B36';
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/*
        Graph canvas — fills remaining space.
        overflow must be 'visible' (not 'hidden') so the node/edge
        detail panels rendered by GraphCanvas can escape the container.
      */}
      <div style={{
        flex: 1,
        minHeight: 0,
        borderRadius: '12px',
        overflow: 'visible',        // ← was 'hidden', which clipped float panels
        border: '1px solid #232B36',
        position: 'relative',       // stacking context for z-index inside GraphCanvas
      }}>
        <GraphCanvas
          graph={modal.data}
          graphKey={modal.title}
        />
      </div>
    </div>,
    document.body,
  );
}