import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Plus, Pencil, Trash2, RefreshCw, Sun, Zap, Route, Cable, Star, CircleDot } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  PlantSetupConfig, 
  SolarModuleConfig, 
  InverterLayoutConfig, 
  WalkwayConfig, 
  CableTrayConfig,
  DCCableConfig,
  ACCableConfig,
  CableMaterial
} from '../types';
import { DimensionInput } from './DimensionInput';

interface PlantSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PlantSetupConfig;
  initialTab?: string;
  onApply: (config: PlantSetupConfig) => void;
  onSyncFromSimulation: () => void;
}

type EditingItem = {
  type: 'module' | 'inverter' | 'walkway' | 'cableTray' | 'dcCable' | 'acCable';
  item: SolarModuleConfig | InverterLayoutConfig | WalkwayConfig | CableTrayConfig | DCCableConfig | ACCableConfig | null;
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
    id: '', name: '', acCapacity: 50, count: 1, width: 0.7, height: 0.5 
  });

  const startEditInverter = (inverter: InverterLayoutConfig | null) => {
    if (inverter) {
      setInverterForm({
        ...inverter,
        width: inverter.width ?? 0.7,
        height: inverter.height ?? 0.5,
      });
    } else {
      setInverterForm({ id: `inv-${Date.now()}`, name: '', acCapacity: 50, count: 1, width: 0.7, height: 0.5 });
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
    id: '', name: '', width: 0.6, length: 10 
  });

  const startEditWalkway = (walkway: WalkwayConfig | null) => {
    if (walkway) {
      setWalkwayForm({ ...walkway, length: walkway.length ?? 10 });
    } else {
      setWalkwayForm({ id: `walk-${Date.now()}`, name: '', width: 0.6, length: 10 });
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
    id: '', name: '', width: 0.3, length: 10 
  });

  const startEditCableTray = (tray: CableTrayConfig | null) => {
    if (tray) {
      setCableTrayForm({ ...tray, length: tray.length ?? 10 });
    } else {
      setCableTrayForm({ id: `tray-${Date.now()}`, name: '', width: 0.3, length: 10 });
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

  // DC Cable editing
  const [dcCableForm, setDcCableForm] = useState<DCCableConfig>({ 
    id: '', name: '', diameter: 6, material: 'copper' 
  });

  const startEditDcCable = (cable: DCCableConfig | null) => {
    if (cable) {
      setDcCableForm(cable);
    } else {
      setDcCableForm({ id: `dc-${Date.now()}`, name: '', diameter: 6, material: 'copper' });
    }
    setEditing({ type: 'dcCable', item: cable, isNew: !cable });
  };

  const saveDcCable = () => {
    if (!dcCableForm.name.trim()) {
      toast.error('DC cable name is required');
      return;
    }
    setLocalConfig(prev => {
      const existing = prev.dcCables?.find(c => c.id === dcCableForm.id);
      if (existing) {
        return { ...prev, dcCables: prev.dcCables.map(c => c.id === dcCableForm.id ? { ...dcCableForm, isDefault: c.isDefault } : c) };
      }
      const isFirst = !prev.dcCables || prev.dcCables.length === 0;
      return { ...prev, dcCables: [...(prev.dcCables || []), { ...dcCableForm, isDefault: isFirst }] };
    });
    setEditing(null);
  };

  const deleteDcCable = (id: string) => {
    setLocalConfig(prev => {
      const filtered = (prev.dcCables || []).filter(c => c.id !== id);
      if (filtered.length > 0 && !filtered.some(c => c.isDefault)) {
        filtered[0].isDefault = true;
      }
      return { ...prev, dcCables: filtered };
    });
  };

  const setDefaultDcCable = (id: string) => {
    setLocalConfig(prev => ({
      ...prev,
      dcCables: (prev.dcCables || []).map(c => ({ ...c, isDefault: c.id === id }))
    }));
  };

  // AC Cable editing
  const [acCableForm, setAcCableForm] = useState<ACCableConfig>({ 
    id: '', name: '', diameter: 25, material: 'copper' 
  });

  const startEditAcCable = (cable: ACCableConfig | null) => {
    if (cable) {
      setAcCableForm(cable);
    } else {
      setAcCableForm({ id: `ac-${Date.now()}`, name: '', diameter: 25, material: 'copper' });
    }
    setEditing({ type: 'acCable', item: cable, isNew: !cable });
  };

  const saveAcCable = () => {
    if (!acCableForm.name.trim()) {
      toast.error('AC cable name is required');
      return;
    }
    setLocalConfig(prev => {
      const existing = prev.acCables?.find(c => c.id === acCableForm.id);
      if (existing) {
        return { ...prev, acCables: prev.acCables.map(c => c.id === acCableForm.id ? { ...acCableForm, isDefault: c.isDefault } : c) };
      }
      const isFirst = !prev.acCables || prev.acCables.length === 0;
      return { ...prev, acCables: [...(prev.acCables || []), { ...acCableForm, isDefault: isFirst }] };
    });
    setEditing(null);
  };

  const deleteAcCable = (id: string) => {
    setLocalConfig(prev => {
      const filtered = (prev.acCables || []).filter(c => c.id !== id);
      if (filtered.length > 0 && !filtered.some(c => c.isDefault)) {
        filtered[0].isDefault = true;
      }
      return { ...prev, acCables: filtered };
    });
  };

  const setDefaultAcCable = (id: string) => {
    setLocalConfig(prev => ({
      ...prev,
      acCables: (prev.acCables || []).map(c => ({ ...c, isDefault: c.id === id }))
    }));
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
            <DimensionInput
              label="Width"
              value={moduleForm.width}
              onChange={(v) => setModuleForm(prev => ({ ...prev, width: v }))}
            />
            <DimensionInput
              label="Length"
              value={moduleForm.length}
              onChange={(v) => setModuleForm(prev => ({ ...prev, length: v }))}
            />
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
            <DimensionInput
              label="Width"
              value={inverterForm.width ?? 0.7}
              onChange={(v) => setInverterForm(prev => ({ ...prev, width: v }))}
            />
            <DimensionInput
              label="Height"
              value={inverterForm.height ?? 0.5}
              onChange={(v) => setInverterForm(prev => ({ ...prev, height: v }))}
            />
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
                    {inverter.width && inverter.height && (
                      <span className="ml-2">| {(inverter.width * 100).toFixed(0)}×{(inverter.height * 100).toFixed(0)} cm</span>
                    )}
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
            <DimensionInput
              label="Width"
              value={walkwayForm.width}
              onChange={(v) => setWalkwayForm(prev => ({ ...prev, width: v }))}
            />
            <DimensionInput
              label="Length"
              value={walkwayForm.length}
              onChange={(v) => setWalkwayForm(prev => ({ ...prev, length: v }))}
            />
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
                  <p className="text-xs text-muted-foreground">{walkway.width}m × {walkway.length ?? '-'}m</p>
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
            <DimensionInput
              label="Width"
              value={cableTrayForm.width}
              onChange={(v) => setCableTrayForm(prev => ({ ...prev, width: v }))}
            />
            <DimensionInput
              label="Length"
              value={cableTrayForm.length}
              onChange={(v) => setCableTrayForm(prev => ({ ...prev, length: v }))}
            />
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
                  <p className="text-xs text-muted-foreground">{tray.width}m × {tray.length ?? '-'}m</p>
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

  const renderDcCablesTab = () => (
    <div className="space-y-3">
      {editing?.type === 'dcCable' ? (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Cable Name</Label>
              <Input 
                value={dcCableForm.name} 
                onChange={e => setDcCableForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. 6mm² DC String"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Diameter (mm²)</Label>
              <Select 
                value={dcCableForm.diameter.toString()} 
                onValueChange={(v) => setDcCableForm(prev => ({ ...prev, diameter: parseFloat(v) }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4 mm²</SelectItem>
                  <SelectItem value="6">6 mm²</SelectItem>
                  <SelectItem value="10">10 mm²</SelectItem>
                  <SelectItem value="16">16 mm²</SelectItem>
                  <SelectItem value="25">25 mm²</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Material</Label>
              <Select 
                value={dcCableForm.material} 
                onValueChange={(v) => setDcCableForm(prev => ({ ...prev, material: v as CableMaterial }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="copper">Copper</SelectItem>
                  <SelectItem value="aluminum">Aluminum</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
            <Button size="sm" onClick={saveDcCable}>Save</Button>
          </div>
        </Card>
      ) : (
        <>
          {(localConfig.dcCables || []).map(cable => (
            <Card key={cable.id} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-orange-500 rounded" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{cable.name}</span>
                    {cable.isDefault && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {cable.diameter} mm² | {cable.material}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                {!cable.isDefault && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDefaultDcCable(cable.id)} title="Set as default">
                    <Star className="h-3 w-3" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditDcCable(cable)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteDcCable(cable.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={() => startEditDcCable(null)}>
            <Plus className="h-4 w-4 mr-2" />
            Add DC Cable
          </Button>
        </>
      )}
    </div>
  );

  const renderAcCablesTab = () => (
    <div className="space-y-3">
      {editing?.type === 'acCable' ? (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Cable Name</Label>
              <Input 
                value={acCableForm.name} 
                onChange={e => setAcCableForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. 25mm² AC Main"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Diameter (mm²)</Label>
              <Select 
                value={acCableForm.diameter.toString()} 
                onValueChange={(v) => setAcCableForm(prev => ({ ...prev, diameter: parseFloat(v) }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16">16 mm²</SelectItem>
                  <SelectItem value="25">25 mm²</SelectItem>
                  <SelectItem value="35">35 mm²</SelectItem>
                  <SelectItem value="50">50 mm²</SelectItem>
                  <SelectItem value="70">70 mm²</SelectItem>
                  <SelectItem value="95">95 mm²</SelectItem>
                  <SelectItem value="120">120 mm²</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Material</Label>
              <Select 
                value={acCableForm.material} 
                onValueChange={(v) => setAcCableForm(prev => ({ ...prev, material: v as CableMaterial }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="copper">Copper</SelectItem>
                  <SelectItem value="aluminum">Aluminum</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
            <Button size="sm" onClick={saveAcCable}>Save</Button>
          </div>
        </Card>
      ) : (
        <>
          {(localConfig.acCables || []).map(cable => (
            <Card key={cable.id} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-blue-500 rounded" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{cable.name}</span>
                    {cable.isDefault && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {cable.diameter} mm² | {cable.material}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                {!cable.isDefault && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDefaultAcCable(cable.id)} title="Set as default">
                    <Star className="h-3 w-3" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditAcCable(cable)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteAcCable(cable.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={() => startEditAcCable(null)}>
            <Plus className="h-4 w-4 mr-2" />
            Add AC Cable
          </Button>
        </>
      )}
    </div>
  );

  const getTitle = () => {
    switch (activeTab) {
      case 'modules': return 'Solar Modules';
      case 'inverters': return 'Inverters';
      case 'walkways': return 'Walkways';
      case 'cableTrays': return 'Cable Trays';
      case 'dcCables': return 'DC Cables';
      case 'acCables': return 'AC Cables';
      default: return 'Plant Setup';
    }
  };

  const getIcon = () => {
    switch (activeTab) {
      case 'modules': return <Sun className="h-5 w-5 text-amber-500" />;
      case 'inverters': return <Zap className="h-5 w-5 text-blue-500" />;
      case 'walkways': return <Route className="h-5 w-5 text-green-500" />;
      case 'cableTrays': return <Cable className="h-5 w-5 text-orange-500" />;
      case 'dcCables': return <div className="w-5 h-0.5 bg-orange-500 rounded" />;
      case 'acCables': return <div className="w-5 h-0.5 bg-blue-500 rounded" />;
      default: return null;
    }
  };

  const showSyncButton = activeTab === 'modules' || activeTab === 'inverters';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            <span>{getTitle()}</span>
            {showSyncButton && (
              <Button variant="outline" size="sm" onClick={handleSync} className="ml-auto mr-6">
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync from Simulation
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto">
          {activeTab === 'modules' && renderModulesTab()}
          {activeTab === 'inverters' && renderInvertersTab()}
          {activeTab === 'walkways' && renderWalkwaysTab()}
          {activeTab === 'cableTrays' && renderCableTraysTab()}
          {activeTab === 'dcCables' && renderDcCablesTab()}
          {activeTab === 'acCables' && renderAcCablesTab()}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
