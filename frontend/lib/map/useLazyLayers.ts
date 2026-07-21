import { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import {
  LazyLayer,
  makeBathyDescriptor,
  makeEezDescriptor,
  makeIsobathsDescriptor,
  makeShippingDescriptor,
} from './navalLayers';

// ─── useLazyLayers ────────────────────────────────────────────────────────────
// Manages the four optional naval overlays (bathymetry, EEZ, isobaths, shipping).
// Each layer's source + layers are registered exactly once on first toggle-on.
// Subsequent toggles only flip visibility — no teardown, no re-add.
// Exposes resetSources() so the basemap-switch effect can clear the registry
// after setStyle() wipes the map's internal sources.

export function useLazyLayers(mapRef: React.RefObject<maplibregl.Map | null>, mapReady: boolean) {
  const [bathyOn,    setBathyOn]    = useState(false);
  const [eezOn,      setEezOn]      = useState(false);
  const [isobathsOn, setIsobathsOn] = useState(false);
  const [shippingOn, setShippingOn] = useState(false);

  // Tracks which sources have been added — reset when basemap style is swapped.
  const addedSourcesRef = useRef<Set<string>>(new Set());

  const setVis = useCallback((ids: string[], visible: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    ids.forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    });
  }, [mapRef]);

  const toggleLazyLayer = useCallback((on: boolean, layer: LazyLayer) => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (on) {
      if (!addedSourcesRef.current.has(layer.sourceId)) {
        layer.addFn();
        addedSourcesRef.current.add(layer.sourceId);
      }
      setVis(layer.ids, true);
    } else {
      setVis(layer.ids, false);
    }
  }, [mapRef, mapReady, setVis]);

  // Called by the basemap-switch effect after setStyle() — sources are gone.
  const resetSources = useCallback(() => {
    addedSourcesRef.current.clear();
  }, []);

  // Re-apply all currently-on layers (called after a style swap).
  const reapplyActiveLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (bathyOn)    toggleLazyLayer(true, makeBathyDescriptor(map));
    if (eezOn)      toggleLazyLayer(true, makeEezDescriptor(map));
    if (isobathsOn) toggleLazyLayer(true, makeIsobathsDescriptor(map));
    if (shippingOn) toggleLazyLayer(true, makeShippingDescriptor(map));
  }, [mapRef, bathyOn, eezOn, isobathsOn, shippingOn, toggleLazyLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    toggleLazyLayer(bathyOn, makeBathyDescriptor(map));
  }, [bathyOn, mapReady, toggleLazyLayer, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    toggleLazyLayer(eezOn, makeEezDescriptor(map));
  }, [eezOn, mapReady, toggleLazyLayer, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    toggleLazyLayer(isobathsOn, makeIsobathsDescriptor(map));
  }, [isobathsOn, mapReady, toggleLazyLayer, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    toggleLazyLayer(shippingOn, makeShippingDescriptor(map));
  }, [shippingOn, mapReady, toggleLazyLayer, mapRef]);

  return {
    bathyOn,    setBathyOn,
    eezOn,      setEezOn,
    isobathsOn, setIsobathsOn,
    shippingOn, setShippingOn,
    resetSources,
    reapplyActiveLayers,
  };
}
