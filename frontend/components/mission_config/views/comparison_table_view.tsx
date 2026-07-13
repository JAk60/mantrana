// frontend/src/components/Drishti/mission_config/chat/comparison_table_view.tsx

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Trash2,
  Download,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  FileText
} from "lucide-react"
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

// Import the NEW storage functions
import type { StoredComparison } from '@/actions/mission_config/batch_comparison'

interface ComparisonTableViewProps {
  onBack: () => void
}

// ============================================================================
// STORAGE FUNCTIONS - Direct localStorage access
// ============================================================================

const RESULTS_STORAGE_KEY = 'mission_comparison_results'

interface ComparisonResultStorage {
  comparisons: StoredComparison[]
  version: string
}

function getAllStoredResults(): StoredComparison[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(RESULTS_STORAGE_KEY)
    if (!stored) return []
    
    const data: ComparisonResultStorage = JSON.parse(stored)
    return data.comparisons || []
  } catch (error) {
    console.error('Error loading results:', error)
    return []
  }
}

function deleteStoredResult(id: string): boolean {
  if (typeof window === 'undefined') return false
  
  try {
    const stored = localStorage.getItem(RESULTS_STORAGE_KEY)
    if (!stored) return false
    
    const data: ComparisonResultStorage = JSON.parse(stored)
    const filtered = data.comparisons.filter(c => c.id !== id)
    
    const updated: ComparisonResultStorage = {
      comparisons: filtered,
      version: data.version || '1.0'
    }
    
    localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(updated))
    return true
  } catch (error) {
    console.error('Error deleting result:', error)
    return false
  }
}

function exportAllResults(): void {
  if (typeof window === 'undefined') return
  
  try {
    const comparisons = getAllStoredResults()
    
    if (comparisons.length === 0) {
      toast.warning('No comparisons to export')
      return
    }
    
    const dataStr = JSON.stringify(comparisons, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `mission_comparisons_${new Date().toISOString().split('T')[0]}.json`
    link.click()
    
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error exporting results:', error)
    toast.error('Failed to export comparisons')
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ComparisonTableView({ onBack }: ComparisonTableViewProps) {
  const [comparisons, setComparisons] = useState<StoredComparison[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadComparisons()
  }, [])

  const loadComparisons = () => {
    setLoading(true)
    try {
      const data = getAllStoredResults()
      console.log('📊 Loaded comparisons for table:', data)
      setComparisons(data)
    } catch (error) {
      console.error('Error loading comparisons:', error)
      toast.error('Failed to load comparisons')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this comparison? This will remove both original and alternative results.')) return
    
    const success = deleteStoredResult(id)
    if (success) {
      toast.success('Comparison deleted')
      loadComparisons()
    } else {
      toast.error('Failed to delete comparison')
    }
  }

  const handleExport = () => {
    exportAllResults()
    toast.success('Comparisons exported')
  }

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`
  }

  const getDeltas = (comp: StoredComparison) => {
    if (!comp.alternatives || comp.alternatives.length === 0) return []
    
    return comp.alternatives.map(alt => ({
      name: alt.config_name,
      reliability: alt.mission_reliability,
      delta: (alt.mission_reliability - comp.original.mission_reliability) * 100
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Loading comparisons...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Button 
          variant="outline" 
          onClick={handleExport} 
          className="gap-2"
          disabled={comparisons.length === 0}
        >
          <Download className="w-4 h-4" />
          Export All
        </Button>
      </div>

      <Card className="bg-black border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Mission Comparisons</CardTitle>
          <p className="text-sm text-gray-500">
            {comparisons.length} comparison{comparisons.length !== 1 ? 's' : ''} saved
          </p>
        </CardHeader>
        <CardContent>
          {comparisons.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-600" />
              <p className="text-gray-500">No comparisons yet</p>
              <p className="text-sm text-gray-600">
                Calculate a mission configuration to create your first comparison
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {comparisons.map((comp) => {
                const deltas = getDeltas(comp)
                
                return (
                  <div key={comp.id} className="border border-gray-800 rounded-lg overflow-hidden">
                    {/* Header */}
                    <div className="bg-gray-900 p-4 flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">{comp.config_name}</h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <span>{comp.ship_name}</span>
                          <span>•</span>
                          <span>{comp.total_duration}h total</span>
                          <span>•</span>
                          <span>{new Date(comp.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(comp.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Original Result */}
                    <div className="p-4 bg-black border-b border-gray-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-500 mb-1">Original Configuration</div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-900/30 text-green-400 border-green-700">
                              {formatPercent(comp.original.mission_reliability)}
                            </Badge>
                            <span className="text-xs text-gray-600">
                              Calculated: {new Date(comp.original.calculated_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          {comp.original.phases.length} phases
                        </div>
                      </div>
                    </div>

                    {/* Alternative Results */}
                    {deltas.length > 0 ? (
                      <div className="p-4 bg-black">
                        <div className="text-sm text-gray-500 mb-3">
                          Alternative Configurations ({deltas.length})
                        </div>
                        <div className="space-y-2">
                          {deltas.map((delta, index) => (
                            <div 
                              key={index}
                              className="flex items-center justify-between p-3 bg-gray-900 rounded-lg border border-gray-800"
                            >
                              <div className="flex-1">
                                <div className="font-medium text-white text-sm">{delta.name}</div>
                                <div className="flex items-center gap-3 mt-1">
                                  <Badge className="bg-blue-900/30 text-blue-400 border-blue-700 text-xs">
                                    {formatPercent(delta.reliability)}
                                  </Badge>
                                  <div className="flex items-center gap-1">
                                    {delta.delta < 0 ? (
                                      <>
                                        <TrendingDown className="w-3 h-3 text-red-400" />
                                        <span className="text-xs text-red-400">{delta.delta.toFixed(2)}%</span>
                                      </>
                                    ) : delta.delta > 0 ? (
                                      <>
                                        <TrendingUp className="w-3 h-3 text-green-400" />
                                        <span className="text-xs text-green-400">+{delta.delta.toFixed(2)}%</span>
                                      </>
                                    ) : (
                                      <span className="text-xs text-gray-500">0.00%</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-black">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <FileText className="w-4 h-4" />
                          <span>No alternative configurations calculated yet</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}