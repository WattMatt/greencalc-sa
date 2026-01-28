import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Plus, Pencil, Trash2, RefreshCw, Sun, Zap, Route, Cable, Star } from 'lucide-react';
import { toast } from 'sonner';
import { 
  PlantSetupConfig, 
  SolarModuleConfig, 
  InverterLayoutConfig, 
  WalkwayConfig, 
  CableTrayConfig 
} from '../types';

interface PlantSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PlantSetupConfig;
  initialTab?: string;
  onApply: (config: PlantSetupConfig) => void;
  onSyncFromSimulation: () => void;
}

type EditingItem = {
  type: 'module' | 'inverter' | 'walkway' | 'cableTray';
  item: SolarModuleConfig | InverterLayoutConfig | WalkwayConfig | CableTrayConfig | null;
  isNew: boolean;
};

export function PlantSetupModal({ 
  isOpen, 
  onClose, 
  config, 
  initialTab = 'modules',
  onApply, 
  onSyncFromSimulation 
}: PlantSetupModalProps) {
  const [localConfig, setLocalConfig] = useState<PlantSetupConfig>(config);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [editing, setEditing] = useState<EditingItem | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalConfig(config);
      setActiveTab(initialTab);
      setEditing(null);
    }
  }, [isOpen, config, initialTab]);

  const handleApply = () => {
    onApply(localConfig);
    onClose();
    toast.success('Plant setup updated');
  };

  const handleSync = () => {
    onSyncFromSimulation();
    toast.success('Synced from Simulation');
  };

  // Module editing
  const [moduleForm, setModuleForm] = useState<SolarModuleConfig>({ 
    id: '', name: '', width: 1.134, length: 2.278, wattage: 550 
  });

  const startEditModule = (module: SolarModuleConfig | null) => {
    if (module) {
      setModuleForm(module);
    } else {
      setModuleForm({ id: `mod-${Date.now()}`, name: '', width: 1.134, length: 2.278, wattage: 550 });
    }
    setEditing({ type: 'module', item: module, isNew: !module });
  };

  const saveModule = () => {
    if (!moduleForm.name.trim()) {
      toast.error('Module name is required');
      return;
    }
    setLocalConfig(prev => {
      const existing = prev.solarModules.find(m => m.id === moduleForm.id);
      if (existing) {
        return { ...prev, solarModules: prev.solarModules.map(m => m.id === moduleForm.id ? { ...moduleForm, isDefault: m.isDefault } : m) };
      }
      const isFirst = prev.solarModules.length === 0;
      return { ...prev, solarModules: [...prev.solarModules, { ...moduleForm, isDefault: isFirst }] };
    });
    setEditing(null);
  };

  const deleteModule = (id: string) => {
    setLocalConfig(prev => {
      const filtered = prev.solarModules.filter(m => m.id !== id);
      if (filtered.length > 0 && !filtered.some(m => m.isDefault)) {
        filtered[0].isDefault = true;
      }
      return { ...prev, solarModules: filtered };
    });
  };

  const setDefaultModule = (id: string) => {
    setLocalConfig(prev => ({
      ...prev,
      solarModules: prev.solarModules.map(m => ({ ...m, isDefault: m.id === id }))
    }));
  };

  // Inverter editing
  const [inverterForm, setInverterForm] = useState<InverterLayoutConfig>({ 
    id: '', name: '', acCapacity: 50, count: 1 
  });

  const startEditInverter = (inverter: InverterLayoutConfig | null) => {
    if (inverter) {
      setInverterForm(inverter);
    } else {
      setInverterForm({ id: `inv-${Date.now()}`, name: '', acCapacity: 50, count: 1 });
    }
    setEditing({ type: 'inverter', item: inverter, isNew: !inverter });
  };

  const saveInverter = () => {
    if (!inverterForm.name.trim()) {
      toast.error('Inverter name is required');
      return;
    }
    setLocalConfig(prev => {
      const existing = prev.inverters.find(i => i.id === inverterForm.id);
      if (existing) {
        return { ...prev, inverters: prev.inverters.map(i => i.id === inverterForm.id ? { ...inverterForm, isDefault: i.isDefault } : i) };
      }
      const isFirst = prev.inverters.length === 0;
      return { ...prev, inverters: [...prev.inverters, { ...inverterForm, isDefault: isFirst }] };
    });
    setEditing(null);
  };

  const deleteInverter = (id: string) => {
    setLocalConfig(prev => {
      const filtered = prev.inverters.filter(i => i.id !== id);
      if (filtered.length > 0 && !filtered.some(i => i.isDefault)) {
        filtered[0].isDefault = true;
      }
      return { ...prev, inverters: filtered };
    });
  };

  const setDefaultInverter = (id: string) => {
    setLocalConfig(prev => ({
      ...prev,
      inverters: prev.inverters.map(i => ({ ...i, isDefault: i.id === id }))
    }));
  };

  // Walkway editing
  const [walkwayForm, setWalkwayForm] = useState<WalkwayConfig>({ 
    id: '', name: '', width: 0.6 
  });

  const startEditWalkway = (walkway: WalkwayConfig | null) => {
    if (walkway) {
      setWalkwayForm(walkway);
    } else {
      setWalkwayForm({ id: `walk-${Date.now()}`, name: '', width: 0.6 });
    }
    setEditing({ type: 'walkway', item: walkway, isNew: !walkway });
  };

  const saveWalkway = () => {
    if (!walkwayForm.name.trim()) {
      toast.error('Walkway name is required');
      return;
    }
    setLocalConfig(prev => {
      const existing = prev.walkways.find(w => w.id === walkwayForm.id);
      if (existing) {
        return { ...prev, walkways: prev.walkways.map(w => w.id === walkwayForm.id ? walkwayForm : w) };
      }
      return { ...prev, walkways: [...prev.walkways, walkwayForm] };
    });
    setEditing(null);
  };

  const deleteWalkway = (id: string) => {
    setLocalConfig(prev => ({ ...prev, walkways: prev.walkways.filter(w => w.id !== id) }));
  };

  // Cable Tray editing
  const [cableTrayForm, setCableTrayForm] = useState<CableTrayConfig>({ 
    id: '', name: '', width: 0.3 
  });

  const startEditCableTray = (tray: CableTrayConfig | null) => {
    if (tray) {
      setCableTrayForm(tray);
    } else {
      setCableTrayForm({ id: `tray-${Date.now()}`, name: '', width: 0.3 });
    }
    setEditing({ type: 'cableTray', item: tray, isNew: !tray });
  };

  const saveCableTray = () => {
    if (!cableTrayForm.name.trim()) {
      toast.error('Cable tray name is required');
      return;
    }
    setLocalConfig(prev => {
      const existing = prev.cableTrays.find(t => t.id === cableTrayForm.id);
      if (existing) {
        return { ...prev, cableTrays: prev.cableTrays.map(t => t.id === cableTrayForm.id ? cableTrayForm : t) };
      }
      return { ...prev, cableTrays: [...prev.cableTrays, cableTrayForm] };
    });
    setEditing(null);
  };

  const deleteCableTray = (id: string) => {
    setLocalConfig(prev => ({ ...prev, cableTrays: prev.cableTrays.filter(t => t.id !== id) }));
  };

  const renderModulesTab = () => (
    <div className="space-y-3">
      {editing?.type === 'module' ? (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Module Name</Label>
              <Input 
                value={moduleForm.name} 
                onChange={e => setModuleForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. JA Solar 545W"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Width (m)</Label>
              <Input 
                type="number" 
                step="0.001"
                value={moduleForm.width} 
                onChange={e => setModuleForm(prev => ({ ...prev, width: parseFloat(e.target.value) || 0 }))}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Length (m)</Label>
              <Input 
                type="number" 
                step="0.001"
                value={moduleForm.length} 
                onChange={e => setModuleForm(prev => ({ ...prev, length: parseFloat(e.target.value) || 0 }))}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Power (Wp)</Label>
              <Input 
                type="number" 
                value={moduleForm.wattage} 
                onChange={e => setModuleForm(prev => ({ ...prev, wattage: parseInt(e.target.value) || 0 }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex items-end">
              <p className="text-xs text-muted-foreground">
                Area: {(moduleForm.width * moduleForm.length).toFixed(2)} m²
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
            <Button size="sm" onClick={saveModule}>Save</Button>
          </div>
        </Card>
      ) : (
        <>
          {localConfig.solarModules.map(module => (
            <Card key={module.id} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-amber-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{module.name}</span>
                    {module.isDefault && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {module.width}m × {module.length}m | {module.wattage} Wp
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                {!module.isDefault && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDefaultModule(module.id)} title="Set as default">
                    <Star className="h-3 w-3" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditModule(module)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteModule(module.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={() => startEditModule(null)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Module
          </Button>
        </>
      )}
    </div>
  );

  const renderInvertersTab = () => (
    <div className="space-y-3">
      {editing?.type === 'inverter' ? (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Inverter Name</Label>
              <Input 
                value={inverterForm.name} 
                onChange={e => setInverterForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Sungrow SG50CX"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">AC Capacity (kW)</Label>
              <Input 
                type="number" 
                value={inverterForm.acCapacity} 
                onChange={e => setInverterForm(prev => ({ ...prev, acCapacity: parseFloat(e.target.value) || 0 }))}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Count</Label>
              <Input 
                type="number" 
                value={inverterForm.count} 
                onChange={e => setInverterForm(prev => ({ ...prev, count: parseInt(e.target.value) || 1 }))}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
            <Button size="sm" onClick={saveInverter}>Save</Button>
          </div>
        </Card>
      ) : (
        <>
          {localConfig.inverters.map(inverter => (
            <Card key={inverter.id} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{inverter.name}</span>
                    {inverter.isDefault && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {inverter.acCapacity} kW × {inverter.count} = {(inverter.acCapacity * inverter.count).toFixed(0)} kW
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                {!inverter.isDefault && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDefaultInverter(inverter.id)} title="Set as default">
                    <Star className="h-3 w-3" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditInverter(inverter)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteInverter(inverter.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={() => startEditInverter(null)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Inverter
          </Button>
        </>
      )}
    </div>
  );

  const renderWalkwaysTab = () => (
    <div className="space-y-3">
      {editing?.type === 'walkway' ? (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Walkway Name</Label>
              <Input 
                value={walkwayForm.name} 
                onChange={e => setWalkwayForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Main Access"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Width (m)</Label>
              <Input 
                type="number" 
                step="0.1"
                value={walkwayForm.width} 
                onChange={e => setWalkwayForm(prev => ({ ...prev, width: parseFloat(e.target.value) || 0 }))}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
            <Button size="sm" onClick={saveWalkway}>Save</Button>
          </div>
        </Card>
      ) : (
        <>
          {localConfig.walkways.map(walkway => (
            <Card key={walkway.id} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Route className="h-4 w-4 text-green-500" />
                <div>
                  <span className="text-sm font-medium">{walkway.name}</span>
                  <p className="text-xs text-muted-foreground">{walkway.width}m wide</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditWalkway(walkway)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteWalkway(walkway.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={() => startEditWalkway(null)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Walkway
          </Button>
        </>
      )}
    </div>
  );

  const renderCableTraysTab = () => (
    <div className="space-y-3">
      {editing?.type === 'cableTray' ? (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Cable Tray Name</Label>
              <Input 
                value={cableTrayForm.name} 
                onChange={e => setCableTrayForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. DC Trunk"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Width (m)</Label>
              <Input 
                type="number" 
                step="0.05"
                value={cableTrayForm.width} 
                onChange={e => setCableTrayForm(prev => ({ ...prev, width: parseFloat(e.target.value) || 0 }))}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
            <Button size="sm" onClick={saveCableTray}>Save</Button>
          </div>
        </Card>
      ) : (
        <>
          {localConfig.cableTrays.map(tray => (
            <Card key={tray.id} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cable className="h-4 w-4 text-orange-500" />
                <div>
                  <span className="text-sm font-medium">{tray.name}</span>
                  <p className="text-xs text-muted-foreground">{tray.width}m wide</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditCableTray(tray)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCableTray(tray.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={() => startEditCableTray(null)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Cable Tray
          </Button>
        </>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Plant Setup</span>
            <Button variant="outline" size="sm" onClick={handleSync} className="mr-6">
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync from Simulation
            </Button>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="modules" className="text-xs">
              <Sun className="h-3 w-3 mr-1" />
              Modules
              {localConfig.solarModules.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1">
                  {localConfig.solarModules.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="inverters" className="text-xs">
              <Zap className="h-3 w-3 mr-1" />
              Inverters
              {localConfig.inverters.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1">
                  {localConfig.inverters.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="walkways" className="text-xs">
              <Route className="h-3 w-3 mr-1" />
              Walkways
            </TabsTrigger>
            <TabsTrigger value="cableTrays" className="text-xs">
              <Cable className="h-3 w-3 mr-1" />
              Trays
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 max-h-80 overflow-y-auto">
            <TabsContent value="modules" className="mt-0">
              {renderModulesTab()}
            </TabsContent>
            <TabsContent value="inverters" className="mt-0">
              {renderInvertersTab()}
            </TabsContent>
            <TabsContent value="walkways" className="mt-0">
              {renderWalkwaysTab()}
            </TabsContent>
            <TabsContent value="cableTrays" className="mt-0">
              {renderCableTraysTab()}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
