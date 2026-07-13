// app/actions/mission_config/submit_mission.ts
'use server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface SubmitMissionPayload {
  config_id: string
  config_name: string
  ship_id: string
  ship_name: string
  total_duration: number
  created_at: string
  phases: Array<{
    phase_name: string
    sequence_order: number
    duration_hours: number
    propulsion?: { k: number; n: number }
    power_generation?: { k: number; n: number }
    support?: { k: number; n: number }
    firing?: { k: number; n: number }
  }>
  systems: {
    propulsion?: {
      system_id: string
      selected_equipment: Array<{
        component_id: string
        name: string
        nomenclature: string
      }>
    }
    power_generation?: {
      system_id: string
      selected_equipment: Array<{
        component_id: string
        name: string
        nomenclature: string
      }>
    }
    support?: {
      system_id: string
      selected_equipment: Array<{
        component_id: string
        name: string
        nomenclature: string
      }>
    }
    firing?: {
      system_id: string
      selected_equipment: Array<{
        component_id: string
        name: string
        nomenclature: string
      }>
    }
  }
}

export interface MissionReliabilityResponse {
  success: boolean
  message: string
  data: {
    config_id: string
    config_name: string
    ship_name: string
    total_duration: number
    mission_reliability: number
    phases: Array<{
      phase_name: string
      sequence: number
      duration_hours: number
      phase_reliability: number
      systems: {
        propulsion?: {
          reliability: number | null
          critical_equipment: string[]
          k_of_n: string
          required: boolean
        }
        power_generation?: {
          reliability: number | null
          critical_equipment: string[]
          k_of_n: string
          required: boolean
        }
        support?: {
          reliability: number | null
          critical_equipment: string[]
          k_of_n: string
          required: boolean
        }
        firing?: {
          reliability: number | null
          critical_equipment: string[]
          k_of_n: string
          required: boolean
        }
      }
    }>
    equipment_final_ages: Record<string, number>
  }
}

export async function submitMissionConfiguration(
  payload: SubmitMissionPayload
): Promise<{ success: boolean; data?: MissionReliabilityResponse; error?: string }> {
  try {
    console.log('🚀 Submitting mission configuration:', payload)

    const response = await fetch(`${API_BASE_URL}/api/mission-reliability/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('❌ API Error:', error)
      throw new Error(error.detail || 'Failed to calculate mission reliability')
    }

    const result: MissionReliabilityResponse = await response.json()
    
    console.log('✅ Mission reliability calculated:', result)
    
    return { success: true, data: result }
  } catch (error) {
    console.error('💥 Error submitting mission configuration:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Compare mission reliability with alternative equipment selections
 */
export async function compareMissionConfiguration(
  originalPayload: SubmitMissionPayload,
  alternativeEquipment: Record<string, string[]>
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    console.log('🔄 Comparing mission configurations...')
    console.log('   Alternative equipment:', alternativeEquipment)

    const response = await fetch(`${API_BASE_URL}/api/mission-reliability/compare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        original_config: originalPayload,
        alternative_equipment: alternativeEquipment
      }),
      cache: 'no-store'
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('❌ Comparison API Error:', error)
      throw new Error(error.detail || 'Failed to compare configurations')
    }

    const result = await response.json()
    
    console.log('✅ Comparison completed:', result)
    
    return { success: true, data: result }
  } catch (error) {
    console.error('💥 Error comparing configurations:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}