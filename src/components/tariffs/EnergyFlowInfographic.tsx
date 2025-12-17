import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

type SystemType = "grid-tied" | "hybrid" | "generator" | "solar-generator";
type OperationMode = "normal" | "loadshedding";

interface EnergyFlowInfographicProps {
  systemType: SystemType;
  className?: string;
}

// Animated flow line with moving dashes
function FlowLine({ 
  path, 
  active, 
  color,
  reverse = false 
}: { 
  path: string; 
  active: boolean; 
  color: string;
  reverse?: boolean;
}) {
  return (
    <g>
      <path 
        d={path} 
        fill="none" 
        className={cn("transition-all duration-500", active ? "opacity-30" : "opacity-10")}
        stroke={active ? color : "currentColor"}
        strokeWidth="4"
        strokeLinecap="round"
      />
      {active && (
        <path 
          d={path} 
          fill="none" 
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="8 12"
          className="animate-flow"
          style={{ 
            animationDirection: reverse ? "reverse" : "normal",
            filter: `drop-shadow(0 0 4px ${color})`
          }}
        />
      )}
    </g>
  );
}

// Icon components as simple functions returning JSX
function SolarIcon({ active, x, y }: { active: boolean; x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x="-20" y="-15" width="40" height="30" rx="2" 
        className={cn("transition-all duration-500", active ? "fill-yellow-500/20 stroke-yellow-500" : "fill-muted/30 stroke-muted-foreground/30")} 
        strokeWidth="2" />
      <line x1="-20" y1="-5" x2="20" y2="-5" className={cn("transition-all", active ? "stroke-yellow-500/60" : "stroke-muted-foreground/20")} strokeWidth="1" />
      <line x1="-20" y1="5" x2="20" y2="5" className={cn("transition-all", active ? "stroke-yellow-500/60" : "stroke-muted-foreground/20")} strokeWidth="1" />
      <line x1="-7" y1="-15" x2="-7" y2="15" className={cn("transition-all", active ? "stroke-yellow-500/60" : "stroke-muted-foreground/20")} strokeWidth="1" />
      <line x1="7" y1="-15" x2="7" y2="15" className={cn("transition-all", active ? "stroke-yellow-500/60" : "stroke-muted-foreground/20")} strokeWidth="1" />
      {active && (
        <g className="animate-pulse">
          <circle cx="0" cy="-22" r="4" className="fill-yellow-400" />
          <line x1="0" y1="-28" x2="0" y2="-26" className="stroke-yellow-400" strokeWidth="2" />
          <line x1="6" y1="-26" x2="4" y2="-24" className="stroke-yellow-400" strokeWidth="1.5" />
          <line x1="-6" y1="-26" x2="-4" y2="-24" className="stroke-yellow-400" strokeWidth="1.5" />
        </g>
      )}
      <text x="0" y="28" className={cn("text-[9px] font-semibold text-center", active ? "fill-foreground" : "fill-muted-foreground/60")} textAnchor="middle">Solar PV</text>
      <text x="0" y="38" className="text-[7px] fill-muted-foreground" textAnchor="middle">{active ? "Generating" : "Offline"}</text>
    </g>
  );
}

function GridIcon({ active, x, y }: { active: boolean; x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <path d="M0 -18 L-6 -6 L-12 -6 L-16 18 L-6 18 L-4 6 L4 6 L6 18 L16 18 L12 -6 L6 -6 L0 -18" 
        className={cn("transition-all duration-500", active ? "fill-gray-500/20 stroke-gray-500" : "fill-muted/30 stroke-muted-foreground/30")} 
        strokeWidth="2" strokeLinejoin="round" />
      <line x1="-9" y1="0" x2="9" y2="0" className={cn("transition-all", active ? "stroke-gray-500" : "stroke-muted-foreground/30")} strokeWidth="2" />
      <line x1="-7" y1="10" x2="7" y2="10" className={cn("transition-all", active ? "stroke-gray-500" : "stroke-muted-foreground/30")} strokeWidth="2" />
      {active && (
        <g>
          <line x1="-20" y1="-12" x2="-8" y2="-12" className="stroke-gray-400" strokeWidth="1.5" />
          <line x1="8" y1="-12" x2="20" y2="-12" className="stroke-gray-400" strokeWidth="1.5" />
          <circle cx="-14" cy="-12" r="2" className="fill-yellow-400 animate-ping" />
          <circle cx="14" cy="-12" r="2" className="fill-yellow-400 animate-ping" />
        </g>
      )}
      <text x="0" y="32" className={cn("text-[9px] font-semibold", active ? "fill-foreground" : "fill-muted-foreground/60")} textAnchor="middle">Grid</text>
      <text x="0" y="42" className="text-[7px] fill-muted-foreground" textAnchor="middle">{active ? "Connected" : "Offline"}</text>
    </g>
  );
}

function InverterIcon({ active, x, y, label = "Inverter" }: { active: boolean; x: number; y: number; label?: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x="-18" y="-16" width="36" height="32" rx="3" 
        className={cn("transition-all duration-500", active ? "fill-blue-500/20 stroke-blue-500" : "fill-muted/30 stroke-muted-foreground/30")} 
        strokeWidth="2" />
      <rect x="-14" y="-12" width="28" height="12" rx="1" 
        className={cn("transition-all", active ? "fill-blue-900/50 stroke-blue-400" : "fill-muted stroke-muted-foreground/20")} 
        strokeWidth="1" />
      {active && (
        <path d="M-10 -6 Q-4 -10 0 -6 Q4 -2 10 -6" 
          className="fill-none stroke-blue-400 animate-pulse" 
          strokeWidth="2" strokeLinecap="round" />
      )}
      <circle cx="-8" cy="8" r="2" className={cn("transition-all", active ? "fill-emerald-400" : "fill-muted-foreground/30")} />
      <circle cx="0" cy="8" r="2" className={cn("transition-all", active ? "fill-emerald-400" : "fill-muted-foreground/30")} />
      <circle cx="8" cy="8" r="2" className={cn("transition-all", active ? "fill-blue-400" : "fill-muted-foreground/30")} />
      <text x="0" y="30" className={cn("text-[9px] font-semibold", active ? "fill-foreground" : "fill-muted-foreground/60")} textAnchor="middle">{label}</text>
      <text x="0" y="40" className="text-[7px] fill-muted-foreground" textAnchor="middle">{active ? "Active" : "Offline"}</text>
    </g>
  );
}

function BatteryIcon({ active, charging, x, y }: { active: boolean; charging?: boolean; x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x="-18" y="-12" width="36" height="24" rx="3" 
        className={cn("transition-all duration-500", active ? "fill-emerald-500/20 stroke-emerald-500" : "fill-muted/30 stroke-muted-foreground/30")} 
        strokeWidth="2" />
      <rect x="18" y="-6" width="4" height="12" rx="1" 
        className={cn("transition-all", active ? "fill-emerald-500" : "fill-muted-foreground/30")} />
      <rect x="-14" y="-8" width="8" height="16" rx="1" 
        className={cn("transition-all duration-300", active ? "fill-emerald-500" : "fill-muted-foreground/20")} />
      <rect x="-4" y="-8" width="8" height="16" rx="1" 
        className={cn("transition-all duration-500", active ? "fill-emerald-500" : "fill-muted-foreground/20")} />
      <rect x="6" y="-8" width="8" height="16" rx="1" 
        className={cn("transition-all duration-700", active ? (charging ? "fill-emerald-500/50" : "fill-emerald-500") : "fill-muted-foreground/20")} />
      {active && charging && (
        <path d="M0 -20 L-4 -8 L2 -8 L-2 4" 
          className="fill-none stroke-yellow-400 animate-pulse" 
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      <text x="0" y="26" className={cn("text-[9px] font-semibold", active ? "fill-foreground" : "fill-muted-foreground/60")} textAnchor="middle">Battery</text>
      <text x="0" y="36" className="text-[7px] fill-muted-foreground" textAnchor="middle">{active ? (charging ? "Charging" : "Discharging") : "Standby"}</text>
    </g>
  );
}

function GeneratorIcon({ active, x, y }: { active: boolean; x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x="-18" y="-12" width="36" height="24" rx="2" 
        className={cn("transition-all duration-500", active ? "fill-orange-500/20 stroke-orange-500" : "fill-muted/30 stroke-muted-foreground/30")} 
        strokeWidth="2" />
      <line x1="-14" y1="-6" x2="-6" y2="-6" className={cn("transition-all", active ? "stroke-orange-500/60" : "stroke-muted-foreground/20")} strokeWidth="2" />
      <line x1="-14" y1="0" x2="-6" y2="0" className={cn("transition-all", active ? "stroke-orange-500/60" : "stroke-muted-foreground/20")} strokeWidth="2" />
      <line x1="-14" y1="6" x2="-6" y2="6" className={cn("transition-all", active ? "stroke-orange-500/60" : "stroke-muted-foreground/20")} strokeWidth="2" />
      <rect x="0" y="-8" width="14" height="16" rx="1" 
        className={cn("transition-all", active ? "fill-gray-800 stroke-orange-400" : "fill-muted stroke-muted-foreground/20")} 
        strokeWidth="1" />
      {active && (
        <>
          <circle cx="4" cy="-4" r="2" className="fill-emerald-400 animate-pulse" />
          <circle cx="10" cy="-4" r="2" className="fill-orange-400 animate-pulse" />
          <g className="animate-bounce">
            <circle cx="-16" cy="-18" r="2" className="fill-gray-400/60" />
            <circle cx="-12" cy="-20" r="1.5" className="fill-gray-400/40" />
          </g>
        </>
      )}
      <circle cx="7" cy="4" r="3" className={cn("transition-all", active ? "fill-orange-600 stroke-orange-400" : "fill-muted-foreground/30 stroke-muted-foreground/20")} strokeWidth="1" />
      <text x="0" y="26" className={cn("text-[9px] font-semibold", active ? "fill-foreground" : "fill-muted-foreground/60")} textAnchor="middle">Generator</text>
      <text x="0" y="36" className="text-[7px] fill-muted-foreground" textAnchor="middle">{active ? "Running" : "Standby"}</text>
    </g>
  );
}

function ATSIcon({ active, gridMode, x, y }: { active: boolean; gridMode: boolean; x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x="-16" y="-16" width="32" height="32" rx="3" 
        className={cn("transition-all duration-500", active ? "fill-blue-500/20 stroke-blue-500" : "fill-muted/30 stroke-muted-foreground/30")} 
        strokeWidth="2" />
      <circle cx="0" cy="0" r="8" 
        className={cn("transition-all", active ? "fill-blue-600/30 stroke-blue-400" : "fill-muted stroke-muted-foreground/20")} 
        strokeWidth="2" />
      <line x1="0" y1="0" x2={gridMode ? -6 : 6} y2={gridMode ? -7 : -7} 
        className={cn("transition-all duration-500", active ? (gridMode ? "stroke-gray-400" : "stroke-orange-500") : "stroke-muted-foreground/30")} 
        strokeWidth="3" strokeLinecap="round" />
      <text x="-10" y="-10" className={cn("text-[5px] font-bold transition-all", gridMode && active ? "fill-gray-500" : "fill-muted-foreground/30")}>G</text>
      <text x="7" y="-10" className={cn("text-[5px] font-bold transition-all", !gridMode && active ? "fill-orange-500" : "fill-muted-foreground/30")}>B</text>
      <text x="0" y="28" className="text-[9px] font-semibold fill-foreground" textAnchor="middle">ATS</text>
      <text x="0" y="38" className="text-[7px] fill-muted-foreground" textAnchor="middle">{gridMode ? "Grid" : "Backup"}</text>
    </g>
  );
}

function HomeIcon({ active, x, y }: { active: boolean; x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <path d="M-18 0 L0 -16 L18 0" 
        className={cn("transition-all duration-500 fill-none", active ? "stroke-emerald-500" : "stroke-muted-foreground/30")} 
        strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="-14" y="0" width="28" height="20" 
        className={cn("transition-all duration-500", active ? "fill-emerald-500/20 stroke-emerald-500" : "fill-muted/30 stroke-muted-foreground/30")} 
        strokeWidth="2" />
      <rect x="-4" y="6" width="8" height="14" 
        className={cn("transition-all", active ? "fill-emerald-600/50 stroke-emerald-500" : "fill-muted stroke-muted-foreground/20")} 
        strokeWidth="1" />
      <rect x="-11" y="4" width="5" height="5" 
        className={cn("transition-all", active ? "fill-yellow-300/80" : "fill-muted")} />
      <rect x="6" y="4" width="5" height="5" 
        className={cn("transition-all", active ? "fill-yellow-300/80" : "fill-muted")} />
      {active && (
        <circle cx="0" cy="6" r="8" className="fill-yellow-400/20 animate-pulse" />
      )}
      <text x="0" y="36" className={cn("text-[9px] font-semibold", active ? "fill-foreground" : "fill-muted-foreground/60")} textAnchor="middle">Loads</text>
      <text x="0" y="46" className="text-[7px] fill-muted-foreground" textAnchor="middle">{active ? "Powered" : "No Power"}</text>
    </g>
  );
}

// Flow diagrams - Top-down layout with loads at bottom
function GridTiedFlow({ mode }: { mode: OperationMode }) {
  const isNormal = mode === "normal";
  
  return (
    <svg viewBox="0 0 200 240" className="w-full h-auto max-w-[200px] mx-auto">
      <style>{`
        @keyframes flowAnimation {
          0% { stroke-dashoffset: 40; }
          100% { stroke-dashoffset: 0; }
        }
        .animate-flow {
          animation: flowAnimation 0.8s linear infinite;
        }
      `}</style>
      
      {/* Top: Solar + Grid side by side */}
      <SolarIcon active={isNormal} x={60} y={35} />
      <GridIcon active={isNormal} x={140} y={35} />
      
      {/* Flow: Solar down to Inverter */}
      <FlowLine path="M 60 55 L 60 85 L 100 85" active={isNormal} color="#eab308" />
      
      {/* Flow: Grid down to Inverter */}
      <FlowLine path="M 140 55 L 140 85 L 100 85" active={isNormal} color="#6b7280" />
      
      {/* Middle: Inverter */}
      <InverterIcon active={isNormal} x={100} y={110} />
      
      {/* Flow: Inverter down to Home */}
      <FlowLine path="M 100 135 L 100 165" active={isNormal} color="#22c55e" />
      
      {/* Bottom: Home/Loads */}
      <HomeIcon active={isNormal} x={100} y={190} />
      
      {/* Status indicator */}
      <rect x="10" y="210" width="180" height="24" rx="4" 
        className={cn("transition-all duration-500", isNormal ? "fill-emerald-500/10 stroke-emerald-500/30" : "fill-red-500/10 stroke-red-500/30")} 
        strokeWidth="1" />
      <text x="100" y="226" className={cn("text-[9px] font-semibold", isNormal ? "fill-emerald-600" : "fill-red-600")} textAnchor="middle">
        {isNormal ? "✓ Solar powers loads, excess to grid" : "✗ Anti-islanding shuts down system"}
      </text>
    </svg>
  );
}

function HybridFlow({ mode }: { mode: OperationMode }) {
  const isNormal = mode === "normal";
  
  return (
    <svg viewBox="0 0 200 260" className="w-full h-auto max-w-[200px] mx-auto">
      <style>{`
        @keyframes flowAnimation {
          0% { stroke-dashoffset: 40; }
          100% { stroke-dashoffset: 0; }
        }
        .animate-flow {
          animation: flowAnimation 0.8s linear infinite;
        }
      `}</style>
      
      {/* Top: Solar + Grid */}
      <SolarIcon active={true} x={60} y={35} />
      <GridIcon active={isNormal} x={140} y={35} />
      
      {/* Flow: Solar to Inverter */}
      <FlowLine path="M 60 55 L 60 85 L 100 85" active={true} color="#eab308" />
      
      {/* Flow: Grid to Inverter */}
      <FlowLine path="M 140 55 L 140 85 L 100 85" active={isNormal} color="#6b7280" />
      
      {/* Middle: Hybrid Inverter */}
      <InverterIcon active={true} x={100} y={110} label="Hybrid Inv" />
      
      {/* Flow: Inverter to Battery (side) */}
      <FlowLine 
        path="M 118 110 L 160 110" 
        active={true} 
        color={isNormal ? "#22c55e" : "#f97316"}
        reverse={!isNormal}
      />
      
      {/* Battery on right side */}
      <BatteryIcon active={true} charging={isNormal} x={160} y={150} />
      
      {/* Flow: Inverter to Home */}
      <FlowLine path="M 100 135 L 100 175" active={true} color="#22c55e" />
      
      {/* Bottom: Home */}
      <HomeIcon active={true} x={100} y={200} />
      
      {/* Status */}
      <rect x="10" y="230" width="180" height="24" rx="4" 
        className="fill-emerald-500/10 stroke-emerald-500/30" 
        strokeWidth="1" />
      <text x="100" y="246" className="text-[9px] font-semibold fill-emerald-600" textAnchor="middle">
        {isNormal ? "✓ Solar + Grid, battery charging" : "✓ Battery backup (<20ms switch)"}
      </text>
    </svg>
  );
}

function GeneratorFlow({ mode }: { mode: OperationMode }) {
  const isNormal = mode === "normal";
  
  return (
    <svg viewBox="0 0 200 260" className="w-full h-auto max-w-[200px] mx-auto">
      <style>{`
        @keyframes flowAnimation {
          0% { stroke-dashoffset: 40; }
          100% { stroke-dashoffset: 0; }
        }
        .animate-flow {
          animation: flowAnimation 0.8s linear infinite;
        }
      `}</style>
      
      {/* Top: Grid + Generator */}
      <GridIcon active={isNormal} x={60} y={35} />
      <GeneratorIcon active={!isNormal} x={140} y={35} />
      
      {/* Flow: Grid to ATS */}
      <FlowLine path="M 60 55 L 60 95 L 100 95" active={isNormal} color="#6b7280" />
      
      {/* Flow: Generator to ATS */}
      <FlowLine path="M 140 55 L 140 95 L 100 95" active={!isNormal} color="#f97316" />
      
      {/* Middle: ATS */}
      <ATSIcon active={true} gridMode={isNormal} x={100} y={120} />
      
      {/* Flow: ATS to Home */}
      <FlowLine path="M 100 145 L 100 175" active={true} color={isNormal ? "#6b7280" : "#f97316"} />
      
      {/* Bottom: Home */}
      <HomeIcon active={true} x={100} y={200} />
      
      {/* Status */}
      <rect x="10" y="230" width="180" height="24" rx="4" 
        className={cn("transition-all duration-500", isNormal ? "fill-emerald-500/10 stroke-emerald-500/30" : "fill-orange-500/10 stroke-orange-500/30")} 
        strokeWidth="1" />
      <text x="100" y="246" className={cn("text-[9px] font-semibold", isNormal ? "fill-emerald-600" : "fill-orange-600")} textAnchor="middle">
        {isNormal ? "✓ Grid power - Normal operation" : "⚡ Generator backup (30-60s delay)"}
      </text>
    </svg>
  );
}

function SolarGeneratorFlow({ mode }: { mode: OperationMode }) {
  const isNormal = mode === "normal";
  
  return (
    <svg viewBox="0 0 220 300" className="w-full h-auto max-w-[220px] mx-auto">
      <style>{`
        @keyframes flowAnimation {
          0% { stroke-dashoffset: 40; }
          100% { stroke-dashoffset: 0; }
        }
        .animate-flow {
          animation: flowAnimation 0.8s linear infinite;
        }
      `}</style>
      
      {/* Top row: Solar, Grid, Generator */}
      <SolarIcon active={true} x={40} y={35} />
      <GridIcon active={isNormal} x={110} y={35} />
      <GeneratorIcon active={!isNormal} x={180} y={35} />
      
      {/* Flow: Solar to Inverter */}
      <FlowLine path="M 40 55 L 40 95 L 80 95" active={true} color="#eab308" />
      
      {/* Flow: Grid to Inverter */}
      <FlowLine path="M 110 55 L 110 95 L 80 95" active={isNormal} color="#6b7280" />
      
      {/* Flow: Generator to Inverter (when grid down) */}
      <FlowLine path="M 180 55 L 180 75 L 110 75 L 110 95 L 80 95" active={!isNormal} color="#f97316" />
      
      {/* Middle: Hybrid Inverter */}
      <InverterIcon active={true} x={80} y={120} label="Hybrid Inv" />
      
      {/* Battery on right */}
      <BatteryIcon active={true} charging={isNormal} x={170} y={120} />
      
      {/* Flow: Inverter to Battery */}
      <FlowLine 
        path="M 98 120 L 148 120" 
        active={true} 
        color={isNormal ? "#22c55e" : "#f97316"}
        reverse={!isNormal}
      />
      
      {/* Flow: Inverter to Home */}
      <FlowLine path="M 80 145 L 80 195" active={true} color="#22c55e" />
      
      {/* Bottom: Home */}
      <HomeIcon active={true} x={80} y={220} />
      
      {/* Status */}
      <rect x="10" y="265" width="200" height="28" rx="4" 
        className="fill-emerald-500/10 stroke-emerald-500/30" 
        strokeWidth="1" />
      <text x="110" y="280" className="text-[9px] font-semibold fill-emerald-600" textAnchor="middle">
        {isNormal ? "✓ Full system: Solar + Grid + Battery" : "✓ Generator charges battery, solar active"}
      </text>
    </svg>
  );
}

export function EnergyFlowInfographic({ systemType, className }: EnergyFlowInfographicProps) {
  const [mode, setMode] = useState<OperationMode>("normal");
  
  useEffect(() => {
    const interval = setInterval(() => {
      setMode(prev => prev === "normal" ? "loadshedding" : "normal");
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const FlowComponent = {
    "grid-tied": GridTiedFlow,
    "hybrid": HybridFlow,
    "generator": GeneratorFlow,
    "solar-generator": SolarGeneratorFlow,
  }[systemType];

  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold">Energy Flow</h4>
        <span className={cn(
          "text-xs px-2 py-0.5 rounded-full transition-all duration-500",
          mode === "normal" 
            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
            : "bg-red-500/20 text-red-600 dark:text-red-400"
        )}>
          {mode === "normal" ? "Normal" : "Load Shedding"}
        </span>
      </div>
      
      <FlowComponent mode={mode} />
    </div>
  );
}
