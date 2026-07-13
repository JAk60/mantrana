import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRef, useState } from 'react'
import ConfigBuilderView from "./views/config_builder_view"
import ConfigSelectionView from "./views/config_selection_view"
import ReliabilityResultsView from "./views/reliability_result_view"

import { Button } from "@/components/ui/button"
import { History, RotateCcw } from "lucide-react"
import { toast } from 'sonner'
import ComparisonTableView from "./views/comparison_table_view"

// ===================== TYPES =====================

export interface MissionPhase {
  id: string
  phase_name: string
  duration_hours: number
  sequence_order: number
}

export interface ShipConfiguration {
  id: string
  config_name: string
  ship_id: string
  ship_name: string
  created_date: string
  configuration?: {
    configuration?: {
      [key: string]: {
        system_id: string
        selected_equipment: any[]
        phases: Array<{
          phase_number: number
          phase_name: string
          k: number
          n: number
        }>
      }
    }
  }
}

// ===================== MAIN DASHBOARD =====================
export default function IntegratedMissionConfigDashboard() {
  const [view, setView] = useState<'main' | 'table'>('main')
  const [selectedConfig, setSelectedConfig] = useState<ShipConfiguration | null>(null)
  const [selectedPhases, setSelectedPhases] = useState<MissionPhase[]>([])
  const [reliabilityData, setReliabilityData] = useState<any>(null)
  const [currentComparisonId, setCurrentComparisonId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  
  const missionBuilderRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const handleConfigSelect = (config: ShipConfiguration) => {
    setSelectedConfig(config)
    // Clear phases and results when changing config
    setSelectedPhases([])
    setReliabilityData(null)
    setCurrentComparisonId(null)
    
    // Auto-scroll to mission builder section
    setTimeout(() => {
      missionBuilderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const handleNewMission = () => {
    setSelectedConfig(null)
    setSelectedPhases([])
    setReliabilityData(null)
    setCurrentComparisonId(null)
    setResetKey(prev => prev + 1) // Force full remount of ConfigSelectionView
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBack = () => {
    setView('main')
  }

  const handleSubmit = async (payload: any, comparisonId: string) => {
    setIsSubmitting(true)
    
    try {
      const response = await fetch('http://localhost:8000/api/mission-reliability/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to calculate reliability')
      }
      
      const result = await response.json()
      console.log('✅ Mission reliability result:', result)
      
      toast.success('Reliability calculated successfully')
      setReliabilityData(result)
      setCurrentComparisonId(comparisonId)
      
      // Auto-scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
      
    } catch (error) {
      console.error('Error submitting mission:', error)
      toast.error(`Failed to calculate mission reliability: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Mission Reliability</CardTitle>
          <div className="flex items-center gap-2">
            {view === 'main' && selectedConfig && (
              <Button
                variant="outline"
                onClick={handleNewMission}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                New Mission
              </Button>
            )}
            {view === 'main' && (
              <Button
                variant="outline"
                onClick={() => setView('table')}
                className="gap-2"
              >
                <History className="w-4 h-4" />
                View History
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {view === 'table' ? (
          <ComparisonTableView onBack={handleBack} />
        ) : (
          <div className="space-y-8">
            {/* Section 1: Configuration Selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm">
                  1
                </span>
                <span>Select Configuration</span>
              </div>
              <ConfigSelectionView 
                key={resetKey}
                onConfigSelect={handleConfigSelect}
                hideNextButton={true}
                selectedConfigId={selectedConfig?.id}
              />
            </div>

            {/* Section 2: Mission Builder */}
            {selectedConfig && (
              <div ref={missionBuilderRef} className="space-y-4 pt-8 border-t">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm">
                    2
                  </span>
                  <span>Build Mission</span>
                </div>
                <ConfigBuilderView 
                  config={selectedConfig} 
                  onBack={handleNewMission}
                  onSubmit={handleSubmit}
                  isSubmitting={isSubmitting}
                  hideBackButton={true}
                />
              </div>
            )}

            {/* Section 3: Results */}
            {reliabilityData && selectedConfig && currentComparisonId && (
              <div ref={resultsRef} className="space-y-4 pt-8 border-t">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm">
                    3
                  </span>
                  <span>Results</span>
                </div>
                <ReliabilityResultsView 
                  reliabilityData={reliabilityData}
                  onBack={handleNewMission}
                  selectedConfig={selectedConfig}
                  comparisonId={currentComparisonId}
                  hideBackButton={true}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}