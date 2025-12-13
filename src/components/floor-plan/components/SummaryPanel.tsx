import { Sun, Layers, Cable, Zap, Hash } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PVArrayItem, RoofMask, SupplyLine, EquipmentItem, PVPanelConfig, ScaleInfo } from '../types';
import { calculateTotalPVCapacity, calculatePolygonArea, calculateLineLength } from '../utils/geometry';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SummaryPanelProps {
  pvArrays: PVArrayItem[];
  roofMasks: RoofMask[];
  lines: SupplyLine[];
  equipment: EquipmentItem[];
  pvPanelConfig: PVPanelConfig | null;
  scaleInfo: ScaleInfo;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
}

export function SummaryPanel({
  pvArrays,
  roofMasks,
  lines,
  equipment,
  pvPanelConfig,
  scaleInfo,
  selectedItemId,
  onSelectItem,
}: SummaryPanelProps) {
  const { panelCount, capacityKwp } = pvPanelConfig
    ? calculateTotalPVCapacity(pvArrays, pvPanelConfig)
    : { panelCount: 0, capacityKwp: 0 };

  const totalRoofArea = roofMasks.reduce((sum, mask) => 
    sum + calculatePolygonArea(mask.points, scaleInfo.ratio), 0
  );

  const dcCableLength = lines
    .filter(l => l.type === 'dc')
    .reduce((sum, l) => sum + calculateLineLength(l.points, scaleInfo.ratio), 0);

  const acCableLength = lines
    .filter(l => l.type === 'ac')
    .reduce((sum, l) => sum + calculateLineLength(l.points, scaleInfo.ratio), 0);

  const inverterCount = equipment.filter(e => e.type === 'Inverter').length;

  return (
    <div className="w-64 bg-card border-l flex flex-col h-full">
      <div className="p-3 border-b">
        <h2 className="font-semibold text-sm">Project Summary</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-2">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-yellow-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Capacity</p>
                    <p className="font-semibold text-sm">{capacityKwp.toFixed(1)} kWp</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Panels</p>
                    <p className="font-semibold text-sm">{panelCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Roof Masks */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">Roof Areas</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {totalRoofArea.toFixed(0)} m²
              </span>
            </div>
            {roofMasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No roof masks defined</p>
            ) : (
              <div className="space-y-1">
                {roofMasks.map((mask, i) => (
                  <button
                    key={mask.id}
                    className={`w-full text-left p-2 rounded text-xs transition-colors ${
                      selectedItemId === mask.id 
                        ? 'bg-primary/10 border border-primary' 
                        : 'bg-muted hover:bg-accent'
                    }`}
                    onClick={() => onSelectItem(mask.id)}
                  >
                    <span className="font-medium">Roof {i + 1}</span>
                    <span className="text-muted-foreground ml-2">
                      {calculatePolygonArea(mask.points, scaleInfo.ratio).toFixed(0)} m² • {mask.pitch}°
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PV Arrays */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sun className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">PV Arrays</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {pvArrays.length} arrays
              </span>
            </div>
            {pvArrays.length === 0 ? (
              <p className="text-xs text-muted-foreground">No arrays placed</p>
            ) : (
              <div className="space-y-1">
                {pvArrays.map((arr, i) => {
                  const panels = arr.rows * arr.columns;
                  const kWp = pvPanelConfig ? (panels * pvPanelConfig.wattage) / 1000 : 0;
                  return (
                    <button
                      key={arr.id}
                      className={`w-full text-left p-2 rounded text-xs transition-colors ${
                        selectedItemId === arr.id 
                          ? 'bg-primary/10 border border-primary' 
                          : 'bg-muted hover:bg-accent'
                      }`}
                      onClick={() => onSelectItem(arr.id)}
                    >
                      <span className="font-medium">Array {i + 1}</span>
                      <span className="text-muted-foreground ml-2">
                        {arr.rows}×{arr.columns} • {kWp.toFixed(1)} kWp
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cabling */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Cable className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Cabling</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between p-2 bg-muted rounded">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-orange-500 rounded" />
                  DC Cable
                </span>
                <span>{dcCableLength.toFixed(1)} m</span>
              </div>
              <div className="flex justify-between p-2 bg-muted rounded">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-blue-500 rounded" />
                  AC Cable
                </span>
                <span>{acCableLength.toFixed(1)} m</span>
              </div>
            </div>
          </div>

          {/* Equipment */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Equipment</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {equipment.length} items
              </span>
            </div>
            {equipment.length === 0 ? (
              <p className="text-xs text-muted-foreground">No equipment placed</p>
            ) : (
              <div className="space-y-1">
                {/* Group by type */}
                {Object.entries(
                  equipment.reduce((acc, eq) => {
                    acc[eq.type] = (acc[eq.type] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([type, count]) => (
                  <div key={type} className="flex justify-between p-2 bg-muted rounded text-xs">
                    <span>{type}</span>
                    <span>×{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
