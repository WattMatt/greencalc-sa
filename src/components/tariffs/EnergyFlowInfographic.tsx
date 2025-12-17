import { useState, useEffect } from "react";
import { Sun, Battery, Fuel, Zap, Home, Power, ArrowRight, ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

type SystemType = "grid-tied" | "hybrid" | "generator" | "solar-generator";
type OperationMode = "normal" | "loadshedding";

interface EnergyFlowInfographicProps {
  systemType: SystemType;
  className?: string;
}

// Animated energy particle
function EnergyParticle({ active, color }: { active: boolean; color: string }) {
  if (!active) return null;
  
  return (
    <div 
      className={cn("absolute w-2 h-2 rounded-full", color)}
      style={{
        animation: "flowParticle 1.5s ease-in-out infinite",
        boxShadow: `0 0 8px currentColor`,
      }}
    />
  );
}

// Animated flow line with particles
function FlowLine({ 
  active, 
  color, 
  direction = "right",
  className
}: { 
  active: boolean; 
  color: string; 
  direction?: "right" | "left" | "down" | "up";
  className?: string;
}) {
  const isHorizontal = direction === "right" || direction === "left";
  const baseStyles = isHorizontal 
    ? "h-1 flex-1 min-w-8" 
    : "w-1 h-8";

  return (
    <div className={cn(
      "relative rounded-full overflow-hidden transition-all duration-500",
      baseStyles,
      active ? "opacity-100" : "opacity-20",
      className
    )}>
      {/* Background track */}
      <div className={cn("absolute inset-0 rounded-full", active ? color : "bg-muted")} />
      
      {/* Animated glow */}
      {active && (
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background: isHorizontal 
              ? `linear-gradient(${direction === "right" ? "90deg" : "270deg"}, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)`
              : `linear-gradient(${direction === "down" ? "180deg" : "0deg"}, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)`,
            backgroundSize: isHorizontal ? "200% 100%" : "100% 200%",
            animation: `flow${direction.charAt(0).toUpperCase() + direction.slice(1)} 1s linear infinite`,
          }}
        />
      )}
    </div>
  );
}

// Component node (sun, battery, etc.)
function ComponentNode({ 
  icon: Icon, 
  label, 
  active, 
  color,
  pulse = false,
  size = "md",
  statusText
}: { 
  icon: React.ElementType; 
  label: string; 
  active: boolean; 
  color: string;
  pulse?: boolean;
  size?: "sm" | "md" | "lg";
  statusText?: string;
}) {
  const sizeClasses = {
    sm: "w-10 h-10",
    md: "w-14 h-14",
    lg: "w-18 h-18",
  };
  const iconSizes = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-8 w-8" };

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={cn(
        sizeClasses[size],
        "rounded-xl flex items-center justify-center transition-all duration-500 border-2 relative",
        active ? `${color} border-current shadow-lg` : "bg-muted/30 border-muted/50 text-muted-foreground",
        pulse && active && "animate-pulse"
      )}>
        <Icon className={cn(iconSizes[size], "transition-transform", active && "scale-110")} />
        {active && (
          <div 
            className="absolute inset-0 rounded-xl opacity-50"
            style={{ 
              boxShadow: "inset 0 0 20px currentColor",
            }} 
          />
        )}
      </div>
      <span className={cn(
        "text-[10px] font-medium transition-colors text-center leading-tight",
        active ? "text-foreground" : "text-muted-foreground"
      )}>
        {label}
      </span>
      {statusText && (
        <span className={cn(
          "text-[9px] transition-colors",
          active ? "text-current opacity-70" : "text-muted-foreground/50"
        )}>
          {statusText}
        </span>
      )}
    </div>
  );
}

// Grid-Tied Solar System
function GridTiedFlow({ mode }: { mode: OperationMode }) {
  const isNormal = mode === "normal";
  
  return (
    <div className="space-y-3">
      {/* Main flow: Sun -> Inverter -> Loads */}
      <div className="flex items-center justify-center gap-2 px-2">
        <ComponentNode 
          icon={Sun} 
          label="Solar PV" 
          active={isNormal} 
          color="bg-yellow-500/20 text-yellow-500"
          pulse={isNormal}
          size="sm"
          statusText={isNormal ? "Generating" : "Offline"}
        />
        <FlowLine active={isNormal} color="bg-yellow-500" direction="right" />
        <ComponentNode 
          icon={Zap} 
          label="Inverter" 
          active={isNormal} 
          color="bg-blue-500/20 text-blue-500"
          size="sm"
          statusText={isNormal ? "Converting" : "Shutdown"}
        />
        <FlowLine active={isNormal} color="bg-emerald-500" direction="right" />
        <ComponentNode 
          icon={Home} 
          label="Loads" 
          active={isNormal} 
          color="bg-emerald-500/20 text-emerald-500"
          size="sm"
          statusText={isNormal ? "Powered" : "No Power"}
        />
      </div>
      
      {/* Grid connection */}
      <div className="flex items-center justify-center">
        <div className="flex flex-col items-center gap-1">
          <FlowLine active={isNormal} color="bg-gray-500" direction="down" />
          <ComponentNode 
            icon={Power} 
            label="Grid" 
            active={isNormal} 
            color="bg-gray-500/20 text-gray-500"
            size="sm"
            statusText={isNormal ? "Connected" : "Offline"}
          />
        </div>
      </div>

      <div className={cn(
        "text-center p-2.5 rounded-lg transition-all duration-500 border",
        isNormal 
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
          : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
      )}>
        <p className="text-xs font-semibold">
          {isNormal ? "✓ Normal Operation" : "✗ System Offline"}
        </p>
        <p className="text-[10px] opacity-80 mt-0.5">
          {isNormal 
            ? "Solar generates power, excess feeds to grid" 
            : "Anti-islanding protection shuts down inverter"}
        </p>
      </div>
    </div>
  );
}

// Hybrid Solar + Battery System
function HybridFlow({ mode }: { mode: OperationMode }) {
  const isNormal = mode === "normal";
  
  return (
    <div className="space-y-2">
      {/* Top row: Sun -> Inverter -> Loads */}
      <div className="flex items-center justify-center gap-2 px-2">
        <ComponentNode 
          icon={Sun} 
          label="Solar PV" 
          active={true} 
          color="bg-yellow-500/20 text-yellow-500"
          pulse
          size="sm"
          statusText="Generating"
        />
        <FlowLine active={true} color="bg-yellow-500" direction="right" />
        <ComponentNode 
          icon={Zap} 
          label="Hybrid Inverter" 
          active={true} 
          color="bg-blue-500/20 text-blue-500"
          size="sm"
          statusText="Active"
        />
        <FlowLine active={true} color="bg-emerald-500" direction="right" />
        <ComponentNode 
          icon={Home} 
          label="Loads" 
          active={true} 
          color="bg-emerald-500/20 text-emerald-500"
          size="sm"
          statusText="Powered"
        />
      </div>

      {/* Battery row */}
      <div className="flex items-center justify-center gap-2">
        <div className="w-10" />
        <div className="flex items-center gap-2">
          <FlowLine 
            active={true} 
            color={isNormal ? "bg-emerald-500" : "bg-orange-500"} 
            direction={isNormal ? "down" : "up"} 
            className="!h-6"
          />
        </div>
        <ComponentNode 
          icon={Battery} 
          label="Battery" 
          active={true} 
          color="bg-emerald-500/20 text-emerald-500"
          pulse={!isNormal}
          size="sm"
          statusText={isNormal ? "Charging" : "Discharging"}
        />
        <div className="w-10" />
        <div className="w-10" />
      </div>

      {/* Grid */}
      <div className="flex items-center justify-center gap-2">
        <ComponentNode 
          icon={Power} 
          label="Grid" 
          active={isNormal} 
          color="bg-gray-500/20 text-gray-500"
          size="sm"
          statusText={isNormal ? "Connected" : "Offline"}
        />
        <FlowLine active={isNormal} color="bg-gray-500" direction="right" className="max-w-16" />
        <ArrowRight className={cn(
          "h-4 w-4 transition-all",
          isNormal ? "text-gray-500" : "text-muted-foreground/30"
        )} />
      </div>

      <div className={cn(
        "text-center p-2.5 rounded-lg transition-all duration-500 border",
        "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
      )}>
        <p className="text-xs font-semibold">✓ Always Operational</p>
        <p className="text-[10px] opacity-80 mt-0.5">
          {isNormal 
            ? "Solar powers loads & charges battery, grid backup" 
            : "Battery provides instant backup (<20ms), solar recharges"}
        </p>
      </div>
    </div>
  );
}

// Generator Only System
function GeneratorFlow({ mode }: { mode: OperationMode }) {
  const isNormal = mode === "normal";
  
  return (
    <div className="space-y-3">
      {/* Main row */}
      <div className="flex items-center justify-center gap-2 px-2">
        <ComponentNode 
          icon={Power} 
          label="Grid" 
          active={isNormal} 
          color="bg-gray-500/20 text-gray-500"
          size="sm"
          statusText={isNormal ? "Active" : "Offline"}
        />
        <FlowLine active={isNormal} color="bg-gray-500" direction="right" />
        <ComponentNode 
          icon={Zap} 
          label="ATS Switch" 
          active={true} 
          color="bg-blue-500/20 text-blue-500"
          size="sm"
          statusText={isNormal ? "Grid Mode" : "Gen Mode"}
        />
        <FlowLine active={true} color={isNormal ? "bg-gray-500" : "bg-orange-500"} direction="right" />
        <ComponentNode 
          icon={Home} 
          label="Loads" 
          active={true} 
          color="bg-emerald-500/20 text-emerald-500"
          size="sm"
          statusText="Powered"
        />
      </div>

      {/* Generator row */}
      <div className="flex items-center justify-center gap-2">
        <ComponentNode 
          icon={Fuel} 
          label="Generator" 
          active={!isNormal} 
          color="bg-orange-500/20 text-orange-500"
          pulse={!isNormal}
          size="sm"
          statusText={!isNormal ? "Running" : "Standby"}
        />
        <FlowLine active={!isNormal} color="bg-orange-500" direction="right" className="max-w-20" />
        <ArrowUp className={cn(
          "h-4 w-4 transition-all",
          !isNormal ? "text-orange-500 animate-bounce" : "text-muted-foreground/30"
        )} />
      </div>

      <div className={cn(
        "text-center p-2.5 rounded-lg transition-all duration-500 border",
        "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
      )}>
        <p className="text-xs font-semibold">✓ Backup Available</p>
        <p className="text-[10px] opacity-80 mt-0.5">
          {isNormal 
            ? "Grid powers loads, generator on standby" 
            : "ATS switches to generator (10-30 sec switchover delay)"}
        </p>
      </div>
    </div>
  );
}

// Solar + Generator Hybrid System
function SolarGeneratorFlow({ mode }: { mode: OperationMode }) {
  const isNormal = mode === "normal";
  
  return (
    <div className="space-y-2">
      {/* Top row: Sun -> Inverter -> Loads */}
      <div className="flex items-center justify-center gap-2 px-2">
        <ComponentNode 
          icon={Sun} 
          label="Solar PV" 
          active={true} 
          color="bg-yellow-500/20 text-yellow-500"
          pulse
          size="sm"
          statusText="Generating"
        />
        <FlowLine active={true} color="bg-yellow-500" direction="right" />
        <ComponentNode 
          icon={Zap} 
          label="Hybrid Inverter" 
          active={true} 
          color="bg-blue-500/20 text-blue-500"
          size="sm"
          statusText="Active"
        />
        <FlowLine active={true} color="bg-emerald-500" direction="right" />
        <ComponentNode 
          icon={Home} 
          label="Loads" 
          active={true} 
          color="bg-emerald-500/20 text-emerald-500"
          size="sm"
          statusText="Powered"
        />
      </div>

      {/* Middle: Battery + Grid/Generator */}
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <ComponentNode 
            icon={Power} 
            label="Grid" 
            active={isNormal} 
            color="bg-gray-500/20 text-gray-500"
            size="sm"
            statusText={isNormal ? "Connected" : "Offline"}
          />
          <FlowLine active={isNormal} color="bg-gray-500" direction="right" className="max-w-12" />
        </div>
        
        <div className="flex flex-col items-center">
          <FlowLine 
            active={true} 
            color="bg-emerald-500" 
            direction={isNormal ? "down" : "up"} 
            className="!h-5"
          />
          <ComponentNode 
            icon={Battery} 
            label="Battery" 
            active={true} 
            color="bg-emerald-500/20 text-emerald-500"
            size="sm"
            statusText={isNormal ? "Charging" : "Discharging"}
          />
        </div>

        <div className="flex items-center gap-2">
          <FlowLine active={!isNormal} color="bg-orange-500" direction="left" className="max-w-12" />
          <ComponentNode 
            icon={Fuel} 
            label="Generator" 
            active={!isNormal} 
            color="bg-orange-500/20 text-orange-500"
            pulse={!isNormal}
            size="sm"
            statusText={!isNormal ? "Running" : "Standby"}
          />
        </div>
      </div>

      <div className={cn(
        "text-center p-2.5 rounded-lg transition-all duration-500 border",
        "bg-primary/10 border-primary/20 text-primary"
      )}>
        <p className="text-xs font-semibold">✓ Maximum Resilience</p>
        <p className="text-[10px] opacity-80 mt-0.5">
          {isNormal 
            ? "Solar + grid power loads, battery charges, gen standby" 
            : "Battery instant backup, generator extends autonomy indefinitely"}
        </p>
      </div>
    </div>
  );
}

export function EnergyFlowInfographic({ systemType, className }: EnergyFlowInfographicProps) {
  const [mode, setMode] = useState<OperationMode>("normal");
  const [isAnimating, setIsAnimating] = useState(true); // Always start with auto-play

  // Auto-cycle between modes
  useEffect(() => {
    if (!isAnimating) return;
    const interval = setInterval(() => {
      setMode(prev => prev === "normal" ? "loadshedding" : "normal");
    }, 3500);
    return () => clearInterval(interval);
  }, [isAnimating]);

  const FlowComponent = {
    "grid-tied": GridTiedFlow,
    "hybrid": HybridFlow,
    "generator": GeneratorFlow,
    "solar-generator": SolarGeneratorFlow,
  }[systemType];

  return (
    <div className={cn("space-y-3", className)}>
      {/* CSS for animations */}
      <style>{`
        @keyframes flowRight {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes flowLeft {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes flowDown {
          0% { background-position: 0 -200%; }
          100% { background-position: 0 200%; }
        }
        @keyframes flowUp {
          0% { background-position: 0 200%; }
          100% { background-position: 0 -200%; }
        }
      `}</style>

      {/* Mode indicator */}
      <div className="flex items-center justify-center">
        <div className={cn(
          "px-3 py-1 text-[10px] font-medium rounded-full border transition-all",
          mode === "normal" 
            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" 
            : "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30"
        )}>
          {mode === "normal" ? "● Normal Operation" : "● Load Shedding"}
        </div>
      </div>

      {/* Flow diagram */}
      <div className="p-3 rounded-xl border bg-gradient-to-br from-muted/30 to-transparent">
        <FlowComponent mode={mode} />
      </div>
    </div>
  );
}
