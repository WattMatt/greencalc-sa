import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

type SystemType = "grid-tied" | "hybrid" | "generator" | "solar-generator";
type OperationMode = "normal" | "loadshedding";

interface EnergyFlowInfographicProps {
  systemType: SystemType;
  className?: string;
}

// SVG Icon Components for better illustration
function SolarPanelIcon({ active, className }: { active: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("w-full h-full", className)}>
      {/* Panel frame */}
      <rect x="4" y="8" width="40" height="28" rx="2" 
        className={cn("transition-all duration-500", active ? "fill-yellow-500/20 stroke-yellow-500" : "fill-muted/30 stroke-muted-foreground/30")} 
        strokeWidth="2" />
      {/* Grid lines */}
      <line x1="4" y1="17" x2="44" y2="17" className={cn("transition-all", active ? "stroke-yellow-500/60" : "stroke-muted-foreground/20")} strokeWidth="1" />
      <line x1="4" y1="26" x2="44" y2="26" className={cn("transition-all", active ? "stroke-yellow-500/60" : "stroke-muted-foreground/20")} strokeWidth="1" />
      <line x1="17" y1="8" x2="17" y2="36" className={cn("transition-all", active ? "stroke-yellow-500/60" : "stroke-muted-foreground/20")} strokeWidth="1" />
      <line x1="31" y1="8" x2="31" y2="36" className={cn("transition-all", active ? "stroke-yellow-500/60" : "stroke-muted-foreground/20")} strokeWidth="1" />
      {/* Sun rays when active */}
      {active && (
        <g className="animate-pulse">
          <circle cx="24" cy="4" r="2" className="fill-yellow-400" />
          <line x1="24" y1="0" x2="24" y2="2" className="stroke-yellow-400" strokeWidth="2" />
          <line x1="30" y1="2" x2="28" y2="4" className="stroke-yellow-400" strokeWidth="1.5" />
          <line x1="18" y1="2" x2="20" y2="4" className="stroke-yellow-400" strokeWidth="1.5" />
        </g>
      )}
      {/* Stand */}
      <path d="M20 36 L24 44 L28 36" className={cn("transition-all", active ? "stroke-yellow-500 fill-none" : "stroke-muted-foreground/30 fill-none")} strokeWidth="2" />
    </svg>
  );
}

function BatteryIcon({ active, charging, className }: { active: boolean; charging?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("w-full h-full", className)}>
      {/* Battery body */}
      <rect x="6" y="12" width="36" height="24" rx="3" 
        className={cn("transition-all duration-500", active ? "fill-emerald-500/20 stroke-emerald-500" : "fill-muted/30 stroke-muted-foreground/30")} 
        strokeWidth="2" />
      {/* Battery terminal */}
      <rect x="42" y="18" width="4" height="12" rx="1" 
        className={cn("transition-all", active ? "fill-emerald-500" : "fill-muted-foreground/30")} />
      {/* Charge level bars */}
      <rect x="10" y="16" width="7" height="16" rx="1" 
        className={cn("transition-all duration-300", active ? "fill-emerald-500" : "fill-muted-foreground/20")} />
      <rect x="19" y="16" width="7" height="16" rx="1" 
        className={cn("transition-all duration-500", active ? "fill-emerald-500" : "fill-muted-foreground/20")} />
      <rect x="28" y="16" width="7" height="16" rx="1" 
        className={cn("transition-all duration-700", active ? (charging ? "fill-emerald-500/50" : "fill-emerald-500") : "fill-muted-foreground/20")} />
      {/* Charging indicator */}
      {active && charging && (
        <path d="M24 8 L20 20 L26 20 L22 32" 
          className="fill-none stroke-yellow-400 animate-pulse" 
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function InverterIcon({ active, className }: { active: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("w-full h-full", className)}>
      {/* Box */}
      <rect x="8" y="10" width="32" height="28" rx="3" 
        className={cn("transition-all duration-500", active ? "fill-blue-500/20 stroke-blue-500" : "fill-muted/30 stroke-muted-foreground/30")} 
        strokeWidth="2" />
      {/* Display screen */}
      <rect x="12" y="14" width="24" height="10" rx="1" 
        className={cn("transition-all", active ? "fill-blue-900/50 stroke-blue-400" : "fill-muted stroke-muted-foreground/20")} 
        strokeWidth="1" />
      {/* Wave symbol when active */}
      {active && (
        <path d="M16 19 Q20 15 24 19 Q28 23 32 19" 
          className="fill-none stroke-blue-400 animate-pulse" 
          strokeWidth="2" strokeLinecap="round" />
      )}
      {/* LEDs */}
      <circle cx="16" cy="30" r="2" className={cn("transition-all", active ? "fill-emerald-400" : "fill-muted-foreground/30")} />
      <circle cx="24" cy="30" r="2" className={cn("transition-all", active ? "fill-emerald-400" : "fill-muted-foreground/30")} />
      <circle cx="32" cy="30" r="2" className={cn("transition-all", active ? "fill-blue-400" : "fill-muted-foreground/30")} />
    </svg>
  );
}

function GeneratorIcon({ active, className }: { active: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("w-full h-full", className)}>
      {/* Generator body */}
      <rect x="6" y="14" width="36" height="24" rx="2" 
        className={cn("transition-all duration-500", active ? "fill-orange-500/20 stroke-orange-500" : "fill-muted/30 stroke-muted-foreground/30")} 
        strokeWidth="2" />
      {/* Engine vents */}
      <line x1="10" y1="20" x2="18" y2="20" className={cn("transition-all", active ? "stroke-orange-500/60" : "stroke-muted-foreground/20")} strokeWidth="2" />
      <line x1="10" y1="26" x2="18" y2="26" className={cn("transition-all", active ? "stroke-orange-500/60" : "stroke-muted-foreground/20")} strokeWidth="2" />
      <line x1="10" y1="32" x2="18" y2="32" className={cn("transition-all", active ? "stroke-orange-500/60" : "stroke-muted-foreground/20")} strokeWidth="2" />
      {/* Control panel */}
      <rect x="24" y="18" width="14" height="16" rx="1" 
        className={cn("transition-all", active ? "fill-gray-800 stroke-orange-400" : "fill-muted stroke-muted-foreground/20")} 
        strokeWidth="1" />
      {/* Running indicator */}
      {active && (
        <>
          <circle cx="28" cy="22" r="2" className="fill-emerald-400 animate-pulse" />
          <circle cx="34" cy="22" r="2" className="fill-orange-400 animate-pulse" />
          {/* Exhaust smoke */}
          <g className="animate-bounce">
            <circle cx="8" cy="10" r="2" className="fill-gray-400/60" />
            <circle cx="12" cy="8" r="1.5" className="fill-gray-400/40" />
            <circle cx="10" cy="5" r="1" className="fill-gray-400/20" />
          </g>
        </>
      )}
      {/* Fuel cap */}
      <circle cx="31" cy="30" r="3" className={cn("transition-all", active ? "fill-orange-600 stroke-orange-400" : "fill-muted-foreground/30 stroke-muted-foreground/20")} strokeWidth="1" />
    </svg>
  );
}

function GridIcon({ active, className }: { active: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("w-full h-full", className)}>
      {/* Pylon */}
      <path d="M24 4 L18 16 L12 16 L8 44 L18 44 L20 28 L28 28 L30 44 L40 44 L36 16 L30 16 L24 4" 
        className={cn("transition-all duration-500", active ? "fill-gray-500/20 stroke-gray-500" : "fill-muted/30 stroke-muted-foreground/30")} 
        strokeWidth="2" strokeLinejoin="round" />
      {/* Cross bars */}
      <line x1="14" y1="22" x2="34" y2="22" className={cn("transition-all", active ? "stroke-gray-500" : "stroke-muted-foreground/30")} strokeWidth="2" />
      <line x1="16" y1="34" x2="32" y2="34" className={cn("transition-all", active ? "stroke-gray-500" : "stroke-muted-foreground/30")} strokeWidth="2" />
      {/* Power lines */}
      {active && (
        <g>
          <line x1="0" y1="10" x2="14" y2="10" className="stroke-gray-400" strokeWidth="1.5" />
          <line x1="34" y1="10" x2="48" y2="10" className="stroke-gray-400" strokeWidth="1.5" />
          {/* Electricity sparks */}
          <circle cx="8" cy="10" r="2" className="fill-yellow-400 animate-ping" />
          <circle cx="40" cy="10" r="2" className="fill-yellow-400 animate-ping" />
        </g>
      )}
    </svg>
  );
}

function HomeIcon({ active, className }: { active: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("w-full h-full", className)}>
      {/* Roof */}
      <path d="M4 22 L24 6 L44 22" 
        className={cn("transition-all duration-500 fill-none", active ? "stroke-emerald-500" : "stroke-muted-foreground/30")} 
        strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* House body */}
      <rect x="10" y="22" width="28" height="22" 
        className={cn("transition-all duration-500", active ? "fill-emerald-500/20 stroke-emerald-500" : "fill-muted/30 stroke-muted-foreground/30")} 
        strokeWidth="2" />
      {/* Door */}
      <rect x="20" y="30" width="8" height="14" 
        className={cn("transition-all", active ? "fill-emerald-600/50 stroke-emerald-500" : "fill-muted stroke-muted-foreground/20")} 
        strokeWidth="1" />
      {/* Windows */}
      <rect x="14" y="26" width="5" height="5" 
        className={cn("transition-all", active ? "fill-yellow-300/80" : "fill-muted")} />
      <rect x="29" y="26" width="5" height="5" 
        className={cn("transition-all", active ? "fill-yellow-300/80" : "fill-muted")} />
      {/* Light glow when active */}
      {active && (
        <circle cx="24" cy="28" r="8" className="fill-yellow-400/20 animate-pulse" />
      )}
    </svg>
  );
}

function ATSIcon({ active, gridMode, className }: { active: boolean; gridMode: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("w-full h-full", className)}>
      {/* Box */}
      <rect x="8" y="8" width="32" height="32" rx="3" 
        className={cn("transition-all duration-500", active ? "fill-blue-500/20 stroke-blue-500" : "fill-muted/30 stroke-muted-foreground/30")} 
        strokeWidth="2" />
      {/* Switch mechanism */}
      <circle cx="24" cy="24" r="8" 
        className={cn("transition-all", active ? "fill-blue-600/30 stroke-blue-400" : "fill-muted stroke-muted-foreground/20")} 
        strokeWidth="2" />
      {/* Switch lever - animated position */}
      <line x1="24" y1="24" x2={gridMode ? "18" : "30"} y2={gridMode ? "16" : "16"} 
        className={cn("transition-all duration-500", active ? (gridMode ? "stroke-gray-400" : "stroke-orange-500") : "stroke-muted-foreground/30")} 
        strokeWidth="3" strokeLinecap="round" />
      {/* Labels */}
      <text x="12" y="14" className={cn("text-[6px] font-bold transition-all", gridMode && active ? "fill-gray-500" : "fill-muted-foreground/30")}>GRID</text>
      <text x="30" y="14" className={cn("text-[6px] font-bold transition-all", !gridMode && active ? "fill-orange-500" : "fill-muted-foreground/30")}>GEN</text>
      {/* Status LEDs */}
      <circle cx="14" cy="36" r="2" className={cn("transition-all", active && gridMode ? "fill-emerald-400" : "fill-muted-foreground/30")} />
      <circle cx="34" cy="36" r="2" className={cn("transition-all", active && !gridMode ? "fill-orange-400 animate-pulse" : "fill-muted-foreground/30")} />
    </svg>
  );
}

// Animated energy flow particles
function EnergyFlow({ 
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
  
  return (
    <div className={cn(
      "relative overflow-visible",
      isHorizontal ? "h-3 flex-1 min-w-6" : "w-3 h-8",
      className
    )}>
      {/* Track */}
      <div className={cn(
        "absolute rounded-full transition-all duration-500",
        isHorizontal ? "inset-y-1 inset-x-0 h-1" : "inset-x-1 inset-y-0 w-1",
        active ? color : "bg-muted/40"
      )} />
      
      {/* Animated particles */}
      {active && (
        <>
          <div 
            className={cn(
              "absolute rounded-full",
              isHorizontal ? "w-3 h-3 top-0" : "w-3 h-3 left-0",
              color
            )}
            style={{
              animation: `energyFlow${direction.charAt(0).toUpperCase() + direction.slice(1)} 1s linear infinite`,
              boxShadow: `0 0 8px 2px currentColor`,
            }}
          />
          <div 
            className={cn(
              "absolute rounded-full",
              isHorizontal ? "w-2 h-2 top-0.5" : "w-2 h-2 left-0.5",
              color
            )}
            style={{
              animation: `energyFlow${direction.charAt(0).toUpperCase() + direction.slice(1)} 1s linear infinite`,
              animationDelay: "0.5s",
              boxShadow: `0 0 6px 1px currentColor`,
            }}
          />
        </>
      )}
    </div>
  );
}

// Component wrapper for the illustrated icons
function SystemComponent({ 
  type, 
  active, 
  label, 
  status,
  charging,
  gridMode,
}: { 
  type: "solar" | "battery" | "inverter" | "generator" | "grid" | "home" | "ats";
  active: boolean;
  label: string;
  status: string;
  charging?: boolean;
  gridMode?: boolean;
}) {
  const IconComponent = {
    solar: () => <SolarPanelIcon active={active} />,
    battery: () => <BatteryIcon active={active} charging={charging} />,
    inverter: () => <InverterIcon active={active} />,
    generator: () => <GeneratorIcon active={active} />,
    grid: () => <GridIcon active={active} />,
    home: () => <HomeIcon active={active} />,
    ats: () => <ATSIcon active={active} gridMode={gridMode ?? true} />,
  }[type];

  return (
    <div className="flex flex-col items-center gap-0.5 w-14">
      <div className="w-12 h-12">
        <IconComponent />
      </div>
      <span className={cn(
        "text-[9px] font-semibold transition-colors text-center leading-tight",
        active ? "text-foreground" : "text-muted-foreground/60"
      )}>
        {label}
      </span>
      <span className={cn(
        "text-[8px] transition-colors",
        active ? "text-muted-foreground" : "text-muted-foreground/40"
      )}>
        {status}
      </span>
    </div>
  );
}

// Flow diagrams for each system type
function GridTiedFlow({ mode }: { mode: OperationMode }) {
  const isNormal = mode === "normal";
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-1">
        <SystemComponent type="solar" active={isNormal} label="Solar PV" status={isNormal ? "Generating" : "Offline"} />
        <EnergyFlow active={isNormal} color="bg-yellow-500 text-yellow-500" direction="right" />
        <SystemComponent type="inverter" active={isNormal} label="Inverter" status={isNormal ? "Converting" : "Shutdown"} />
        <EnergyFlow active={isNormal} color="bg-emerald-500 text-emerald-500" direction="right" />
        <SystemComponent type="home" active={isNormal} label="Loads" status={isNormal ? "Powered" : "No Power"} />
      </div>
      
      <div className="flex justify-center">
        <div className="flex flex-col items-center">
          <EnergyFlow active={isNormal} color="bg-gray-500 text-gray-500" direction="down" />
          <SystemComponent type="grid" active={isNormal} label="Grid" status={isNormal ? "Connected" : "Offline"} />
        </div>
      </div>

      <div className={cn(
        "text-center p-2 rounded-lg transition-all duration-500 border",
        isNormal 
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
          : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
      )}>
        <p className="text-xs font-semibold">{isNormal ? "✓ Normal Operation" : "✗ System Offline"}</p>
        <p className="text-[10px] opacity-80">{isNormal ? "Solar powers loads, excess to grid" : "Anti-islanding shuts down inverter"}</p>
      </div>
    </div>
  );
}

function HybridFlow({ mode }: { mode: OperationMode }) {
  const isNormal = mode === "normal";
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-1">
        <SystemComponent type="solar" active={true} label="Solar PV" status="Generating" />
        <EnergyFlow active={true} color="bg-yellow-500 text-yellow-500" direction="right" />
        <SystemComponent type="inverter" active={true} label="Hybrid Inv" status="Active" />
        <EnergyFlow active={true} color="bg-emerald-500 text-emerald-500" direction="right" />
        <SystemComponent type="home" active={true} label="Loads" status="Powered" />
      </div>

      <div className="flex items-center justify-center gap-4">
        <SystemComponent type="grid" active={isNormal} label="Grid" status={isNormal ? "Connected" : "Offline"} />
        <EnergyFlow active={isNormal} color="bg-gray-500 text-gray-500" direction="right" className="max-w-8" />
        <div className="w-4" />
        <EnergyFlow 
          active={true} 
          color={isNormal ? "bg-emerald-500 text-emerald-500" : "bg-orange-500 text-orange-500"} 
          direction={isNormal ? "down" : "up"} 
        />
        <SystemComponent type="battery" active={true} label="Battery" status={isNormal ? "Charging" : "Discharging"} charging={isNormal} />
      </div>

      <div className={cn(
        "text-center p-2 rounded-lg transition-all duration-500 border",
        "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
      )}>
        <p className="text-xs font-semibold">✓ Always Operational</p>
        <p className="text-[10px] opacity-80">{isNormal ? "Solar powers loads, battery charging" : "Battery backup (<20ms switch)"}</p>
      </div>
    </div>
  );
}

function GeneratorFlow({ mode }: { mode: OperationMode }) {
  const isNormal = mode === "normal";
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-1">
        <SystemComponent type="grid" active={isNormal} label="Grid" status={isNormal ? "Active" : "Offline"} />
        <EnergyFlow active={isNormal} color="bg-gray-500 text-gray-500" direction="right" />
        <SystemComponent type="ats" active={true} label="ATS Switch" status={isNormal ? "Grid Mode" : "Gen Mode"} gridMode={isNormal} />
        <EnergyFlow active={true} color={isNormal ? "bg-gray-500 text-gray-500" : "bg-orange-500 text-orange-500"} direction="right" />
        <SystemComponent type="home" active={true} label="Loads" status="Powered" />
      </div>

      <div className="flex items-center justify-center gap-4">
        <SystemComponent type="generator" active={!isNormal} label="Generator" status={!isNormal ? "Running" : "Standby"} />
        <EnergyFlow active={!isNormal} color="bg-orange-500 text-orange-500" direction="right" className="max-w-12" />
        <div className="w-14" />
      </div>

      <div className={cn(
        "text-center p-2 rounded-lg transition-all duration-500 border",
        "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
      )}>
        <p className="text-xs font-semibold">✓ Backup Available</p>
        <p className="text-[10px] opacity-80">{isNormal ? "Grid powers loads, generator standby" : "ATS switches to generator (10-30s)"}</p>
      </div>
    </div>
  );
}

function SolarGeneratorFlow({ mode }: { mode: OperationMode }) {
  const isNormal = mode === "normal";
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-1">
        <SystemComponent type="solar" active={true} label="Solar PV" status="Generating" />
        <EnergyFlow active={true} color="bg-yellow-500 text-yellow-500" direction="right" />
        <SystemComponent type="inverter" active={true} label="Hybrid Inv" status="Active" />
        <EnergyFlow active={true} color="bg-emerald-500 text-emerald-500" direction="right" />
        <SystemComponent type="home" active={true} label="Loads" status="Powered" />
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-1">
          <SystemComponent type="grid" active={isNormal} label="Grid" status={isNormal ? "On" : "Off"} />
          <EnergyFlow active={isNormal} color="bg-gray-500 text-gray-500" direction="right" className="w-6" />
        </div>
        <div className="flex flex-col items-center">
          <EnergyFlow active={true} color="bg-emerald-500 text-emerald-500" direction={isNormal ? "down" : "up"} />
          <SystemComponent type="battery" active={true} label="Battery" status={isNormal ? "Charging" : "Backup"} charging={isNormal} />
        </div>
        <div className="flex items-center gap-1">
          <EnergyFlow active={!isNormal} color="bg-orange-500 text-orange-500" direction="left" className="w-6" />
          <SystemComponent type="generator" active={!isNormal} label="Generator" status={!isNormal ? "Running" : "Standby"} />
        </div>
      </div>

      <div className={cn(
        "text-center p-2 rounded-lg transition-all duration-500 border",
        "bg-primary/10 border-primary/20 text-primary"
      )}>
        <p className="text-xs font-semibold">✓ Maximum Resilience</p>
        <p className="text-[10px] opacity-80">{isNormal ? "Solar + grid, battery charging" : "Battery + generator backup"}</p>
      </div>
    </div>
  );
}

export function EnergyFlowInfographic({ systemType, className }: EnergyFlowInfographicProps) {
  const [mode, setMode] = useState<OperationMode>("normal");

  // Auto-cycle between modes
  useEffect(() => {
    const interval = setInterval(() => {
      setMode(prev => prev === "normal" ? "loadshedding" : "normal");
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const FlowComponent = {
    "grid-tied": GridTiedFlow,
    "hybrid": HybridFlow,
    "generator": GeneratorFlow,
    "solar-generator": SolarGeneratorFlow,
  }[systemType];

  return (
    <div className={cn("space-y-2", className)}>
      {/* CSS for particle animations */}
      <style>{`
        @keyframes energyFlowRight {
          0% { left: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
        @keyframes energyFlowLeft {
          0% { right: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { right: 100%; opacity: 0; }
        }
        @keyframes energyFlowDown {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes energyFlowUp {
          0% { bottom: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { bottom: 100%; opacity: 0; }
        }
      `}</style>

      {/* Mode indicator */}
      <div className="flex items-center justify-center">
        <div className={cn(
          "px-3 py-1 text-[10px] font-semibold rounded-full border transition-all duration-500",
          mode === "normal" 
            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" 
            : "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30"
        )}>
          {mode === "normal" ? "● Normal Operation" : "● Load Shedding"}
        </div>
      </div>

      {/* Flow diagram */}
      <div className="p-3 rounded-xl border bg-gradient-to-br from-muted/20 to-transparent">
        <FlowComponent mode={mode} />
      </div>
    </div>
  );
}
