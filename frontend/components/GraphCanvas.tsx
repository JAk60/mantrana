// GraphCanvas.tsx — Dark Modern Minimal Naval Theme
/* eslint-disable no-unused-vars */

import { useEffect, useRef, useState, useCallback, CSSProperties } from "react";
import type { Network as VisNetwork } from "vis-network";
import type { DataSet as VisDataSet } from "vis-data";

const C = {
    bg: "#05070A",
    bg2: "#0B0F14",
    bg3: "#11161D",
    border: "#232B36",
    navy: "#9FC6FF",
    blue: "#5AA9FF",
    accent: "#3E8DF3",
    green: "#33C17A",
    red: "#F0475B",
    amber: "#E2A23A",
    text: "#E7ECF3",
    muted: "#7C8898",
    white: "#FFFFFF",
};

const PALETTE = [
    "#4FD1C5", "#F0475B", "#5AA9FF", "#E2A23A", "#B57BEE", "#33C17A",
    "#F286C4", "#E8D34C", "#FF8A5B", "#7C9CFF", "#4FE0B0", "#E06C9F",
];

function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function colorForKey(key: string): string {
    if (!key) return C.accent;
    return PALETTE[hashString(key) % PALETTE.length];
}

function shade(hex: string, amount: number): string {
    const n = hex.replace("#", "");
    const r = Math.round(parseInt(n.slice(0, 2), 16) * (1 - amount));
    const g = Math.round(parseInt(n.slice(2, 4), 16) * (1 - amount));
    const b = Math.round(parseInt(n.slice(4, 6), 16) * (1 - amount));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export interface GraphNode {
    id: string | number;
    label?: string;
    type?: string;
    status?: string;
    node_id?: string | number;
    node_properties?: Record<string, unknown>;
    _source_graph?: unknown;
    merged_into?: unknown;
    [key: string]: unknown;
}

export interface GraphEdge {
    s?: string | number;
    t?: string | number;
    r?: string;
    source?: string | number;
    target?: string | number;
    from?: string | number;
    to?: string | number;
    relation?: string;
    label?: string;
    type?: string;
    status?: string;
    id?: string | number;
    node_id?: string | number;
    timestamp?: string;
    edge_properties?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

interface NormalizedEdge {
    s: string;
    t: string;
    r: string;
    [key: string]: unknown;
}

interface HighlightPath {
    source: string | number;
    target: string | number;
    relation?: string;
}

interface GraphCanvasProps {
    graph: GraphData | null | undefined;
    graphKey?: string;
    highlight?: HighlightPath[];
    onNodeClick?: (node: GraphNode) => void;
    onEdgeClick?: (edge: NormalizedEdge) => void;
    compact?: boolean;
    height?: number;
}

// ─── localName ────────────────────────────────────────────────────────────────
const localName = (uri?: string | number | null): string => {
    if (uri === null || uri === undefined) return "";
    const s = String(uri);
    const hash = s.lastIndexOf("#");
    const slash = s.lastIndexOf("/");
    const idx = Math.max(hash, slash);
    return idx !== -1 && idx < s.length - 1 ? s.slice(idx + 1) : s;
};

function normalizeEdge(edge: GraphEdge): NormalizedEdge {
    return {
        ...edge,
        s: String(edge.s ?? edge.source ?? edge.from ?? ""),
        t: String(edge.t ?? edge.target ?? edge.to ?? ""),
        r: String(edge.r ?? edge.relation ?? edge.label ?? ""),
    };
}

// ─── buildHighlightSets ───────────────────────────────────────────────────────
// Returns:
//   hlEdgeSet  — "srcId::localRelation::tgtId" keys for edge glow
//                Also adds a no-relation fallback key "srcId::::tgtId"
//   hlNodeSet  — node ids that appear in any path
//   hlEdgeCount — actual number of distinct edges (not doubled by the fallback)
function buildHighlightSets(highlight: HighlightPath[] | undefined): {
    hlEdgeSet: Set<string>;
    hlNodeSet: Set<string>;
    hlEdgeCount: number;
} {
    const hlEdgeSet = new Set<string>();
    const hlNodeSet = new Set<string>();
    let hlEdgeCount = 0;

    if (!highlight?.length) return { hlEdgeSet, hlNodeSet, hlEdgeCount };

    for (const p of highlight) {
        const src = String(p.source);
        const tgt = String(p.target);
        const rel = localName(p.relation ?? "");

        hlNodeSet.add(src);
        hlNodeSet.add(tgt);

        // Primary key: with relation
        hlEdgeSet.add(`${src}::${rel}::${tgt}`);
        // Fallback key: without relation (matches any edge between these two nodes)
        hlEdgeSet.add(`${src}::::${tgt}`);
        hlEdgeCount++;
    }

    return { hlEdgeSet, hlNodeSet, hlEdgeCount };
}

function highlightToKey(highlight: HighlightPath[] | undefined): string {
    if (!highlight?.length) return "";
    return highlight
        .map(p => `${String(p.source)}::${localName(p.relation ?? "")}::${String(p.target)}`)
        .join("|");
}

function runSearch(
    graph: GraphData | null | undefined,
    query: string,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
    if (!graph || !query.trim()) return { nodes: [], edges: [] };
    const q = query.toLowerCase();
    const nodes = graph.nodes.filter(
        n => n.status !== "invalid" && (n.label ?? "").toLowerCase().includes(q)
    );
    const edges = graph.edges.filter(e => {
        const ne = normalizeEdge(e);
        const srcNode = graph.nodes.find(n => String(n.id) === ne.s);
        const tgtNode = graph.nodes.find(n => String(n.id) === ne.t);
        if (srcNode?.status === "invalid" || tgtNode?.status === "invalid") return false;
        const rel = localName(ne.r ?? "").toLowerCase();
        const src = (srcNode?.label ?? ne.s).toLowerCase();
        const tgt = (tgtNode?.label ?? ne.t).toLowerCase();
        return rel.includes(q) || src.includes(q) || tgt.includes(q);
    });
    return { nodes, edges };
}

export default function GraphCanvas({
    graph,
    graphKey,
    highlight,
    onNodeClick,
    onEdgeClick,
    compact = false,
    height,
}: GraphCanvasProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const networkRef = useRef<VisNetwork | null>(null);
    const graphRef = useRef<GraphData | null | undefined>(graph);
    const onNodeClickRef = useRef<typeof onNodeClick>(onNodeClick);
    const onEdgeClickRef = useRef<typeof onEdgeClick>(onEdgeClick);
    const edgeDataRef = useRef<NormalizedEdge[]>([]);
    const searchRef = useRef<HTMLDivElement | null>(null);

    const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
    const [panel, setPanel] = useState<GraphNode | null>(null);
    const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
    const [panelEdge, setPanelEdge] = useState<NormalizedEdge | null>(null);
    const [panelEdgePos, setPanelEdgePos] = useState({ x: 0, y: 0 });
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({
        nodes: [],
        edges: [],
    });
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchFocused, setSearchFocused] = useState(false);

    // AFTER
    const canvasHeight = height ?? (compact ? 220 : undefined);
    // Compute highlight sets once — reused in the render effect
    const hlKey = highlightToKey(highlight);
    const { hlEdgeSet, hlNodeSet, hlEdgeCount } = buildHighlightSets(highlight);
    const hasHighlight = hlEdgeCount > 0;

    useEffect(() => { graphRef.current = graph; }, [graph]);
    useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);
    useEffect(() => { onEdgeClickRef.current = onEdgeClick; }, [onEdgeClick]);

    useEffect(() => {
        if (!graph) return;
        if (panel) {
            const updated = graph.nodes.find(n => String(n.id) === String(panel.id));
            if (updated) setPanel(updated);
        }
        if (panelEdge) {
            const updated = graph.edges
                .map(normalizeEdge)
                .find(e =>
                    e.s === panelEdge.s &&
                    e.t === panelEdge.t &&
                    String(e.r ?? "") === String(panelEdge.r ?? "")
                );
            if (updated) setPanelEdge(updated);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [graph]);

    useEffect(() => {
        if (!graph || !containerRef.current) return;

        Promise.all([
            import("vis-network"),
            import("vis-data")
        ])
            .then(([{ Network }, { DataSet }]) => {
                if (!containerRef.current) return;

                // ── Nodes ──────────────────────────────────────────────────────────
                const nodes = graph.nodes
                    .filter(n => n.status !== "invalid")
                    .map(n => {
                        const nid = String(n.id);
                        const isPathNode = hlNodeSet.has(nid);
                        const dim = hasHighlight && !isPathNode;
                        const cat = colorForKey(String(n.type ?? "default"));
                        const bg = dim ? shade(cat, 0.65) : `${cat}33`;
                        const borderCol = dim ? shade(cat, 0.45) : cat;
                        return {
                            id: nid,
                            label: n.label,
                            title: n.label,
                            color: {
                                background: bg,
                                border: isPathNode ? C.white : borderCol,
                                highlight: { background: `${cat}55`, border: C.white },
                                hover: { background: `${cat}45`, border: C.white },
                            },
                            font: {
                                color: dim ? C.muted : C.text,
                                size: compact ? 11 : 12,
                                face: "Inter, system-ui, sans-serif",
                            },
                            shape: "dot",
                            size: isPathNode ? (compact ? 16 : 19) : (compact ? 11 : 14),
                            borderWidth: isPathNode ? 3 : 2,
                            shadow: {
                                enabled: true,
                                color: `${cat}55`,
                                size: isPathNode ? 14 : 6,
                                x: 0, y: 0,
                            },
                            opacity: dim ? 0.35 : 1,
                        };
                    });

                // ── Edges ──────────────────────────────────────────────────────────
                const normalizedEdges = (graph.edges || []).map(normalizeEdge);
                const validNodeIds = new Set(nodes.map(n => n.id));
                const filteredEdges = normalizedEdges.filter(
                    e => validNodeIds.has(e.s) && validNodeIds.has(e.t)
                );
                edgeDataRef.current = filteredEdges;

                const edges = filteredEdges
                    .map((e, idx) => {
                        const rel = localName(e.r ?? "");
                        const isHl =
                            hlEdgeSet.has(`${e.s}::${rel}::${e.t}`) ||
                            hlEdgeSet.has(`${e.s}::::${e.t}`);
                        const dim = hasHighlight && !isHl;
                        const relCat = colorForKey(rel || "related");
                        const edgeCol = isHl ? C.red : dim ? shade(relCat, 0.6) : relCat;

                        return {
                            id: idx,
                            from: e.s,
                            to: e.t,
                            label: rel || "",
                            color: {
                                color: edgeCol,
                                highlight: isHl ? C.red : C.white,
                                hover: isHl ? C.red : C.white,
                                opacity: dim ? 0.25 : isHl ? 1 : 0.85,
                            },
                            width: isHl ? 4.5 : 1.8,
                            shadow: isHl
                                ? { enabled: true, color: `${C.red}80`, size: 10, x: 0, y: 0 }
                                : { enabled: true, color: `${relCat}40`, size: 3, x: 0, y: 0 },
                            font: isHl
                                ? {
                                    color: C.red, size: 11.5,
                                    face: "Inter, system-ui, sans-serif",
                                    align: "middle", strokeWidth: 4, strokeColor: C.bg2,
                                    bold: true,
                                }
                                : {
                                    color: dim ? shade(relCat, 0.4) : relCat,
                                    size: 10,
                                    face: "Inter, system-ui, sans-serif",
                                    align: "middle", strokeWidth: 3, strokeColor: C.bg,
                                },
                            arrows: {
                                to: { enabled: true, scaleFactor: isHl ? 1.2 : 0.8, type: "arrow" },
                            },
                            smooth: { type: "continuous", roundness: 0.15, forceDirection: "none" },
                            _isHl: isHl,
                        };
                    })
                    // Highlighted edges render on top
                    .sort((a, b) => (a._isHl === b._isHl ? 0 : a._isHl ? 1 : -1))
                    .map(({ _isHl, ...edge }) => edge);

                // ── Network ────────────────────────────────────────────────────────
                if (networkRef.current) networkRef.current.destroy();
                const nodeDS = new DataSet(nodes);
                const edgeDS = new DataSet(edges);

                const options = {
                    nodes: { shape: "dot", size: compact ? 11 : 14 },
                    edges: { smooth: { type: "curvedCW", roundness: 0.2 } },
                    physics: {
                        stabilization: { iterations: compact ? 90 : 180 },
                        barnesHut: {
                            gravitationalConstant: -5000,
                            springLength: compact ? 80 : 120,
                        },
                    },
                    interaction: { hover: true, tooltipDelay: 200, zoomView: true, dragView: true },
                    layout: { improvedLayout: true },
                };

                const network = new Network(
                    containerRef.current,
                    {
                        nodes: nodeDS as unknown as VisDataSet<any>,
                        edges: edgeDS as unknown as VisDataSet<any>,
                    },
                    options
                );
                networkRef.current = network;

                // Freeze physics after initial layout
                network.once("stabilizationIterationsDone", () => {
                    network.setOptions({ physics: false });
                    network.fit({ animation: { duration: 300, easingFunction: "easeInOutQuad" } });
                });

                // Re-enable physics only while dragging a node
                network.on("dragStart", (params: any) => {
                    if (params.nodes.length > 0) network.setOptions({ physics: { enabled: true } });
                });
                network.on("dragEnd", (params: any) => {
                    if (params.nodes.length > 0) network.setOptions({ physics: false });
                });

                // ── Click handlers ─────────────────────────────────────────────────
                network.on("click", (params: any) => {
                    if (params.nodes.length > 0) {
                        const nodeId = params.nodes[0];
                        const node = graphRef.current?.nodes.find(n => String(n.id) === String(nodeId));
                        if (node) {
                            const domPos = params.event.center;
                            setPanel(node);
                            setPanelPos({ x: domPos.x + 12, y: domPos.y - 10 });
                            onNodeClickRef.current?.(node);
                        }
                        setPanelEdge(null);
                    } else if (params.edges.length > 0) {
                        const edgeId = params.edges[0];
                        const originalEdge = edgeDataRef.current[edgeId];
                        if (originalEdge) {
                            const domPos = params.event.center;
                            setPanelEdge(originalEdge);
                            setPanelEdgePos({ x: domPos.x + 12, y: domPos.y - 10 });
                            onEdgeClickRef.current?.(originalEdge);
                        }
                        setPanel(null);
                    } else {
                        setPanel(null);
                        setPanelEdge(null);
                    }
                });

                network.on("hoverNode", (params: any) => {
                    const node = graphRef.current?.nodes.find(n => String(n.id) === String(params.node));
                    setHoveredLabel(node?.label ?? String(params.node));
                });
                network.on("blurNode", () => setHoveredLabel(null));
            });

        return () => {
            if (networkRef.current) {
                networkRef.current.destroy();
                networkRef.current = null;
            }
        };
        // hlKey encodes the full highlight state
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [graph, hlKey, compact]);

    useEffect(() => {
        if (compact) return;
        const results = runSearch(graph, searchQuery);
        setSearchResults(results);
        setSearchOpen(searchQuery.trim().length > 0);
    }, [searchQuery, graph, compact]);

    const applySearchHighlight = useCallback(
        (nodeIds: Set<string>, edgeIndices: Set<number>) => {
            const net = networkRef.current;
            if (!net) return;
            const nodeUpdates = (graphRef.current?.nodes ?? [])
                .filter(n => n.status !== "invalid")
                .map(n => {
                    const matched = nodeIds.has(String(n.id));
                    const cat = colorForKey(String(n.type ?? "default"));
                    return {
                        id: String(n.id),
                        color: matched
                            ? {
                                background: `${cat}55`, border: C.white,
                                highlight: { background: `${cat}66`, border: C.white },
                            }
                            : {
                                background: `${cat}33`, border: cat,
                                highlight: { background: `${cat}55`, border: C.white },
                            },
                        size: matched ? 20 : 14,
                    };
                });
            const edgeUpdates = edgeDataRef.current.map((e, idx) => {
                const matched = edgeIndices.has(idx);
                const relCat = colorForKey(localName(e.r) || "related");
                return {
                    id: idx,
                    color: matched
                        ? { color: C.white, highlight: C.white }
                        : { color: relCat, highlight: C.white },
                    width: matched ? 3 : 1.8,
                };
            });
            try {
                (net as any).body.data.nodes.update(nodeUpdates);
                (net as any).body.data.edges.update(edgeUpdates);
            } catch (_) { /* empty */ }
        },
        [],
    );

    useEffect(() => {
        if (compact) return;
        if (!searchQuery.trim()) {
            applySearchHighlight(new Set(), new Set());
            return;
        }
        const nodeIds = new Set(searchResults.nodes.map(n => String(n.id)));
        const edgeIdxSet = new Set(
            searchResults.edges
                .map(e => {
                    const ne = normalizeEdge(e);
                    return edgeDataRef.current.findIndex(
                        ed => ed.s === ne.s && ed.t === ne.t && ed.r === ne.r
                    );
                })
                .filter(i => i !== -1)
        );
        applySearchHighlight(nodeIds, edgeIdxSet);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchResults, searchQuery, compact]);

    const jumpToNode = useCallback((node: GraphNode) => {
        const net = networkRef.current;
        if (net) {
            net.focus(String(node.id), {
                scale: 1.6,
                animation: { duration: 500, easingFunction: "easeInOutQuad" },
            });
            net.selectNodes([String(node.id)]);
        }
        setPanel(node);
        const rect = containerRef.current?.getBoundingClientRect();
        setPanelPos({ x: (rect?.width ?? 400) / 2 - 140, y: 80 });
        setPanelEdge(null);
        setSearchOpen(false);
    }, []);

    const jumpToEdge = useCallback((edge: NormalizedEdge) => {
        const ne = normalizeEdge(edge);
        const net = networkRef.current;
        const idx = edgeDataRef.current.findIndex(
            e => e.s === ne.s && e.t === ne.t && e.r === ne.r
        );
        if (net && idx !== -1) {
            net.selectEdges([idx]);
            net.fit({ nodes: [ne.s, ne.t], animation: { duration: 500, easingFunction: "easeInOutQuad" } });
        }
        setPanelEdge(ne);
        const rect = containerRef.current?.getBoundingClientRect();
        setPanelEdgePos({ x: (rect?.width ?? 400) / 2 - 150, y: 80 });
        setPanel(null);
        setSearchOpen(false);
    }, []);

    useEffect(() => {
        if (compact) return;
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setSearchOpen(false);
                setSearchFocused(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [compact]);

    const flattenProps = (obj: Record<string, unknown>, prefix = ""): Record<string, string> => {
        const result: Record<string, string> = {};
        for (const [k, v] of Object.entries(obj)) {
            const key = prefix ? `${prefix}.${k}` : k;
            if (typeof v === "object" && v !== null && !Array.isArray(v)) {
                Object.assign(result, flattenProps(v as Record<string, unknown>, key));
            } else {
                result[key] = String(v);
            }
        }
        return result;
    };

    const getNodeProps = (node: GraphNode | null): Record<string, unknown> => {
        if (!node) return {};
        const props: Record<string, unknown> = { ...(node.node_properties || {}) };
        for (const [k, v] of Object.entries(node)) {
            if (!["id", "label", "type", "status", "_source_graph", "merged_into", "node_properties"].includes(k)) {
                props[k] = v;
            }
        }
        return flattenProps(props);
    };

    const getEdgeExtraProps = (edge: NormalizedEdge | null): Record<string, string> => {
        if (!edge?.edge_properties) return {};
        const props: Record<string, unknown> = { ...edge.edge_properties };
        if (edge.timestamp) props.timestamp = edge.timestamp;
        return flattenProps(props);
    };

    const getNodeLabel = (id: string | number | undefined): string => {
        const node = graph?.nodes.find(n => String(n.id) === String(id));
        return node?.label ?? String(id ?? "?");
    };

    const nodeCount = graph?.nodes?.filter(n => n.status !== "invalid").length ?? 0;
    const edgeCount = (graph?.edges || []).map(normalizeEdge).filter(e => e.s && e.t).length;
    const totalResults = searchResults.nodes.length + searchResults.edges.length;

    const HighlightMatch = ({ text, query }: { text: string; query: string }) => {
        if (!query) return <span>{text}</span>;
        const idx = text.toLowerCase().indexOf(query.toLowerCase());
        if (idx === -1) return <span>{text}</span>;
        return (
            <span>
                {text.slice(0, idx)}
                <mark style={{
                    background: `${C.accent}25`, color: C.accent,
                    borderRadius: 2, padding: "0 1px",
                }}>
                    {text.slice(idx, idx + query.length)}
                </mark>
                {text.slice(idx + query.length)}
            </span>
        );
    };

    return (
        <div style={{ ...styles.wrapper, ...(compact ? styles.wrapperCompact : undefined) }}>
            {!compact && (
                <div style={styles.statsBar}>
                    <div style={{ display: "flex", gap: 16, alignItems: "center", flex: 1, flexWrap: "wrap" }}>
                        <StatChip label="Nodes" value={nodeCount} color={C.accent} />
                        <StatChip label="Edges" value={edgeCount} color={C.green} />
                        <StatChip label="Graph" value={graphKey ?? ""} color={C.muted} />
                        {hasHighlight && (
                            <StatChip
                                label="Traced"
                                value={`${hlNodeSet.size} nodes · ${hlEdgeCount} edges`}
                                color={C.red}
                            />
                        )}
                        {hoveredLabel && <StatChip label="Hover" value={hoveredLabel} color={C.amber} />}
                    </div>

                    <div ref={searchRef} style={{ position: "relative", flexShrink: 0 }}>
                        <div style={{
                            display: "flex", alignItems: "center", gap: 8,
                            background: C.bg3,
                            border: `1px solid ${searchFocused ? C.accent : C.border}`,
                            borderRadius: 8, padding: "5px 10px",
                            transition: "border-color 0.15s",
                            minWidth: 220,
                            boxShadow: searchFocused ? `0 0 0 3px ${C.accent}18` : "none",
                        }}>
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                                <circle cx="8.5" cy="8.5" r="5.5"
                                    stroke={searchFocused ? C.accent : C.muted} strokeWidth="2" />
                                <line x1="13" y1="13" x2="18" y2="18"
                                    stroke={searchFocused ? C.accent : C.muted} strokeWidth="2"
                                    strokeLinecap="round" />
                            </svg>
                            <input
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onFocus={() => {
                                    setSearchFocused(true);
                                    if (searchQuery.trim()) setSearchOpen(true);
                                }}
                                placeholder="Search nodes & edges…"
                                style={{
                                    background: "none", border: "none", outline: "none",
                                    color: C.text, fontFamily: "inherit", fontSize: 13,
                                    flex: 1, minWidth: 0,
                                }}
                                spellCheck={false}
                            />
                            {searchQuery.trim() && (
                                <span style={{
                                    background: C.accent, color: "#fff",
                                    fontFamily: "inherit", fontSize: 10, fontWeight: 600,
                                    padding: "1px 6px", borderRadius: 8, flexShrink: 0,
                                }}>
                                    {totalResults}
                                </span>
                            )}
                            {searchQuery && (
                                <button
                                    onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                                    style={{
                                        background: "none", border: "none", color: C.muted,
                                        cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0,
                                    }}
                                >
                                    ×
                                </button>
                            )}
                        </div>

                        {searchOpen && searchQuery.trim() && (
                            <div style={styles.dropdown}>
                                {totalResults === 0 ? (
                                    <div style={{ padding: "16px 12px", color: C.muted, fontSize: 13, textAlign: "center" }}>
                                        No matches found
                                    </div>
                                ) : (
                                    <>
                                        {searchResults.nodes.length > 0 && (
                                            <>
                                                <div style={styles.ddSection}>
                                                    Nodes <span style={styles.ddCount}>{searchResults.nodes.length}</span>
                                                </div>
                                                {searchResults.nodes.map(node => {
                                                    const cat = colorForKey(String(node.type ?? "default"));
                                                    return (
                                                        <button
                                                            key={node.id}
                                                            style={styles.ddRow}
                                                            onClick={() => jumpToNode(node)}
                                                            onMouseEnter={e => (e.currentTarget.style.background = C.bg3)}
                                                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                                        >
                                                            <span style={{ fontSize: 12, color: cat }}>●</span>
                                                            <span style={{ fontSize: 12, color: C.text }}>
                                                                <HighlightMatch text={node.label ?? String(node.id)} query={searchQuery} />
                                                            </span>
                                                            {node.type && (
                                                                <span style={{
                                                                    marginLeft: "auto", fontSize: 10, color: cat,
                                                                    background: `${cat}22`, padding: "1px 6px", borderRadius: 4,
                                                                }}>
                                                                    {node.type}
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </>
                                        )}
                                        {searchResults.edges.length > 0 && (
                                            <>
                                                <div style={styles.ddSection}>
                                                    Edges <span style={styles.ddCount}>{searchResults.edges.length}</span>
                                                </div>
                                                {searchResults.edges.map((edge, i) => {
                                                    const ne = normalizeEdge(edge);
                                                    const relCat = colorForKey(localName(ne.r ?? "") || "related");
                                                    return (
                                                        <button
                                                            key={i}
                                                            style={styles.ddRow}
                                                            onClick={() => jumpToEdge(ne)}
                                                            onMouseEnter={e => (e.currentTarget.style.background = C.bg3)}
                                                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                                        >
                                                            <span style={{ fontSize: 11, color: relCat }}>→</span>
                                                            <span style={{ fontSize: 11, color: C.text, display: "flex", gap: 4, flexWrap: "wrap" }}>
                                                                <span style={{ color: C.blue }}>
                                                                    <HighlightMatch text={getNodeLabel(ne.s)} query={searchQuery} />
                                                                </span>
                                                                <span style={{ color: relCat }}>
                                                                    <HighlightMatch text={localName(ne.r ?? "")} query={searchQuery} />
                                                                </span>
                                                                <span style={{ color: C.blue }}>
                                                                    <HighlightMatch text={getNodeLabel(ne.t)} query={searchQuery} />
                                                                </span>
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Canvas — stopPropagation on wheel so compact graphs don't scroll parent */}
            <div
                ref={containerRef}
                style={{
                    ...styles.canvas,
                    ...(canvasHeight !== undefined
                        ? { height: canvasHeight }
                        : { flex: 1, minHeight: 0 }),
                }}
                onWheel={e => e.stopPropagation()}
            />


            {/* Node detail panel */}
            {panel && (
                <div style={{
                    ...styles.floatPanel,
                    borderTop: `3px solid ${C.accent}`,
                    left: Math.min(panelPos.x, (typeof window !== "undefined" ? window.innerWidth : 800) - 310),
                    top: Math.min(panelPos.y, (typeof window !== "undefined" ? window.innerHeight : 600) - 300),
                }}>
                    <div style={styles.floatHeader}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: C.navy }}>{panel.label}</span>
                        <button style={styles.floatClose} onClick={() => setPanel(null)}>×</button>
                    </div>
                    <span style={{
                        display: "inline-block",
                        background: `${colorForKey(String(panel.type ?? "default"))}22`,
                        color: colorForKey(String(panel.type ?? "default")),
                        fontSize: 10, fontWeight: 600, borderRadius: 4,
                        padding: "2px 7px", marginBottom: 10,
                    }}>
                        {panel.type || "Unknown"}
                    </span>
                    {Object.entries(flattenProps(getNodeProps(panel))).map(([k, v]) => (
                        <div key={k} style={styles.propRow}>
                            <span style={{ color: C.muted, fontSize: 11, minWidth: 90, flexShrink: 0 }}>{k}</span>
                            <span style={{ color: C.text, fontSize: 11, wordBreak: "break-all" }}>{v}</span>
                        </div>
                    ))}
                    {Object.keys(flattenProps(getNodeProps(panel))).length === 0 && (
                        <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>No additional properties</div>
                    )}
                </div>
            )}

            {/* Edge detail panel */}
            {panelEdge && (
                <div style={{
                    ...styles.floatPanel,
                    borderTop: `3px solid ${C.amber}`,
                    left: Math.min(panelEdgePos.x, (typeof window !== "undefined" ? window.innerWidth : 800) - 310),
                    top: Math.min(panelEdgePos.y, (typeof window !== "undefined" ? window.innerHeight : 600) - 300),
                }}>
                    <div style={styles.floatHeader}>
                        <span style={{ fontWeight: 600, fontSize: 12, color: C.navy }}>Edge</span>
                        <button style={styles.floatClose} onClick={() => setPanelEdge(null)}>×</button>
                    </div>
                    <div style={{
                        display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap",
                        marginBottom: 10, padding: "6px 10px",
                        background: C.bg3, borderRadius: 6, fontSize: 11,
                    }}>
                        <span style={{ color: C.blue, fontWeight: 500 }}>{getNodeLabel(panelEdge.s)}</span>
                        <span style={{ color: colorForKey(localName(panelEdge.r) || "related") }}>
                            → {localName(panelEdge.r)} →
                        </span>
                        <span style={{ color: C.blue, fontWeight: 500 }}>{getNodeLabel(panelEdge.t)}</span>
                    </div>
                    {Object.entries(getEdgeExtraProps(panelEdge)).map(([k, v]) => (
                        <div key={k} style={styles.propRow}>
                            <span style={{ color: C.muted, fontSize: 11, minWidth: 90, flexShrink: 0 }}>{k}</span>
                            <span style={{ color: C.text, fontSize: 11, wordBreak: "break-all" }}>{v}</span>
                        </div>
                    ))}
                    {Object.keys(getEdgeExtraProps(panelEdge)).length === 0 && (
                        <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>No additional properties</div>
                    )}
                </div>
            )}
        </div>
    );
}

function StatChip({ label, value, color }: { label: string; value: string | number; color: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 11, color: C.muted }}>{label}:</span>
            <span style={{ fontSize: 12, fontWeight: 600, color }}>{value}</span>
        </div>
    );
}

const styles: Record<string, CSSProperties> = {
wrapper: {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  overflow: "hidden",
  height: "100%",
},
    wrapperCompact: {
        borderRadius: 14,
        boxShadow: "0 2px 10px rgba(0,0,0,0.45)",
    },
    statsBar: {
        display: "flex", alignItems: "center", gap: 16,
        padding: "8px 14px",
        borderBottom: `1px solid ${C.border}`,
        background: C.bg2,
        flexWrap: "wrap",
    },
    canvas: { width: "100%", background: C.bg },
    dropdown: {
        position: "absolute",
        top: "calc(100% + 6px)", right: 0,
        width: 340,
        background: C.bg2,
        border: `1px solid ${C.border}`,
        borderTop: `2px solid ${C.accent}`,
        borderRadius: 10,
        boxShadow: "0 8px 24px rgba(0,0,0,0.55)",
        zIndex: 200, maxHeight: 320, overflowY: "auto",
    },
    ddSection: {
        display: "flex", alignItems: "center", gap: 6,
        padding: "6px 12px 4px",
        fontFamily: "inherit", fontSize: 11, fontWeight: 600,
        letterSpacing: "0.5px", color: C.muted,
        textTransform: "uppercase",
        borderBottom: `1px solid ${C.border}`,
        position: "sticky", top: 0, background: C.bg2, zIndex: 1,
    },
    ddCount: {
        background: C.bg3, color: C.muted,
        fontSize: 10, padding: "1px 6px",
        borderRadius: 8, fontWeight: 500, marginLeft: "auto",
    },
    ddRow: {
        display: "flex", alignItems: "center", gap: 8,
        width: "100%", padding: "7px 12px",
        background: "transparent", border: "none",
        borderBottom: `1px solid ${C.border}`,
        cursor: "pointer", textAlign: "left",
        transition: "background 0.1s", fontFamily: "inherit",
    },
    floatPanel: {
        position: "absolute", width: 280,
        background: C.bg2, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: 14, fontFamily: "inherit",
        zIndex: 100, boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        maxHeight: 320, overflowY: "auto",
    },
    floatHeader: {
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.border}`,
    },
    floatClose: {
        background: "none", border: "none", color: C.muted,
        cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0, fontWeight: 300,
    },
    propRow: {
        display: "flex", gap: 10,
        borderBottom: `1px solid ${C.bg3}`,
        padding: "4px 0", alignItems: "flex-start",
    },
};