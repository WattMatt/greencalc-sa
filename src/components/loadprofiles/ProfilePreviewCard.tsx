import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, ChevronDown, ChevronUp, Edit2, Check, X, Clock, Zap } from "lucide-react";

interface TradingHours {
  open: number;
  close: number;
}

interface ExtractedProfile {
  name: string;
  category: string;
  description?: string;
  kwh_per_sqm_month: number;
  load_profile_weekday: number[];
  load_profile_weekend: number[];
  trading_hours?: TradingHours;
  confidence?: number;
  source_tab?: string;
  warnings?: string[];
}

interface ProfilePreviewCardProps {
  profile: ExtractedProfile;
  isSelected: boolean;
  isNewCategory: boolean;
  onToggleSelect: () => void;
  onUpdateProfile: (updates: Partial<ExtractedProfile>) => void;
  availableCategories: string[];
}

export function ProfilePreviewCard({
  profile,
  isSelected,
  isNewCategory,
  onToggleSelect,
  onUpdateProfile,
  availableCategories
}: ProfilePreviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingKwh, setIsEditingKwh] = useState(false);
  const [editName, setEditName] = useState(profile.name);
  const [editKwh, setEditKwh] = useState(profile.kwh_per_sqm_month.toString());

  const hasWarnings = profile.warnings && profile.warnings.length > 0;
  const confidence = profile.confidence || 70;

  const getConfidenceColor = (conf: number) => {
    if (conf >= 80) return "text-green-600 bg-green-100";
    if (conf >= 60) return "text-amber-600 bg-amber-100";
    return "text-red-600 bg-red-100";
  };

  const handleSaveName = () => {
    if (editName.trim()) {
      onUpdateProfile({ name: editName.trim() });
    }
    setIsEditingName(false);
  };

  const handleSaveKwh = () => {
    const value = parseFloat(editKwh);
    if (!isNaN(value) && value > 0) {
      onUpdateProfile({ kwh_per_sqm_month: value });
    }
    setIsEditingKwh(false);
  };

  const maxWeekday = Math.max(...profile.load_profile_weekday, 1);
  const maxWeekend = Math.max(...profile.load_profile_weekend, 1);

  return (
    <Card className={`transition-all ${isSelected ? 'ring-2 ring-primary' : 'opacity-70'} ${hasWarnings ? 'border-amber-300' : ''}`}>
      <CardContent className="p-3 space-y-2">
        {/* Header row */}
        <div className="flex items-start gap-2">
          <Checkbox 
            checked={isSelected} 
            onCheckedChange={onToggleSelect}
            className="mt-1"
          />
          
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <div className="flex items-center gap-1">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-7 text-sm"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveName}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsEditingName(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="font-medium text-sm truncate">{profile.name}</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsEditingName(true)}>
                  <Edit2 className="h-3 w-3" />
                </Button>
              </div>
            )}
            
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={isNewCategory ? "outline" : "secondary"} className="text-xs">
                {profile.category}
                {isNewCategory && " (new)"}
              </Badge>
              
              <Badge className={`text-xs ${getConfidenceColor(confidence)}`}>
                {confidence}%
              </Badge>
              
              {hasWarnings && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <ul className="text-xs space-y-1">
                        {profile.warnings?.map((w, i) => (
                          <li key={i}>• {w}</li>
                        ))}
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
          
          {/* kWh display */}
          <div className="text-right">
            {isEditingKwh ? (
              <div className="flex items-center gap-1">
                <Input
                  value={editKwh}
                  onChange={(e) => setEditKwh(e.target.value)}
                  className="h-7 w-16 text-sm text-right"
                  type="number"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveKwh()}
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveKwh}>
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <div className="text-right">
                  <div className="font-mono text-sm font-medium flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {profile.kwh_per_sqm_month}
                  </div>
                  <div className="text-xs text-muted-foreground">kWh/m²/mo</div>
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsEditingKwh(true)}>
                  <Edit2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Mini profile visualization */}
        <div className="flex items-end gap-[1px] h-8 bg-muted/30 rounded p-1">
          {profile.load_profile_weekday.map((val, i) => (
            <div
              key={i}
              className="flex-1 bg-primary/70 rounded-sm transition-all hover:bg-primary"
              style={{ height: `${(val / maxWeekday) * 100}%` }}
              title={`${i}:00 - ${val.toFixed(1)}%`}
            />
          ))}
        </div>

        {/* Trading hours */}
        {profile.trading_hours && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {profile.trading_hours.open}:00 - {profile.trading_hours.close}:00
            </span>
          </div>
        )}

        {/* Expand/collapse for details */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full h-6 text-xs"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" /> Less details
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" /> More details
            </>
          )}
        </Button>

        {/* Expanded details */}
        {isExpanded && (
          <div className="space-y-3 pt-2 border-t">
            {profile.description && (
              <p className="text-xs text-muted-foreground">{profile.description}</p>
            )}
            
            {/* Weekday vs Weekend comparison */}
            <div className="space-y-1">
              <div className="text-xs font-medium">Weekday Profile</div>
              <div className="flex items-end gap-[1px] h-10 bg-muted/30 rounded p-1">
                {profile.load_profile_weekday.map((val, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-blue-500/70 rounded-sm"
                    style={{ height: `${(val / maxWeekday) * 100}%` }}
                    title={`${i}:00 - ${val.toFixed(1)}%`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:00</span>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="text-xs font-medium">Weekend Profile</div>
              <div className="flex items-end gap-[1px] h-10 bg-muted/30 rounded p-1">
                {profile.load_profile_weekend.map((val, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-green-500/70 rounded-sm"
                    style={{ height: `${(val / maxWeekend) * 100}%` }}
                    title={`${i}:00 - ${val.toFixed(1)}%`}
                  />
                ))}
              </div>
            </div>
            
            {/* Source tab */}
            {profile.source_tab && (
              <div className="text-xs text-muted-foreground">
                Source: <span className="font-mono">{profile.source_tab}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
