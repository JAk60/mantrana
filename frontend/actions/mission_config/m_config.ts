// app/actions/mission_config/m_config.ts
'use server'

import { revalidatePath } from 'next/cache'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Match Python model: MissionConfigurationCreate
export interface ShipConfigurationCreate {
  config_name: string
  ship_id: string
  ship_name: string
  configuration?: Record<string, any>
}

// Match Python model: MissionConfiguration (table=True)
export interface ShipConfiguration extends ShipConfigurationCreate {
  id: string
  created_date: string
  modified_date: string
}

// Match Python model: MissionConfigurationUpdate
export interface ShipConfigurationUpdate {
  config_name?: string
  configuration?: Record<string, any>
}

export async function createShipConfiguration(
  formData: FormData | ShipConfigurationCreate
) {
  try {
    // Handle both FormData and direct object
    let data: ShipConfigurationCreate
    
    if (formData instanceof FormData) {
      data = {
        config_name: formData.get('config_name') as string,
        ship_id: formData.get('ship_id') as string,
        ship_name: formData.get('ship_name') as string,
        configuration: formData.get('configuration') 
          ? JSON.parse(formData.get('configuration') as string)
          : undefined
      }
    } else {
      data = formData
    }

    const response = await fetch(`${API_BASE_URL}/Mission-configuration/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      cache: 'no-store'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to create ship configuration')
    }

    const result: ShipConfiguration = await response.json()
    
    // Revalidate the ship configurations list page
    revalidatePath('/ship-configurations')
    
    return { success: true, data: result }
  } catch (error) {
    console.error('Error creating ship configuration:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      data: undefined
    }
  }
}

export async function getShipConfiguration(id: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/Mission-configuration/${id}`, {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error('Failed to fetch ship configuration')
    }

    const data: ShipConfiguration = await response.json()
    return { success: true, data }
  } catch (error) {
    console.error('Error fetching ship configuration:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      data: undefined
    }
  }
}

export async function listShipConfigurations() {
  try {
    const response = await fetch(`${API_BASE_URL}/Mission-configuration/get_all_mission_configs`, {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error('Failed to fetch ship configurations')
    }

    const data: ShipConfiguration[] = await response.json()
    return { success: true, data }
  } catch (error) {
    console.error('Error fetching ship configurations:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      data: undefined
    }
  }
}

export async function updateShipConfiguration(
  id: string,
  data: ShipConfigurationCreate | ShipConfigurationUpdate
) {
  try {
    const response = await fetch(`${API_BASE_URL}/Mission-configuration/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      cache: 'no-store'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to update ship configuration')
    }

    const result: ShipConfiguration = await response.json()
    
    revalidatePath('/ship-configurations')
    revalidatePath(`/Mission-configuration/${id}`)
    
    return { success: true, data: result }
  } catch (error) {
    console.error('Error updating ship configuration:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      data: undefined
    }
  }
}

export async function deleteShipConfiguration(id: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/Mission-configuration/${id}`, {
      method: 'DELETE',
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error('Failed to delete ship configuration')
    }
    
    revalidatePath('/ship-configurations')
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting ship configuration:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}