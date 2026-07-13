// app/actions/config-actions.ts
'use server'

const API_URL = process.env.FASTAPI_URL || 'http://localhost:8000'

export async function createConfig(configData: any) {
  const response = await fetch(`${API_URL}/api/configs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(configData),
  })
  
  if (!response.ok) throw new Error('Failed to create config')
  return response.json()
}

export async function getAllConfigs() {
  const response = await fetch(`${API_URL}/api/configs`, {
    cache: 'no-store'
  })
  
  if (!response.ok) throw new Error('Failed to fetch configs')
  return response.json()
}

export async function getConfigById(id: string) {
  const response = await fetch(`${API_URL}/api/configs/${id}`, {
    cache: 'no-store'
  })
  
  if (!response.ok) throw new Error('Failed to fetch config')
  return response.json()
}

export async function updateConfig(id: string, configData: any) {
  const response = await fetch(`${API_URL}/api/configs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(configData),
  })
  
  if (!response.ok) throw new Error('Failed to update config')
  return response.json()
}

export async function deleteConfig(id: string) {
  const response = await fetch(`${API_URL}/api/configs/${id}`, {
    method: 'DELETE',
  })
  
  if (!response.ok) throw new Error('Failed to delete config')
}

export async function duplicateConfig(id: string) {
  const response = await fetch(`${API_URL}/api/configs/${id}/duplicate`, {
    method: 'POST',
  })
  
  if (!response.ok) throw new Error('Failed to duplicate config')
  return response.json()
}

export async function copyConfigToShip(id: string, targetShipId: string, targetShipName: string) {
  const response = await fetch(
    `${API_URL}/api/configs/${id}/copy-to-ship?target_ship_id=${targetShipId}&target_ship_name=${targetShipName}`,
    { method: 'POST' }
  )
  
  if (!response.ok) throw new Error('Failed to copy config')
  return response.json()
}