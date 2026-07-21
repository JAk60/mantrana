/**
 * kgBuilder.ts
 * Builds GraphData (nodes + edges) at runtime for:
 *   - Port / Location popups  → buildPortKG(port, facilityStatus)
 *   - Grid point popups       → buildGridKG(lat, lng, enrichmentData)
 *
 * The shape mirrors the Mumbai Port JSON so GraphCanvas works unchanged.
 */

import type { GraphData, GraphNode, GraphEdge } from '@/components/graph/GraphCanvas';
import type { PortFacilityStatus } from '@/lib/globe';

// ─── Shared helpers ──────────────────────────────────────────────────────────

function node(
  id: string,
  label: string,
  type: string,
  props: Record<string, string | number | undefined>,
): GraphNode {
  return {
    id,
    label,
    type,
    node_properties: {
      class: type,
      timestamp: new Date().toISOString(),
      ...Object.fromEntries(
        Object.entries(props).filter(([, v]) => v !== undefined && v !== ''),
      ),
    },
  };
}

function edge(
  id: string,
  type: string,
  source: string,
  target: string,
): GraphEdge {
  return {
    id,
    // s/t are what normalizeEdge reads first — must be set
    s: source,
    t: target,
    // keep source/target as well for anything that reads them directly
    source,
    target,
    r: type,   // normalizeEdge reads r ?? relation ?? label for the edge label
    is_reverse: false,
    edge_properties: {
      timestamp: new Date().toISOString(),
      edge_type: type,
      is_reverse: false,
    },
  };
}

// ─── PORT / LOCATION KG ──────────────────────────────────────────────────────

export interface PortLike {
  name: string;
  lat: number;
  lng: number;
  country: string;
  category: string;
  portStatus: string;
}

export function buildPortKG(port: PortLike, f: PortFacilityStatus): GraphData {
  const ROOT = 'location';

  const nodes: GraphNode[] = [
    node(ROOT, port.name, 'Location', {
      subclass: 'Port',
      name: port.name,
      lat: String(port.lat),
      long: String(port.lng),
      country: port.country,
      port_name: port.name,
    }),
    node('identity', 'Identity', 'Identity', {
      identityType: port.portStatus === 'Self' ? 'Friendly Naval' : port.portStatus,
      identityName: port.name,
      identityCode: `${port.country.slice(0, 2).toUpperCase()}-PORT`,
    }),
    node('spatial', 'Spatial', 'Spatial', {
      coordinates: `${port.lat.toFixed(4)}° N, ${port.lng.toFixed(4)}° E`,
      maritimeZone: 'Internal Waters',
      friendlyAdversaryAffiliation:
        port.portStatus === 'Self' ? 'Friendly' : port.portStatus === 'Adversary' ? 'Adversary' : 'Neutral',
      latitude: String(port.lat),
      longitude: String(port.lng),
    }),
    node('environment', 'Environment', 'Environment', {
      weather: f.weather,
      sea_state: 'Moderate',
    }),
    node('capabilities', 'Capabilities', 'Capabilities', {
      dryDocks: String(f.dryDocks),
      repair: f.dryDocks > 0 ? 'Dry-dock' : 'None',
      gasTurbineWorkshop: f.gasTurbineWorkshop,
      electricalWorkshop: f.electricalWorkshop,
      weaponCalibration: f.weaponCalibration,
      radarTesting: f.radarTesting,
    }),
    node('status', 'Status', 'Status', {
      operational_status: f.operational,
      occupancy: 'Active',
      lastUpdateTimestamp: new Date().toISOString(),
    }),
    node('threat', 'ThreatAndSecurity', 'ThreatAndSecurity', {
      security_level: f.securityLevel,
      threatLevel:
        f.securityLevel === 'High' ? 'High' : f.securityLevel === 'Elevated' ? 'Moderate' : 'Low',
    }),
    node('purpose', 'PurposeFunction', 'PurposeFunction', {
      purposeType: port.portStatus === 'Self' ? 'Naval' : 'Commercial and Naval Logistics',
      primary_function: port.category,
    }),
  ];

  const childIds = ['identity', 'spatial', 'environment', 'capabilities', 'status', 'threat', 'purpose'];
  const edgeTypes = [
    'hasIdentity', 'hasSpatial', 'hasEnvironment',
    'hasCapabilities', 'hasStatus', 'hasThreatAndSecurity', 'hasPurposeFunction',
  ];

  const edges: GraphEdge[] = childIds.map((cid, i) =>
    edge(`e-${cid}`, edgeTypes[i], ROOT, cid),
  );

  return { nodes, edges };
}

// ─── GRID POINT KG ───────────────────────────────────────────────────────────

export interface GridEnrichmentSnapshot {
  lat: number;
  lng: number;
  // Populated progressively — all optional (may still be loading)
  location?: {
    name?: string;
    country?: string;
    maritimeZone?: string;
  };
  bathymetry?: {
    depthM?: number;
    seabedType?: string;
    salinity?: string;
  };
  waterColumn?: {
    sst?: string;          // sea surface temp
    thermoDepth?: string;  // thermocline depth
    sonarLayer?: string;
  };
  currents?: {
    speedKnots?: string;
    directionDeg?: string;
    tidalPhase?: string;
  };
  seaState?: {
    waveHeightM?: string;
    swellPeriodS?: string;
    beaufort?: string;
    windKnots?: string;
    windDir?: string;
  };
  nearbyAssets?: {
    friendlyShips?: string;
    totalAssets?: number;
  };
}

export function buildGridKG(data: GridEnrichmentSnapshot): GraphData {
  const ROOT = 'gridpoint';
  const label = `${data.lat.toFixed(4)}°N ${data.lng.toFixed(4)}°E`;

  const nodes: GraphNode[] = [
    node(ROOT, label, 'GridPoint', {
      latitude: String(data.lat),
      longitude: String(data.lng),
      coordinates: label,
    }),
    node('location', 'Location', 'Location', {
      name: data.location?.name ?? 'Open Ocean',
      country: data.location?.country ?? '—',
      maritimeZone: data.location?.maritimeZone ?? 'International Waters',
    }),
    node('bathymetry', 'Bathymetry', 'Bathymetry', {
      depthM: data.bathymetry?.depthM !== undefined ? `${data.bathymetry.depthM} m` : '—',
      seabedType: data.bathymetry?.seabedType ?? '—',
      salinity: data.bathymetry?.salinity ?? '—',
    }),
    node('waterColumn', 'WaterColumn', 'WaterColumn', {
      sst: data.waterColumn?.sst ?? '—',
      thermoclineDepth: data.waterColumn?.thermoDepth ?? '—',
      sonarLayer: data.waterColumn?.sonarLayer ?? '—',
    }),
    node('currents', 'Currents', 'Currents', {
      speedKnots: data.currents?.speedKnots ?? '—',
      directionDeg: data.currents?.directionDeg ?? '—',
      tidalPhase: data.currents?.tidalPhase ?? '—',
    }),
    node('seaState', 'SeaState', 'SeaState', {
      waveHeightM: data.seaState?.waveHeightM ?? '—',
      swellPeriodS: data.seaState?.swellPeriodS ?? '—',
      beaufort: data.seaState?.beaufort ?? '—',
      windKnots: data.seaState?.windKnots ?? '—',
      windDir: data.seaState?.windDir ?? '—',
    }),
    node('assets', 'NavalAssets', 'NavalAssets', {
      nearbyFriendlyShips: data.nearbyAssets?.friendlyShips ?? '—',
      totalAssetsInRange: data.nearbyAssets?.totalAssets !== undefined
        ? String(data.nearbyAssets.totalAssets)
        : '—',
    }),
  ];

  const childIds = ['location', 'bathymetry', 'waterColumn', 'currents', 'seaState', 'assets'];
  const edgeTypes = [
    'hasLocation', 'hasBathymetry', 'hasWaterColumn',
    'hasCurrents', 'hasSeaState', 'hasNavalAssets',
  ];

  const edges: GraphEdge[] = childIds.map((cid, i) =>
    edge(`e-${cid}`, edgeTypes[i], ROOT, cid),
  );

  return { nodes, edges };
}