import { listShipConfigurations } from "@/actions/mission_config/m_config"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ChevronRight, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { ShipConfiguration } from "@/components/mission_config/integrated_mission_config_dashboard"

// ===================== CONFIG SELECTION VIEW =====================
interface ConfigSelectionViewProps {
  onConfigSelect: (config: ShipConfiguration) => void
  hideNextButton?: boolean
  selectedConfigId?: string
}

export default function ConfigSelectionView({ 
  onConfigSelect, 
  hideNextButton = false,
  selectedConfigId: initialConfigId
}: ConfigSelectionViewProps) {
  const [configs, setConfigs] = useState<ShipConfiguration[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedShip, setSelectedShip] = useState<string>("")
  const [selectedConfig, setSelectedConfig] = useState<string>("")

  useEffect(() => {
    const fetchConfigs = async () => {
      setLoading(true)
      const result = await listShipConfigurations()
      if (result.success && result.data) {
        setConfigs(result.data)
      }
      setLoading(false)
    }
    fetchConfigs()
  }, [])

  // Get unique ships
  const ships = Array.from(new Set(configs.map(c => c.ship_name)))
  
  // Get configs for selected ship
  const availableConfigs = selectedShip 
    ? configs.filter(c => c.ship_name === selectedShip)
    : []

  const handleShipChange = (shipName: string) => {
    setSelectedShip(shipName)
    setSelectedConfig("") // Reset config when ship changes
  }

  const handleConfigChange = (configId: string) => {
    setSelectedConfig(configId)
    
    // In embedded mode (single window), auto-submit
    if (hideNextButton) {
      const config = configs.find(c => c.id === configId)
      if (config) {
        onConfigSelect(config)
      }
    }
  }

  const handleNext = () => {
    const config = configs.find(c => c.id === selectedConfig)
    if (config) {
      onConfigSelect(config)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 max-w-md">
        {/* Ship Dropdown */}
        <div className="space-y-2">
          <Label htmlFor="ship-select">Ship</Label>
          <Select value={selectedShip} onValueChange={handleShipChange} disabled={hideNextButton && !!selectedConfig}>
            <SelectTrigger id="ship-select">
              <SelectValue placeholder="Select a ship" />
            </SelectTrigger>
            <SelectContent>
              {ships.map((ship) => (
                <SelectItem key={ship} value={ship}>
                  {ship}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Configuration Dropdown */}
        <div className="space-y-2">
          <Label htmlFor="config-select">Configuration</Label>
          <Select 
            value={selectedConfig} 
            onValueChange={handleConfigChange}
            disabled={!selectedShip || (hideNextButton && !!selectedConfig)}
          >
            <SelectTrigger id="config-select">
              <SelectValue placeholder="Select a configuration" />
            </SelectTrigger>
            <SelectContent>
              {availableConfigs.map((config) => (
                <SelectItem key={config.id} value={config.id}>
                  {config.config_name}
                  <span className="text-xs text-muted-foreground ml-2">
                    ({new Date(config.created_date).toLocaleDateString()})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Next Button (only in standalone mode) */}
        {!hideNextButton && (
          <Button 
            onClick={handleNext} 
            disabled={!selectedConfig}
            className="gap-2 w-full"
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>

      {configs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No mission configurations found
        </div>
      )}
    </div>
  )
}