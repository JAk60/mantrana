'use client'

import {
    Line, LineChart, CartesianGrid, Legend,
    ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine,
} from 'recharts'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Reading {
    date: string
    value: number
    alert: boolean
    operating_hours: number
}

interface SensorResult {
    sensor_id: string
    sensor_name: string
    nomenclature: string
    ship: string
    component_id: string
    readings: Reading[]
    min_value: number
    max_value: number
    unit: string
}

interface ToolCall {
    name: string
    result?: { data?: { results?: SensorResult[] } }
}

interface ChartPoint {
    timestamp: string
    value: number
    alert: boolean
    operating_hours: number
    fullDate: string
}

interface ProcessedSensor {
    id: string
    data: ChartPoint[]
    minValue: number
    maxValue: number
    unit: string
    sensorName: string
    nomenclature: string
    ship: string
    isOutOfBounds: boolean
    latestValue: number | undefined
}

interface BrushIndexes { startIndex: number; endIndex: number }
interface SensorState  { brushIndexes: BrushIndexes }

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, unit }: any) {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
        <div className="bg-white border border-gray-300 rounded-lg p-3 shadow-lg text-sm">
            <p className="font-medium text-gray-900">{d.timestamp}</p>
            <p className={`font-semibold ${d.alert ? 'text-red-500' : 'text-blue-600'}`}>
                Value: {d.value} {unit}
            </p>
            <p className="text-gray-600">Operating Hours: {d.operating_hours}</p>
            {d.alert && <p className="text-xs text-red-500 mt-1 font-semibold">⚠ Alert Triggered</p>}
        </div>
    )
}

// ─── Custom Dot ───────────────────────────────────────────────────────────────

function CustomDot({ cx, cy, index, payload, totalLength, endIndex, sensorId, dataLength }: any) {
    if (cx == null || cy == null || index == null || !payload) return null
    const isLast        = index === totalLength - 1
    const isShowingLast = endIndex === dataLength - 1
    return (
        <circle
            key={`dot-${sensorId}-${index}`}
            cx={cx} cy={cy}
            r={isLast && isShowingLast ? 6 : payload.alert ? 4 : 3}
            fill={payload.alert ? '#ef4444' : '#25547e'}
            stroke={isLast && isShowingLast ? '#fff' : 'none'}
            strokeWidth={2}
        />
    )
}

// ─── Custom SVG Navigator ─────────────────────────────────────────────────────

const NAV_H = 64
const HANDLE_W = 10

interface NavigatorProps {
    data: ChartPoint[]
    startIndex: number
    endIndex: number
    onChange: (b: BrushIndexes) => void
}

function Navigator({ data, startIndex, endIndex, onChange }: NavigatorProps) {
    const svgRef   = useRef<SVGSVGElement>(null)
    const dragRef  = useRef<{ type: 'left' | 'right' | 'window'; x0: number; s0: number; e0: number } | null>(null)
    const [width, setWidth] = useState(600)

    useEffect(() => {
        if (!svgRef.current) return
        const ro = new ResizeObserver(entries => setWidth(entries[0].contentRect.width))
        ro.observe(svgRef.current)
        return () => ro.disconnect()
    }, [])

    const n      = data.length
    const PAD    = HANDLE_W / 2
    const innerW = width - HANDLE_W

    const ix2x = (i: number) => PAD + (i / (n - 1)) * innerW
    const x2ix = (x: number) => Math.round(Math.max(0, Math.min(n - 1, ((x - PAD) / innerW) * (n - 1))))

    const values  = data.map(d => d.value)
    const vMin    = Math.min(...values)
    const vMax    = Math.max(...values)
    const vRange  = vMax - vMin || 1
    const VPAD    = 6
    const v2y     = (v: number) => VPAD + ((vMax - v) / vRange) * (NAV_H - VPAD * 2)

    const polyline = data.map((d, i) => `${ix2x(i)},${v2y(d.value)}`).join(' ')

    const x1 = ix2x(startIndex)
    const x2 = ix2x(endIndex)

    const onMouseDown = (e: React.MouseEvent, type: 'left' | 'right' | 'window') => {
        e.preventDefault()
        dragRef.current = { type, x0: e.clientX, s0: startIndex, e0: endIndex }
        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup',   onMouseUp)
    }

    const onMouseMove = (e: MouseEvent) => {
        if (!dragRef.current) return
        const { type, x0, s0, e0 } = dragRef.current
        const dx   = e.clientX - x0
        const dIdx = Math.round((dx / innerW) * (n - 1))

        if (type === 'left') {
            const ns = Math.max(0, Math.min(e0 - 1, s0 + dIdx))
            onChange({ startIndex: ns, endIndex: e0 })
        } else if (type === 'right') {
            const ne = Math.max(s0 + 1, Math.min(n - 1, e0 + dIdx))
            onChange({ startIndex: s0, endIndex: ne })
        } else {
            const span = e0 - s0
            const ns   = Math.max(0, Math.min(n - 1 - span, s0 + dIdx))
            onChange({ startIndex: ns, endIndex: ns + span })
        }
    }

    const onMouseUp = () => {
        dragRef.current = null
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup',   onMouseUp)
    }

    const onTouchStart = (e: React.TouchEvent, type: 'left' | 'right' | 'window') => {
        dragRef.current = { type, x0: e.touches[0].clientX, s0: startIndex, e0: endIndex }
        window.addEventListener('touchmove', onTouchMove, { passive: false })
        window.addEventListener('touchend',  onTouchEnd)
    }
    const onTouchMove = (e: TouchEvent) => {
        e.preventDefault()
        const me = { clientX: e.touches[0].clientX } as MouseEvent
        onMouseMove(me)
    }
    const onTouchEnd = () => {
        dragRef.current = null
        window.removeEventListener('touchmove', onTouchMove)
        window.removeEventListener('touchend',  onTouchEnd)
    }

    return (
        <svg
            ref={svgRef}
            width="100%"
            height={NAV_H}
            style={{ display: 'block', cursor: 'default' }}
        >
            <rect x={0} y={0} width={width} height={NAV_H} fill="#f1f5f9" rx={6} />
            <rect x={0}  y={0} width={Math.max(0, x1)} height={NAV_H} fill="rgba(0,0,0,0.08)" rx={4} />
            <rect x={x2} y={0} width={Math.max(0, width - x2)} height={NAV_H} fill="rgba(0,0,0,0.08)" rx={4} />
            <polyline
                points={polyline}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={1.8}
                strokeLinejoin="round"
            />
            {data.map((d, i) =>
                d.alert ? (
                    <circle key={i} cx={ix2x(i)} cy={v2y(d.value)} r={3} fill="#ef4444" />
                ) : null
            )}
            <rect
                x={x1} y={0}
                width={Math.max(0, x2 - x1)}
                height={NAV_H}
                fill="rgba(59,130,246,0.12)"
                stroke="#1e40af"
                strokeWidth={1}
                style={{ cursor: 'grab' }}
                onMouseDown={e => onMouseDown(e, 'window')}
                onTouchStart={e => onTouchStart(e, 'window')}
            />
            <rect
                x={x1 - HANDLE_W / 2} y={0}
                width={HANDLE_W} height={NAV_H}
                rx={3}
                fill="#1e40af"
                style={{ cursor: 'ew-resize' }}
                onMouseDown={e => onMouseDown(e, 'left')}
                onTouchStart={e => onTouchStart(e, 'left')}
            />
            <line x1={x1} y1={NAV_H * 0.25} x2={x1} y2={NAV_H * 0.75} stroke="white" strokeWidth={2} strokeLinecap="round" style={{ pointerEvents: 'none' }} />
            <rect
                x={x2 - HANDLE_W / 2} y={0}
                width={HANDLE_W} height={NAV_H}
                rx={3}
                fill="#1e40af"
                style={{ cursor: 'ew-resize' }}
                onMouseDown={e => onMouseDown(e, 'right')}
                onTouchStart={e => onTouchStart(e, 'right')}
            />
            <line x1={x2} y1={NAV_H * 0.25} x2={x2} y2={NAV_H * 0.75} stroke="white" strokeWidth={2} strokeLinecap="round" style={{ pointerEvents: 'none' }} />
        </svg>
    )
}

// ─── Natural Sort Helper ──────────────────────────────────────────────────────
// Splits strings like "GT_S3" into ["GT_S", "3"] so numeric chunks are compared
// as integers — gives correct GT_S1 → GT_S2 → GT_S3 ordering.

function naturalSort(x: string, y: string): number {
    const re = /(\d+)|(\D+)/g
    const ax = x.match(re) ?? []
    const bx = y.match(re) ?? []
    for (let i = 0; i < Math.max(ax.length, bx.length); i++) {
        if (ax[i] === undefined) return -1
        if (bx[i] === undefined) return 1
        const an = Number(ax[i])
        const bn = Number(bx[i])
        if (!isNaN(an) && !isNaN(bn) && an !== bn) return an - bn
        const cmp = ax[i].localeCompare(bx[i], undefined, { sensitivity: 'base' })
        if (cmp !== 0) return cmp
    }
    return 0
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SensorChart({
    ship,
    toolCalls,
    shipOrder,
}: {
    ship:string
    toolCalls: ToolCall[]
    shipOrder?: string[]
}) {
    const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({})
    const [sensorStates,   setSensorStates]   = useState<Record<string, SensorState>>({})

    const sensorsData = useMemo<ProcessedSensor[]>(() => {
        if (!toolCalls || !Array.isArray(toolCalls)) return []
        const tool = toolCalls.find(t => t.name === 'get_sensor_readings')
        if (!tool?.result?.data) return []
        const results: SensorResult[] = tool.result.data.results ?? []

        return results
            .filter(r => r.readings?.length)
            .map((r) => {
                const chartData: ChartPoint[] = [...r.readings]
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map(rd => ({
                        timestamp: new Date(rd.date).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                        }),
                        value: rd.value,
                        alert: rd.alert,
                        operating_hours: rd.operating_hours,
                        fullDate: rd.date,
                    }))

                const latest        = chartData[chartData.length - 1]
                const isOutOfBounds = latest
                    ? latest.value < r.min_value || latest.value > r.max_value
                    : false

                return {
                    id: `sensor-${r.sensor_id}`,
                    data: chartData,
                    minValue: r.min_value,
                    maxValue: r.max_value,
                    unit: r.unit ?? '',
                    sensorName: r.sensor_name,
                    nomenclature: r.nomenclature,
                    ship: ship,
                    isOutOfBounds,
                    latestValue: latest?.value,
                }
            })
            .sort((a, b) => {
                // Priority 1 & 2 — shipOrder mention order / known vs unknown
                const aIdx = shipOrder
                    ? shipOrder.findIndex(s => s.toLowerCase() === a.ship.toLowerCase())
                    : -1
                const bIdx = shipOrder
                    ? shipOrder.findIndex(s => s.toLowerCase() === b.ship.toLowerCase())
                    : -1

                if (aIdx !== -1 && bIdx !== -1 && aIdx !== bIdx) return aIdx - bIdx
                if (aIdx !== -1 && bIdx === -1) return -1
                if (aIdx === -1 && bIdx !== -1) return 1

                // Priority 3 — alphabetical ship name (case-insensitive fallback)
                const shipCmp = a.ship.localeCompare(b.ship, undefined, { sensitivity: 'base' })
                if (shipCmp !== 0) return shipCmp

                // Priority 4 — natural sort on nomenclature within the same ship
                const nomenclatureCmp = naturalSort(a.nomenclature, b.nomenclature)
                if (nomenclatureCmp !== 0) return nomenclatureCmp

                // Priority 5 — natural sort on sensor name within the same nomenclature
                return naturalSort(a.sensorName, b.sensorName)
            })
    }, [toolCalls, shipOrder])

    useEffect(() => {
        if (!sensorsData.length) return
        const states: Record<string, SensorState> = {}
        const opens:  Record<string, boolean>      = {}
        sensorsData.forEach((s, i) => {
            const n = s.data.length
            states[s.id] = { brushIndexes: { startIndex: Math.max(0, n - 50), endIndex: n - 1 } }
            opens[s.id]  = i === 0
        })
        setSensorStates(states)
        setOpenAccordions(opens)
    }, [sensorsData])

    const toggleAccordion = useCallback((id: string) =>
        setOpenAccordions(p => ({ ...p, [id]: !p[id] })), [])

    const handleBrushChange = useCallback((id: string, b: BrushIndexes) =>
        setSensorStates(p => ({ ...p, [id]: { ...p[id], brushIndexes: b } })), [])

    const setTimeRange = useCallback((id: string, n: number, range: string) => {
        const startIndex = range === '24h'  ? Math.max(0, n - 24)
                         : range === '7d'   ? Math.max(0, n - 168)
                         : range === '30d'  ? Math.max(0, n - 720)
                         : 0
        setSensorStates(p => ({ ...p, [id]: { ...p[id], brushIndexes: { startIndex, endIndex: n - 1 } } }))
    }, [])

    if (!sensorsData.length) return null

    return (
        <div className="w-full mt-6 space-y-4">
            <style>{`
                @keyframes borderBlink {
                    0%,49%  { border-color: #dc2626; }
                    50%,100%{ border-color: transparent; }
                }
                .border-blink { border: 2px solid #dc2626; animation: borderBlink 1s step-end infinite; }
            `}</style>

            {sensorsData.map(sensor => {
                const state = sensorStates[sensor.id]
                if (!state) return null

                const isOpen = openAccordions[sensor.id]
                const { startIndex, endIndex } = state.brushIndexes
                const filteredData = sensor.data.slice(startIndex, endIndex + 1)

                const allV    = sensor.data.map(d => d.value)
                const padding = (sensor.maxValue - sensor.minValue) * 0.3 || 1
                const yMin    = Math.floor(Math.min(sensor.minValue - padding, Math.min(...allV) - padding))
                const yMax    = Math.ceil (Math.max(sensor.maxValue + padding, Math.max(...allV) + padding))
                const step    = Math.ceil((yMax - yMin) / 5)
                const tickSet = new Set<number>([yMin, yMax, sensor.minValue, sensor.maxValue])
                for (let v = yMin; v <= yMax; v += step) tickSet.add(v)
                const yTicks  = Array.from(tickSet).sort((a, b) => a - b)

                return (
                    <div key={sensor.id} className="w-full rounded-lg overflow-hidden bg-white shadow-sm border border-gray-300">

                        {/* ── Header ── */}
                        <button
                            onClick={() => toggleAccordion(sensor.id)}
                            className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white hover:from-blue-100 hover:to-blue-50 transition-colors"
                        >
                            <div className="flex items-center gap-4 flex-1">
                                <div className="flex flex-col items-start">
                                    <h3 className="text-xl font-semibold text-gray-900">{sensor.nomenclature}</h3>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-sm text-gray-600">{sensor.ship} • {sensor.sensorName}</span>
                                        {sensor.isOutOfBounds && (
                                            <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">Alert</span>
                                        )}
                                    </div>
                                </div>
                                <div className="ml-auto mr-4">
                                    <span className="text-3xl font-bold text-gray-900">{sensor.latestValue} {sensor.unit}</span>
                                </div>
                            </div>
                            {isOpen ? <ChevronUp className="w-6 h-6 text-gray-600" /> : <ChevronDown className="w-6 h-6 text-gray-600" />}
                        </button>

                        {isOpen && (
                            <div className="p-6 border-t border-gray-200">
                                <p className="text-sm text-gray-600 mb-6">
                                    {sensor.isOutOfBounds ? '⚠ Latest value exceeds threshold' : '✓ Operating within normal range'}
                                </p>

                                {/* ── Main chart ── */}
                                <div className={`rounded-lg overflow-hidden ${sensor.isOutOfBounds ? 'border-blink' : ''}`}>
                                    <ResponsiveContainer width="100%" height={400}>
                                        <LineChart data={filteredData} margin={{ top: 20, right: 80, left: 20, bottom: 40 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                            <XAxis dataKey="timestamp" tick={false}
                                                label={{ value: 'Date', position: 'insideBottom', offset: -10, fill: '#6b7280', fontSize: 13 }} />
                                            <YAxis tick={{ fontSize: 12 }} domain={[yMin, yMax]} ticks={yTicks}
                                                label={{ value: `${sensor.sensorName} (${sensor.unit})`, angle: -90, position: 'insideLeft', style: { fill: '#374151' } }} />
                                            <Tooltip content={<CustomTooltip unit={sensor.unit} />} />
                                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                            <ReferenceLine y={sensor.maxValue} stroke="#ef4444" strokeDasharray="5 5"
                                                label={{ value: `Max (${sensor.maxValue})`, position: 'right', fill: '#ef4444', fontSize: 11, fontWeight: 'bold' }} />
                                            <ReferenceLine y={sensor.minValue} stroke="#3b82f6" strokeDasharray="5 5"
                                                label={{ value: `Min (${sensor.minValue})`, position: 'right', fill: '#3b82f6', fontSize: 11, fontWeight: 'bold' }} />
                                            <Line type="monotone" dataKey="value" stroke="#25547e" strokeWidth={2.5}
                                                dot={({ key, ...props }) => (
                                                    <CustomDot key={key} {...props}
                                                        totalLength={filteredData.length} endIndex={endIndex}
                                                        sensorId={sensor.id} dataLength={sensor.data.length} />
                                                )}
                                                isAnimationActive={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* ── Navigator ── */}
                                <div className="rounded-lg border border-gray-300 bg-gray-50 p-4 mt-6">
                                    <h4 className="text-sm font-semibold mb-3 text-gray-700">Time Range Navigator</h4>
                                    <Navigator
                                        data={sensor.data}
                                        startIndex={startIndex}
                                        endIndex={endIndex}
                                        onChange={b => handleBrushChange(sensor.id, b)}
                                    />
                                </div>

                                {/* ── Quick-range buttons ── */}
                                <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2 flex-wrap">
                                    {(['24h', '7d', '30d', 'all'] as const).map(r => (
                                        <button key={r}
                                            onClick={() => setTimeRange(sensor.id, sensor.data.length, r)}
                                            className={`px-4 py-2 text-sm font-medium rounded-lg shadow-sm text-white transition-colors ${
                                                r === 'all' ? 'bg-gray-600 hover:bg-gray-700' : 'bg-blue-600 hover:bg-blue-700'
                                            }`}>
                                            {r === '24h' ? 'Last 24h' : r === '7d' ? 'Last 7 Days' : r === '30d' ? 'Last 30 Days' : 'All Data'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}