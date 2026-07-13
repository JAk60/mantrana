import React, { useState } from 'react'
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp, Minus } from 'lucide-react'

interface EquipmentResult {
  nomenclature: string
  system: string
  reliability: number
  alpha: number
  beta: number
  age_before: number
  age_after: number
  duration: number
  is_reused: boolean
}

interface AlternatePhase {
  phase_name: string
  sequence: number
  duration_hours: number
  phase_reliability: number
  equipment: EquipmentResult[]
}

interface SystemData {
  reliability: number | null
  critical_equipment: string[]
  k_of_n: string
  required: boolean
  equipment_reliabilities: Record<string, number>
}

interface OriginalPhase {
  phase_name: string
  sequence: number
  duration_hours: number
  phase_reliability: number
  systems: Record<string, SystemData>
}

interface ComparisonResult {
  comparison_id: string
  config_name: string
  ship_name: string
  mission_reliability: number
  total_duration: number
  phases: AlternatePhase[]
  equipment_final_ages: Record<string, number>
  // Each result carries its own NETRA baseline (the config it was saved against)
  netra_reliability?: number
}

interface OriginalConfig {
  config_id?: string
  config_name: string
  ship_name: string
  total_duration: number
  mission_reliability: number
  phases: OriginalPhase[]
  equipment_final_ages: Record<string, number>
}

interface Props {
  ship: string
  originalConfig: OriginalConfig
  results: ComparisonResult[]
}

const fmt = (v: number) => `${(v * 100).toFixed(2)}%`

function DeltaBadge({ original, alternate }: { original: number; alternate: number }) {
  const d = (alternate - original) * 100
  if (d > 0.001) return (
    <span className="flex items-center gap-1 text-gray-300 text-xs font-medium whitespace-nowrap">
      <TrendingUp className="w-3 h-3" />+{d.toFixed(2)}%
    </span>
  )
  if (d < -0.001) return (
    <span className="flex items-center gap-1 text-gray-300 text-xs font-medium whitespace-nowrap">
      <TrendingDown className="w-3 h-3" />{d.toFixed(2)}%
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-gray-500 text-xs whitespace-nowrap">
      <Minus className="w-3 h-3" />0.00%
    </span>
  )
}

export default function ComparisonResultsTable({ ship, originalConfig, results }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  if (!originalConfig || !results?.length) {
    return <div className="text-center py-12"><p className="text-gray-500">No comparison results available</p></div>
  }

  const originalPhases = [...(originalConfig.phases ?? [])].sort((a, b) => a.sequence - b.sequence)

  return (
    <div className="w-full space-y-4">

      {/* Page header */}
      <div className="rounded-lg border border-gray-800 bg-gray-950 px-6 py-4">
        <h2 className="text-lg font-bold text-white">Comparison Results</h2>
        <p className="text-xs text-gray-500 mt-1">
          Phase-wise breakdown — identify which phase causes the most reliability drop
        </p>
      </div>

      {results.map(result => {
        const isOpen = expanded.has(result.comparison_id)
        const altPhases = [...(result.phases ?? [])].sort((a, b) => a.sequence - b.sequence)

        // Use the per-result netra_reliability if present, else fall back to originalConfig
        const netraRel = result.netra_reliability ?? originalConfig.mission_reliability

        return (
          <div key={result.comparison_id} className="rounded-lg border border-gray-800 bg-gray-950 overflow-hidden">

            {/* Summary header */}
            <button
              onClick={() => toggle(result.comparison_id)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-900 transition-colors text-left"
            >
              <div className="flex items-center gap-8">
                <div>
                  <div className="font-semibold text-white">Strike</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {ship} • {result.total_duration}h
                  </div>
                </div>

                {/* Mission-level numbers — NETRA is per-result, User is the batch output */}
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">NETRA</div>
                    <div className="text-sm font-semibold text-white mt-0.5">
                      {fmt(netraRel)}
                    </div>
                  </div>
                  <span className="text-gray-600 text-lg">→</span>
                  <div className="text-center">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">User</div>
                    <div className="text-sm font-semibold text-white mt-0.5">
                      {fmt(result.mission_reliability)}
                    </div>
                  </div>
                  <DeltaBadge
                    original={netraRel}
                    alternate={result.mission_reliability}
                  />
                </div>
              </div>

              {isOpen
                ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
              }
            </button>

            {/* Phase-wise detail */}
            {isOpen && (
              <div className="border-t border-gray-800">

                <div className="grid grid-cols-[180px_1fr_1fr_120px] bg-gray-900 px-6 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <div>Phase</div>
                  <div>NETRA Recommendation</div>
                  <div>User Selection</div>
                  <div className="text-right">Phase Δ</div>
                </div>

                {originalPhases.map((origPhase, idx) => {
                  // FIX: was `?? a` (undefined variable) → proper fallback chain
                  const altPhase =
                    altPhases.find(p => p.sequence === origPhase.sequence && p.phase_name === origPhase.phase_name) ??
                    altPhases.find(p => p.sequence === origPhase.sequence) ??
                    altPhases.find(p => p.phase_name === origPhase.phase_name) ??
                    altPhases[idx]

                  // NETRA equipment from original config phases
                  const netraRows: Array<{ nomenclature: string; system: string; reliability: number | null }> = []
                  Object.entries(origPhase.systems ?? {}).forEach(([sysKey, sysData]) => {
                    if (!sysData.required) return
                      ; (sysData.critical_equipment ?? []).forEach(nom => {
                        netraRows.push({
                          nomenclature: nom,
                          system: sysKey,
                          reliability: sysData.equipment_reliabilities?.[nom] ?? null
                        })
                      })
                  })

                  const userRows = altPhase?.equipment ?? []
                  const origRel = origPhase.phase_reliability
                  const altRel = altPhase?.phase_reliability ?? null

                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-[180px_1fr_1fr_120px] px-6 py-4 border-b border-gray-800 last:border-0 items-start"
                    >
                      {/* Phase info */}
                      {/* Phase info */}
                      <div className="pr-4 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-gray-600">#{origPhase.sequence + 1}</span>
                          <span className="text-sm font-medium text-white">{origPhase.phase_name}</span>
                        </div>
                        <div className="text-xs text-gray-500">{origPhase.duration_hours}h</div>
                        {/* NETRA big number banner */}
                        <div className="rounded-md bg-gray-800/60 border border-gray-700 px-3 py-2 mt-1">
                          <div className="text-[9px] uppercase tracking-widest text-gray-500 mb-0.5">NETRA</div>
                          <div className="text-xl font-bold text-white tabular-nums leading-none">{fmt(origRel)}</div>
                        </div>
                      </div>

                      {/* NETRA equipment */}
                      <div className="pr-6">
                        {netraRows.length === 0 ? (
                          <span className="text-xs text-gray-600 italic">Not required this phase</span>
                        ) : (
                          <div className="space-y-2">
                            {netraRows.map((eq, i) => (
                              <div key={i} className="flex items-center justify-between">
                                <div>
                                  <div className="text-xs font-medium text-white">{eq.nomenclature}</div>
                                  <div className="text-[10px] text-gray-500 capitalize">
                                    {eq.system.replace(/_/g, ' ')}
                                  </div>
                                </div>
                                <span className="text-xs text-gray-300 font-mono tabular-nums ml-3">
                                  {eq.reliability !== null ? fmt(eq.reliability) : 'N/A'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* User selection equipment */}
                      <div className="pr-4">
                        {userRows.length === 0 ? (
                          <span className="text-xs text-gray-600 italic">No equipment selected</span>
                        ) : (
                          <div className="space-y-2">
                            {userRows.map((eq, i) => (
                              <div key={i} className="flex items-center justify-between">
                                <div>
                                  <div className="text-xs font-medium text-white">{eq.nomenclature}</div>
                                  <div className="text-[10px] text-gray-500 capitalize">
                                    {eq.system.replace(/_/g, ' ')}
                                  </div>
                                </div>
                                <span className="text-xs text-gray-300 font-mono tabular-nums ml-3">
                                  {fmt(eq.reliability)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Phase delta */}
                      {/* Phase delta — User big number banner */}
                      <div className="flex flex-col items-end gap-2">
                        {altRel !== null ? (
                          <>
                            <div className="rounded-md border px-3 py-2 text-right bg-gray-800/60 border-gray-700">
                              <div className="text-[9px] uppercase tracking-widest text-gray-500 mb-0.5">User</div>
                              <div className="text-xl font-bold tabular-nums leading-none text-white">{fmt(altRel)}</div>
                            </div>
                            {/* <DeltaBadge original={origRel} alternate={altRel} /> */}
                          </>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}