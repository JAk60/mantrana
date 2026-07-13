// frontend/src/components/Drishti/mission_config/chat/reliability_result_view.tsx

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card as UICard, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Shield,
  Shuffle,
  TrendingUp,
  Save,
  Calculator,
  Trash2,
  AlertCircle
} from "lucide-react"
import { useEffect, useState } from 'react'
import { getShipSystemHierarchy } from "@/actions/system/get-ship-system-hierarchy"
import {
  saveComparisonConfig,
  getSavedComparisonConfigs,
  deleteComparisonConfig,
  submitBatchComparison,
  saveOriginalResult,
  addAlternativeResults,
  type ComparisonConfig,
  type PhaseEquipment,
  type EquipmentSelection,
  type ComparisonResult
} from "@/actions/mission_config/batch_comparison"
import { toast } from 'sonner'
import ComparisonResultsTable from './comparison_results_table'

interface ReliabilityResultsViewProps {
  ship: string
  reliabilityData: any
  onBack: () => void
  selectedConfig: any
  comparisonId: string
  hideBackButton?: boolean
  onNavigateToTable?: () => void
}

interface SystemEquipment {
  component_id: string
  name: string
  nomenclature: string
  system_type: string
}

interface SelectedEquipment {
  [phaseIndex: string]: {
    [systemKey: string]: string[]
  }
}

export default function ReliabilityResultsView({
  ship,
  reliabilityData,
  onBack,
  selectedConfig,
  comparisonId,
  hideBackButton = false,
  onNavigateToTable,
}: ReliabilityResultsViewProps) {

  const [showComparison, setShowComparison] = useState(false)
  const [selectedEquipment, setSelectedEquipment] = useState<SelectedEquipment>({})
  const [expandedPhases, setExpandedPhases] = useState<Record<number, boolean>>({})
  const [allShipEquipment, setAllShipEquipment] = useState<SystemEquipment[]>([])
  const [loadingEquipment, setLoadingEquipment] = useState(false)
  // Always an array — never undefined
  const [savedComparisons, setSavedComparisons] = useState<ComparisonConfig[]>([])
  const [saving, setSaving] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [showResultsTable, setShowResultsTable] = useState(false)
  const [calculatedResults, setCalculatedResults] = useState<ComparisonResult[]>([])

  const data = reliabilityData?.data || reliabilityData
  const netraReliability: number = data?.mission_reliability ?? 0

  useEffect(() => {
    saveOriginalCalculation()
    loadSavedComparisons()
  }, [])

  useEffect(() => {
    if (showComparison && selectedConfig?.ship_id && allShipEquipment.length === 0) {
      fetchAllShipEquipment()
    }
  }, [showComparison, selectedConfig?.ship_id])

  const saveOriginalCalculation = () => {
    try {
      if (!data || data.mission_reliability === undefined || !Array.isArray(data.phases) || !data.equipment_final_ages) return
      saveOriginalResult({
        config_id: selectedConfig.id,
        config_name: `${selectedConfig.config_name} - Original`,
        ship_id: selectedConfig.ship_id,
        ship_name: selectedConfig.ship_name,
        total_duration: data.total_duration || 0,
        mission_reliability: data.mission_reliability,
        phases: data.phases,
        equipment_final_ages: data.equipment_final_ages
      })
    } catch (error) {
      console.error('Error saving original calculation:', error)
    }
  }

  const loadSavedComparisons = () => {
    try {
      // No filter — load ALL saved configs (cross-ship supported)
      const all = getSavedComparisonConfigs()
      setSavedComparisons(Array.isArray(all) ? all : [])
      console.log(`📊 Loaded ${all.length} comparison configs`)
    } catch (err) {
      console.error('Failed to load saved comparisons:', err)
      setSavedComparisons([])
    }
  }

  const fetchAllShipEquipment = async () => {
    if (!selectedConfig?.ship_id) return
    setLoadingEquipment(true)
    try {
      const result = await getShipSystemHierarchy(selectedConfig.ship_id)
      console.log('Fetched ship system hierarchy:', result)
      const equipment: SystemEquipment[] = result.components
        .filter((comp: any) => comp.hasParent === false)
        .map((comp: any) => ({
          component_id: comp.id,
          name: comp.name,
          nomenclature: comp.nomenclature,
          system_type: comp.systemType.toLowerCase()
        }))
      setAllShipEquipment(equipment)
      initializeSelectedEquipmentWithData(equipment)
    } catch (error) {
      toast.error(`Failed to load ship equipment: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoadingEquipment(false)
    }
  }

  const initializeSelectedEquipmentWithData = (equipment: SystemEquipment[]) => {
    if (!data.phases || equipment.length === 0) return
    const initial: SelectedEquipment = {}
    data.phases.forEach((phase: any, index: number) => {
      const phaseKey = `phase_${index}`
      initial[phaseKey] = {}
      Object.entries(phase.systems || {}).forEach(([systemKey, systemData]: [string, any]) => {
        if (systemData.critical_equipment?.length > 0) {
          const ids = systemData.critical_equipment
            .map((nom: string) => equipment.find(eq => eq.nomenclature === nom)?.component_id)
            .filter(Boolean)
          if (ids.length > 0) initial[phaseKey][systemKey] = ids
        }
      })
    })
    setSelectedEquipment(initial)
  }

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A'
    return `${(value * 100).toFixed(2)}%`
  }

  const getPhaseCriticalEquipment = (phase: any) => {
    const equipment = new Set<string>()
    Object.values(phase.systems || {}).forEach((system: any) => {
      system.critical_equipment?.forEach((eq: string) => equipment.add(eq))
    })
    return Array.from(equipment)
  }

  const getSystemLabel = (key: string): string => ({
    propulsion: 'Propulsion',
    power_generation: 'Power Generation',
    support: 'Support',
    firing: 'Firing'
  }[key] || key)

  const toggleEquipmentSelection = (phaseIndex: number, systemKey: string, componentId: string) => {
    setSelectedEquipment(prev => {
      const phaseKey = `phase_${phaseIndex}`
      const current = prev[phaseKey]?.[systemKey] || []
      const updated = current.includes(componentId)
        ? current.filter(id => id !== componentId)
        : [...current, componentId]
      return { ...prev, [phaseKey]: { ...prev[phaseKey], [systemKey]: updated } }
    })
  }

  const isEquipmentSelected = (phaseIndex: number, systemKey: string, componentId: string): boolean =>
    selectedEquipment[`phase_${phaseIndex}`]?.[systemKey]?.includes(componentId) || false

  const isEquipmentCurrent = (phase: any, nomenclature: string): boolean =>
    Object.values(phase.systems || {}).flatMap((s: any) => s.critical_equipment || []).includes(nomenclature)

  const togglePhaseExpansion = (phaseIndex: number) =>
    setExpandedPhases(prev => ({ ...prev, [phaseIndex]: !prev[phaseIndex] }))

  const handleAddToComparisons = () => {
    if (savedComparisons.length >= 5) {
      toast.error('Maximum 5 comparisons allowed. Please delete some first.')
      return
    }
    setSaving(true)
    try {
      const phases: PhaseEquipment[] = data.phases.map((phase: any, phaseIndex: number) => {
        const phaseKey = `phase_${phaseIndex}`
        const phaseConfig: PhaseEquipment = {
          phase_name: phase.phase_name,
          duration_hours: phase.duration_hours,
          sequence_order: phase.sequence
        }
        const systems = ['propulsion', 'power_generation', 'support', 'firing'] as const
        systems.forEach(systemKey => {
          const ids = selectedEquipment[phaseKey]?.[systemKey] || []
          if (ids.length > 0) {
            const selections: EquipmentSelection[] = ids
              .map(id => {
                const eq = allShipEquipment.find(e => e.component_id === id)
                return eq ? { component_id: eq.component_id, name: eq.name, nomenclature: eq.nomenclature } : null
              })
              .filter(Boolean) as EquipmentSelection[]
            if (selections.length > 0) phaseConfig[systemKey] = selections
          }
        })
        return phaseConfig
      })

      const altNumber = savedComparisons.length + 1
      const comparisonName = `${selectedConfig.config_name} - Alt ${altNumber}`

      const config: ComparisonConfig = {
        id: `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        config_id: '8abcc8ef-af7c-4f64-a150-344eeed41402',
        config_name: comparisonName,
        ship_id: selectedConfig.ship_id,
        ship_name: selectedConfig.ship_name,
        total_duration: data.total_duration,
        phases,
        timestamp: new Date().toISOString(),
        netra_reliability: netraReliability,  // ← store NETRA baseline per config
      }

      const success = saveComparisonConfig(config)
      if (success) {
        loadSavedComparisons()
        toast.success(`✅ Saved as "${comparisonName}"`)
        setShowComparison(false)
      } else {
        toast.error('Failed to save comparison')
      }
    } catch (error) {
      toast.error(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteComparison = (id: string) => {
    if (confirm('Delete this comparison?')) {
      const success = deleteComparisonConfig(id)
      if (success) {
        loadSavedComparisons()
        toast.success('Comparison deleted')
      } else {
        toast.error('Failed to delete')
      }
    }
  }

  const handleCalculateAll = async () => {
    if (savedComparisons.length === 0) {
      toast.error('No comparisons to calculate')
      return
    }
    setCalculating(true)
    try {
      console.log(`🚀 Submitting ${savedComparisons.length} comparisons (cross-ship)`)
      const result = await submitBatchComparison({ comparisons: savedComparisons })

      if (result.success && result.data) {
        addAlternativeResults(selectedConfig.id, result.data.results)
        toast.success(`${result.data.results.length} comparison(s) calculated!`)
        setCalculatedResults(result.data.results)
        setShowResultsTable(true)
      } else {
        throw new Error(result.error || 'Batch calculation failed')
      }
    } catch (error) {
      toast.error(`Batch calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setCalculating(false)
    }
  }

  // ── Results Table View ──────────────────────────────────────────────────────

  if (showResultsTable) {
    return (
      <div className="w-full space-y-6">
        <Button variant="outline" onClick={() => setShowResultsTable(false)} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Results
        </Button>
        <ComparisonResultsTable
          ship={ship}
          originalConfig={data}
          results={calculatedResults}
        />
      </div>
    )
  }

  // ── Main Results View ───────────────────────────────────────────────────────

  return (
    <div className="w-full space-y-6">

      {!hideBackButton && (
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Configurations
        </Button>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Strike</h1>
          <p className="text-gray-500 mt-1">{ship}</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">Total Duration</div>
          <div className="text-2xl font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {data.total_duration}h
          </div>
        </div>
      </div>

      {/* Phase Analysis Table */}
      <UICard className="bg-black border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <TrendingUp className="w-5 h-5" />
            Preferred Equipment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 font-semibold text-gray-500">Phase</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-500">Duration</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-500">Reliability</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-500">Preferred Equipment</th>
                </tr>
              </thead>
              <tbody>
                {(data.phases || []).map((phase: any, index: number) => (
                  <tr key={index} className="border-b border-gray-800 hover:bg-gray-900 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono border-gray-700 text-gray-300">
                          #{phase.sequence + 1}
                        </Badge>
                        <span className="font-medium text-white">{phase.phase_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4"><span className="text-gray-400">{phase.duration_hours}h</span></td>
                    <td className="py-3 px-4">
                      <Badge>
                        {formatPercent(phase.phase_reliability)}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-2">
                        {getPhaseCriticalEquipment(phase).map((eq, i) => (
                          <Badge key={i} variant="secondary" className="bg-gray-800 text-gray-300">{eq}</Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </UICard>

      {/* Mission Reliability */}
      <UICard className="border-2 border-primary shadow-lg bg-gray-900">
        <CardHeader className="bg-gradient-to-r from-gray-800 to-gray-700">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-2xl text-white">
              <Shield className="w-6 h-6 text-primary" />
              Total Reliability
            </CardTitle>
            <Badge className="text-lg px-4 py-2">
              {formatPercent(data.mission_reliability)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-gray-300">
            <CheckCircle2 className="w-5 h-5" />
            <span>Mission reliability calculated successfully</span>
          </div>
        </CardContent>
      </UICard>

      {/* Saved Comparisons List */}
      {savedComparisons.length > 0 && (
        <UICard className="bg-black border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">
              Saved Comparisons ({savedComparisons.length}/5)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {savedComparisons.map((comp) => (
                <div key={comp.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg border border-gray-800">
                  <div className="flex-1">
                    <div className="font-medium text-white">Strike</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      <span className="text-cyan-500">{ship}</span>
                      <span className="mx-1">•</span>
                      {comp.phases?.length || 0} phases
                      <span className="mx-1">•</span>
                      {comp.total_duration || 0}h
                      {comp.netra_reliability !== undefined && (
                        <>
                          <span className="mx-1">•</span>
                          <span className="text-gray-400">NETRA: {formatPercent(comp.netra_reliability)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteComparison(comp.id)}
                    className="text-red-500 hover:text-red-400 hover:bg-red-950"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </UICard>
      )}

      {/* Alternative Equipment Selection Panel */}
      {showComparison && (
        <UICard className="border-2 border-dashed border-primary bg-black">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">Select Alternative Equipment</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Choose different equipment for each phase — from any ship/config
                </p>
              </div>
              {savedComparisons.length >= 5 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Maximum reached (5/5)
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingEquipment ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-white">Loading ship equipment...</span>
              </div>
            ) : allShipEquipment.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No equipment found</p>
                <Button onClick={fetchAllShipEquipment} variant="outline">Retry</Button>
              </div>
            ) : (
              <>
                {(data.phases || []).map((phase: any, phaseIndex: number) => (
                  <div key={phaseIndex} className="border border-gray-800 rounded-lg overflow-hidden">
                    <button
                      onClick={() => togglePhaseExpansion(phaseIndex)}
                      className="w-full bg-gray-900 hover:bg-gray-800 transition-colors p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono border-gray-700 text-gray-300">
                          #{phase.sequence + 1}
                        </Badge>
                        <span className="font-semibold text-white">{phase.phase_name}</span>
                        <span className="text-sm text-gray-500">({phase.duration_hours}h)</span>
                      </div>
                      {expandedPhases[phaseIndex]
                        ? <ChevronUp className="w-5 h-5 text-gray-500" />
                        : <ChevronDown className="w-5 h-5 text-gray-500" />
                      }
                    </button>

                    {expandedPhases[phaseIndex] && (
                      <div className="p-4 bg-black space-y-6">
                        {['propulsion', 'power_generation', 'support', 'firing'].map(systemKey => {
                          const sysEquipment = allShipEquipment.filter(eq => eq.system_type === systemKey)
                          if (sysEquipment.length === 0) return null
                          return (
                            <div key={systemKey} className="space-y-2">
                              <h4 className="font-semibold text-sm text-white">
                                {getSystemLabel(systemKey)} ({sysEquipment.length})
                              </h4>
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {sysEquipment.map(eq => {
                                  const isSelected = isEquipmentSelected(phaseIndex, systemKey, eq.component_id)
                                  const isCurrent = isEquipmentCurrent(phase, eq.nomenclature)
                                  return (
                                    <div
                                      key={eq.component_id}
                                      className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${isSelected ? 'bg-primary/10 border-primary'
                                          : isCurrent ? 'bg-green-900/30 border-green-700'
                                            : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                                        }`}
                                    >
                                      <Checkbox
                                        id={`${phaseIndex}-${systemKey}-${eq.component_id}`}
                                        checked={isSelected}
                                        onCheckedChange={() => toggleEquipmentSelection(phaseIndex, systemKey, eq.component_id)}
                                      />
                                      <label htmlFor={`${phaseIndex}-${systemKey}-${eq.component_id}`} className="flex-1 cursor-pointer">
                                        <div className="font-medium text-sm text-white">{eq.nomenclature}</div>
                                        <div className="text-xs text-gray-500">{eq.name}</div>
                                        {isCurrent && (
                                          <Badge variant="outline" className="mt-1 text-xs border-gray-700 text-gray-400">Current</Badge>
                                        )}
                                      </label>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}

                      </div>
                    )}
                  </div>
                ))}
                <div className="flex justify-end pt-4 border-t border-gray-800 gap-3">
                  <Button variant="outline" onClick={() => setShowComparison(false)}>Cancel</Button>
                  <Button
                    size="lg"
                    onClick={handleAddToComparisons}
                    disabled={saving || savedComparisons.length >= 5}
                    className="gap-2"
                  >
                    {saving
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
                      : <><Save className="w-5 h-5" />Add to Comparisons ({savedComparisons.length}/5)</>
                    }
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </UICard>
      )}

      {/* ── Action Buttons ── always show both independently ── */}
      <div className="flex items-center justify-center gap-4 flex-wrap">

        {/* Add Alternative — visible unless at the 5-cap */}
        {savedComparisons.length < 5 && (
          <Button
            size="lg"
            variant="outline"
            onClick={() => setShowComparison(prev => !prev)}
            className="gap-2"
          >
            <Shuffle className="w-5 h-5" />
            {showComparison ? 'Hide Alternative Panel' : 'Add Alternative Solution'}
          </Button>
        )}

        {/* Calculate — only visible when there are saved comparisons */}
        {savedComparisons.length > 0 && (
          <Button
            size="lg"
            onClick={handleCalculateAll}
            disabled={calculating}
            className="gap-2"
          >
            {calculating
              ? <><Loader2 className="w-4 h-4 animate-spin" />Calculating...</>
              : <><Calculator className="w-4 h-4" />Calculate All ({savedComparisons.length}) Comparisons</>
            }
          </Button>
        )}

      </div>
    </div>
  )
}