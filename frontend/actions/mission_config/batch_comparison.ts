// frontend/src/actions/mission_config/batch_comparison.ts
// FIXED: Cross-ship comparison support — 5 total cap across ALL configs, not per config_id

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ============================================================================
// TYPES
// ============================================================================

export interface EquipmentSelection {
  component_id: string
  name: string
  nomenclature: string
}

export interface PhaseEquipment {
  phase_name: string
  duration_hours: number
  sequence_order: number
  propulsion?: EquipmentSelection[]
  power_generation?: EquipmentSelection[]
  support?: EquipmentSelection[]
  firing?: EquipmentSelection[]
}

export interface ComparisonConfig {
  id: string
  config_id: string
  config_name: string
  ship_id: string
  ship_name: string
  total_duration: number
  phases: PhaseEquipment[]
  timestamp: string
  // ADDED: store the original NETRA reliability so each config carries its own baseline
  netra_reliability?: number
}

export interface BatchComparisonRequest {
  comparisons: ComparisonConfig[]
}

export interface EquipmentResult {
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

export interface PhaseResult {
  phase_name: string
  sequence: number
  duration_hours: number
  phase_reliability: number
  equipment: EquipmentResult[]
}

export interface ComparisonResult {
  comparison_id: string
  config_name: string
  ship_name: string
  mission_reliability: number
  total_duration: number
  phases: PhaseResult[]
  equipment_final_ages: Record<string, number>
  // Echoed back so the table can show the correct NETRA baseline per row
  netra_reliability?: number
}

export interface BatchComparisonResponse {
  success: boolean
  results: ComparisonResult[]
  error?: string
}

export interface StoredComparison {
  id: string
  config_id: string
  config_name: string
  ship_id: string
  ship_name: string
  total_duration: number

  original: {
    mission_reliability: number
    phases: any[]
    equipment_final_ages: Record<string, number>
    calculated_at: string
  }

  alternatives?: Array<{
    comparison_id: string
    config_name: string
    mission_reliability: number
    phases: PhaseResult[]
    equipment_final_ages: Record<string, number>
    calculated_at: string
  }>

  timestamp: string
}

export interface ComparisonConfigStorage {
  configs: ComparisonConfig[]
  version: string
}

export interface ComparisonResultStorage {
  comparisons: StoredComparison[]
  version: string
}

// ============================================================================
// API
// ============================================================================

export async function submitBatchComparison(
  request: BatchComparisonRequest
): Promise<{ success: boolean; data?: BatchComparisonResponse; error?: string }> {
  try {
    console.log('🚀 Submitting batch comparison:', {
      count: request.comparisons.length,
      configs: request.comparisons.map(c => ({
        name: c.config_name,
        ship: c.ship_name,
        phases: c.phases?.length,
      }))
    })

    const response = await fetch(`${API_BASE_URL}/api/mission-reliability/compare-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      cache: 'no-store'
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('❌ Batch API Error:', error)
      throw new Error(error.detail || 'Failed to calculate batch comparison')
    }

    const result: BatchComparisonResponse = await response.json()

    // Echo netra_reliability back onto each result so the table has it
    result.results = result.results.map((r, idx) => ({
      ...r,
      netra_reliability: request.comparisons[idx]?.netra_reliability
    }))

    console.log('✅ Batch comparison completed:', result.results.length, 'results')
    return { success: true, data: result }
  } catch (error) {
    console.error('💥 Error submitting batch comparison:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// ============================================================================
// LOCALSTORAGE — COMPARISON CONFIGS
// ============================================================================

const CONFIGS_STORAGE_KEY = 'mission_comparison_configs'
const RESULTS_STORAGE_KEY = 'mission_comparison_results'

const MAX_TOTAL_CONFIGS = 5

/**
 * Get all saved comparison configs.
 * If configId provided, filter by that config_id; otherwise return ALL (cross-ship).
 */
export function getSavedComparisonConfigs(configId?: string): ComparisonConfig[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(CONFIGS_STORAGE_KEY)
    if (!stored) return []

    const parsed = JSON.parse(stored)

    // Handle both formats:
    // 1. { configs: [...], version: "1.0" }  ← our format
    // 2. [...] ← raw array (legacy / corrupted)
    let configs: ComparisonConfig[]

    if (Array.isArray(parsed)) {
      // Raw array was stored — normalise it
      configs = parsed
      // Re-save in correct wrapper format so future reads work
      const storage: ComparisonConfigStorage = { configs, version: '1.0' }
      localStorage.setItem(CONFIGS_STORAGE_KEY, JSON.stringify(storage))
      console.log('🔧 Migrated raw array to wrapped storage format')
    } else if (parsed && Array.isArray(parsed.configs)) {
      configs = parsed.configs
    } else {
      console.warn('⚠️ Unexpected storage format, resetting configs')
      return []
    }

    const result = configId
      ? configs.filter(c => c.config_id === configId)
      : configs

    console.log(`📦 getSavedComparisonConfigs(${configId ?? 'all'}): ${result.length} configs`)
    return result

  } catch (error) {
    console.error('💥 Error reading comparison configs:', error)
    return []
  }
}

/**
 * Save a new comparison config.
 * Cap is 5 TOTAL across all ships/configs (cross-ship support).
 */
export function saveComparisonConfig(config: ComparisonConfig): boolean {
  if (typeof window === 'undefined') return false

  try {
    if (!config.id || !config.config_id) {
      throw new Error('Missing required fields: id or config_id')
    }

    const configs = getSavedComparisonConfigs() // all configs, no filter

    if (configs.length >= MAX_TOTAL_CONFIGS) {
      throw new Error(`Maximum ${MAX_TOTAL_CONFIGS} comparison configs allowed in total. Please delete some first.`)
    }

    if (!config.timestamp) {
      config.timestamp = new Date().toISOString()
    }

    configs.push(config)

    const storage: ComparisonConfigStorage = { configs, version: '1.0' }
    localStorage.setItem(CONFIGS_STORAGE_KEY, JSON.stringify(storage))

    console.log(`✅ Comparison config saved (${configs.length}/${MAX_TOTAL_CONFIGS} total)`)
    return true

  } catch (error) {
    console.error('💥 Error saving comparison config:', error)
    alert(error instanceof Error ? error.message : 'Failed to save comparison config')
    return false
  }
}

/**
 * Delete a comparison config by its id.
 */
export function deleteComparisonConfig(configId: string): boolean {
  if (typeof window === 'undefined') return false

  try {
    const configs = getSavedComparisonConfigs()
    const filtered = configs.filter(c => c.id !== configId)

    const storage: ComparisonConfigStorage = { configs: filtered, version: '1.0' }
    localStorage.setItem(CONFIGS_STORAGE_KEY, JSON.stringify(storage))

    console.log(`✅ Comparison config deleted: ${configId}`)
    return true
  } catch (error) {
    console.error('Error deleting comparison config:', error)
    return false
  }
}

// ============================================================================
// LOCALSTORAGE — RESULTS
// ============================================================================

export function saveOriginalResult(result: {
  config_id: string
  config_name: string
  ship_id: string
  ship_name: string
  total_duration: number
  mission_reliability: number
  phases: any[]
  equipment_final_ages: Record<string, number>
}): boolean {
  if (typeof window === 'undefined') return false

  try {
    const stored = localStorage.getItem(RESULTS_STORAGE_KEY)
    let storage: ComparisonResultStorage = stored
      ? JSON.parse(stored)
      : { comparisons: [], version: '1.0' }

    // Ensure comparisons array exists
    if (!Array.isArray(storage.comparisons)) {
      storage.comparisons = []
    }

    const existingIndex = storage.comparisons.findIndex(c => c.config_id === result.config_id)

    const comparison: StoredComparison = {
      id: `result_${result.config_id}`,
      config_id: result.config_id,
      config_name: result.config_name,
      ship_id: result.ship_id,
      ship_name: result.ship_name,
      total_duration: result.total_duration,
      original: {
        mission_reliability: result.mission_reliability,
        phases: result.phases,
        equipment_final_ages: result.equipment_final_ages,
        calculated_at: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    }

    if (existingIndex >= 0) {
      storage.comparisons[existingIndex] = comparison
    } else {
      storage.comparisons.push(comparison)
    }

    localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(storage))
    return true
  } catch (error) {
    console.error('💥 Error saving original result:', error)
    return false
  }
}

export function addAlternativeResults(
  configId: string,
  alternatives: ComparisonResult[]
): boolean {
  if (typeof window === 'undefined') return false

  try {
    const stored = localStorage.getItem(RESULTS_STORAGE_KEY)
    if (!stored) return false

    const storage: ComparisonResultStorage = JSON.parse(stored)
    const comparison = storage.comparisons.find(c => c.config_id === configId)

    if (!comparison) {
      console.error('❌ Original result not found for:', configId)
      return false
    }

    comparison.alternatives = alternatives.map(alt => ({
      comparison_id: alt.comparison_id,
      config_name: alt.config_name,
      mission_reliability: alt.mission_reliability,
      phases: alt.phases,
      equipment_final_ages: alt.equipment_final_ages,
      calculated_at: new Date().toISOString()
    }))

    localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(storage))
    return true
  } catch (error) {
    console.error('💥 Error adding alternative results:', error)
    return false
  }
}

export function getComparisonResults(configId: string): StoredComparison | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(RESULTS_STORAGE_KEY)
    if (!stored) return null

    const storage: ComparisonResultStorage = JSON.parse(stored)
    return storage.comparisons.find(c => c.config_id === configId) || null
  } catch (error) {
    console.error('Error getting results:', error)
    return null
  }
}

export function clearAllComparisons(): boolean {
  if (typeof window === 'undefined') return false

  try {
    localStorage.removeItem(CONFIGS_STORAGE_KEY)
    localStorage.removeItem(RESULTS_STORAGE_KEY)
    return true
  } catch (error) {
    console.error('Error clearing comparisons:', error)
    return false
  }
}

// Legacy aliases
export const getSavedComparisons = () => getSavedComparisonConfigs()
export const saveComparison = (c: ComparisonConfig) => saveComparisonConfig(c)
export const deleteComparison = (id: string) => deleteComparisonConfig(id)