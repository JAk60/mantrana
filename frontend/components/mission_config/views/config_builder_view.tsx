// frontend/src/components/Drishti/mission_config/chat/config_builder_view.tsx
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'
import {
    Clock,
    Loader2,
    Plus,
    Shield,
    Trash2
} from "lucide-react"
import React, { useState } from 'react'
import { MissionPhase, ShipConfiguration } from '@/components/mission_config/integrated_mission_config_dashboard'
import { saveComparison, StoredComparison } from '@/actions/mission_config/batch_comparison'
import { toast } from 'sonner'

interface ConfigBuilderViewProps {
  config: ShipConfiguration
  onBack: () => void
  onSubmit: (payload: any, comparisonId: string) => void
  isSubmitting: boolean
}

export default function ConfigBuilderView({ config, onBack, onSubmit, isSubmitting }: ConfigBuilderViewProps) {
  const [selectedPhases, setSelectedPhases] = useState<MissionPhase[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  const availablePhases = React.useMemo(() => {
    if (!config.configuration?.configuration) return []
    
    const uniquePhases = new Set<string>()
    const systems = config.configuration.configuration
    
    Object.values(systems).forEach((system: any) => {
      if (system.phases && Array.isArray(system.phases)) {
        system.phases.forEach((phase: any) => {
          if (phase.phase_name) {
            uniquePhases.add(phase.phase_name)
          }
        })
      }
    })
    
    return Array.from(uniquePhases).sort()
  }, [config.configuration])

  const addPhase = (phaseName: string) => {
    const newPhase: MissionPhase = {
      id: `${Date.now()}-${Math.random()}`,
      phase_name: phaseName,
      duration_hours: 0,
      sequence_order: selectedPhases.length
    }
    setSelectedPhases([...selectedPhases, newPhase])
  }

  const removePhase = (id: string) => {
    setSelectedPhases(selectedPhases.filter(p => p.id !== id))
    const newErrors = { ...errors }
    delete newErrors[id]
    setErrors(newErrors)
  }

  const updateDuration = (id: string, duration: string) => {
    const value = parseFloat(duration)
    setSelectedPhases(
      selectedPhases.map(p =>
        p.id === id ? { ...p, duration_hours: value || 0 } : p
      )
    )
    
    if (value > 0) {
      const newErrors = { ...errors }
      delete newErrors[id]
      setErrors(newErrors)
    }
  }

  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    const items = Array.from(selectedPhases)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    const updatedItems = items.map((item, index) => ({
      ...item,
      sequence_order: index
    }))

    setSelectedPhases(updatedItems)
  }

  const validateAndSubmit = async () => {
    const newErrors: Record<string, string> = {}
    
    selectedPhases.forEach(phase => {
      if (phase.duration_hours <= 0) {
        newErrors[phase.id] = 'Duration must be greater than 0'
      }
    })

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    if (selectedPhases.length === 0) {
      toast.error('Please add at least one phase')
      return
    }

    // Build systems object - unwrap nested configuration
    const systems: any = {}
    let actualConfig = config.configuration?.configuration || config.configuration || {}
    
    // Unwrap any additional nesting
    while (actualConfig.configuration && typeof actualConfig.configuration === 'object') {
      actualConfig = actualConfig.configuration
    }
    
    console.log('🔍 Processing configuration:', {
      hasConfig: !!config.configuration,
      actualConfigKeys: Object.keys(actualConfig),
      actualConfig
    })
    
    Object.entries(actualConfig).forEach(([systemKey, system]: [string, any]) => {
      if (system && system.selected_equipment && Array.isArray(system.selected_equipment)) {
        systems[systemKey] = {
          system_id: system.system_id,
          selected_equipment: system.selected_equipment.map((eq: any) => ({
            component_id: eq.id || eq.component_id,
            name: eq.name || eq.component_name,
            nomenclature: eq.nomenclature
          }))
        }
        console.log(`✅ System ${systemKey} has ${system.selected_equipment.length} equipment`)
      } else {
        console.warn(`⚠️ System ${systemKey} has no equipment or invalid structure:`, system)
      }
    })

    // Validate systems have equipment
    if (Object.keys(systems).length === 0) {
      toast.error('No equipment configured. Please check your configuration.')
      console.error('Systems object is empty:', { actualConfig, systems })
      return
    }

    const totalDuration = selectedPhases.reduce((sum, p) => sum + p.duration_hours, 0)

    // Build phases with system configs
    const optimizedPhases = selectedPhases.map(({ id, ...phase }) => {
      const phaseWithSystemConfigs: any = { ...phase }
      
      Object.entries(actualConfig).forEach(([systemKey, system]: [string, any]) => {
        if (system && system.phases && Array.isArray(system.phases)) {
          const systemPhase = system.phases.find((p: any) => p.phase_name === phase.phase_name)
          if (systemPhase && typeof systemPhase.k !== 'undefined' && typeof systemPhase.n !== 'undefined') {
            phaseWithSystemConfigs[systemKey] = {
              k: systemPhase.k,
              n: systemPhase.n
            }
            console.log(`✅ Phase ${phase.phase_name} - System ${systemKey}: k=${systemPhase.k}, n=${systemPhase.n}`)
          } else {
            console.warn(`⚠️ Phase ${phase.phase_name} - System ${systemKey}: No valid k/n config found`)
          }
        }
      })
      
      return phaseWithSystemConfigs
    })

    const missionPayload = {
      config_id: config.id,
      config_name: config.config_name,
      ship_id: config.ship_id,
      ship_name: config.ship_name,
      total_duration: totalDuration,
      created_at: new Date().toISOString(),
      phases: optimizedPhases,
      systems: systems
    }

    console.log('📤 Submitting mission configuration:', {
      config_id: missionPayload.config_id,
      ship_id: missionPayload.ship_id,
      total_duration: missionPayload.total_duration,
      phases_count: missionPayload.phases.length,
      systems_count: Object.keys(missionPayload.systems).length,
      systems: Object.keys(missionPayload.systems),
      payload: missionPayload
    })
    
    // Generate comparison ID
    const comparisonId = `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Call parent submit handler with comparison ID
    onSubmit(missionPayload, comparisonId)
  }

  const totalDuration = selectedPhases.reduce((sum, p) => sum + p.duration_hours, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{config.config_name}</h3>
          <p className="text-sm text-muted-foreground">{config.ship_name}</p>
        </div>
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
      </div>

      <div className="grid grid-cols-[300px_1fr] gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configured Phases</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {availablePhases.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No phases available
              </div>
            ) : (
              availablePhases.map((phase) => (
                <Button
                  key={phase}
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => addPhase(phase)}
                >
                  <Plus className="w-4 h-4" />
                  {phase}
                </Button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Mission Sequence</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                Total: {totalDuration}h
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {selectedPhases.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No phases selected</p>
                <p className="text-sm mt-1">Click phases from the sidebar to add them</p>
              </div>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="phases">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2"
                    >
                      {selectedPhases.map((phase, index) => (
                        <Draggable key={phase.id} draggableId={phase.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`flex items-center gap-4 p-4 border rounded-lg bg-card ${
                                snapshot.isDragging ? 'shadow-lg' : ''
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className="text-sm font-medium text-muted-foreground w-8">
                                  #{index + 1}
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium">{phase.phase_name}</p>
                                </div>
                                <div className="w-32">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    placeholder="Hours"
                                    value={phase.duration_hours || ''}
                                    onChange={(e) => updateDuration(phase.id, e.target.value)}
                                    className={errors[phase.id] ? 'border-red-500' : ''}
                                  />
                                  {errors[phase.id] && (
                                    <p className="text-xs text-red-500 mt-1">{errors[phase.id]}</p>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removePhase(phase.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}

            <div className="mt-6 flex justify-end">
              <Button
                onClick={validateAndSubmit}
                disabled={selectedPhases.length === 0 || isSubmitting}
                className="gap-2"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    Calculate Reliability
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}