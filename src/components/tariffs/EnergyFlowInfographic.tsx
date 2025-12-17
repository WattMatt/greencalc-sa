import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

type SystemType = "grid-tied" | "hybrid" | "generator" | "solar-generator";
type OperationMode = "normal" | "loadshedding";

interface EnergyFlowInfographicProps {
  systemType: SystemType;
  className?: string;
}

// SVG Icon Components
function SolarPanelIcon({ active }: { active: boolean }) {
  return (
    <g>
      <rect x="2" y="6" width="36" height="24" rx="2" 
        className={cn("transition-all duration-500", active ? "fill-yellow-500/20 stroke-yellow-500" : "fill-muted/30 stroke-muted-foreground/30")} 
        strokeWidth="2" />
      <line x1="2" y1="14" x2="38" y2="14" className={cn("transition-all", active ? "stroke-yellow-500/60" : "stroke-muted-foreground/20")} strokeWidth="1" />
      <line x1="2" y1="22" x2="38" y2="22" className={cn("transition-all", active ? "stroke-yellow-500/60" : "stroke-muted-foreground/20")} strokeWidth="1" />
      <line x1="14" y1="6" x2="14" y2="30" className={cn("transition-all", active ? "stroke-yellow-500/60" : "stroke-muted-foreground/20")} strokeWidth="1" />
      <line x1="26" y1="6" x2="26" y2="30" className={cn("transition-all", active ? "stroke-yellow-500/60" : "stroke-muted-foreground/20")} strokeWidth="1" />
      {active && (
        <g className="animate-pulse">
          <circle cx="20" cy="2" r="3" className="fill-yellow-400" />
          <line x1="20" y1="-2" x2="20" y2="0" className="stroke-yellow-400" strokeWidth="2" />
          <line x1="26" y1="0" x2="24" y2="2" className="stroke-yellow-400" strokeWidth="1.5" />
          <line x1="14" y1="0" x2="16" y2="2" className="stroke-yellow-400" strokeWidth="1.5" />
        </g>
      )}
      <path d="M16 30 L20 38 L24 30" className={cn("transition-all fill-none", active ? "stroke-yellow-500" : "stroke-muted-foreground/30")} strokeWidth="2" />
    </g>
  );
}

function BatteryIcon({ active, charging }: { active: boolean; charging?: boolean }) {
  return (
    <g>
      <rect x="4" y="10" width="32" height="20" rx="3" 
        className={cn("transition-all duration-500", active ? "fill-emerald-500/20 stroke-emerald-500" : "fill-muted/30 stroke-muted-foreground/30")} 
        strokeWidth="2" />
      <rect x="36" y="15" width="4" height="10" rx="1" 
        className={cn("transition-all", active ? "fill-emerald-500" : "fill-muted-foreground/30")} />
      <rect x="7" y="13" width="6" height="14" rx="1" 
        className={cn("transition-all duration-300", active ? "fill-emerald-500" : "fill-muted-foreground/20")} />
      <rect x="15" y="13" width="6" height="14" rx="1" 
        className={cn("transition-all duration-500", active ? "fill-emerald-500" : "fill-muted-foreground/20")} />
      <rect x="23" y="13" width="6" height="14" rx="1" 
        className={cn("transition-all duration-700", active ? (charging ? "fill-emerald-500/50" : "fill-emerald-500") : "fill-muted-foreground/20")} />
      {active && charging && (
        <path d="M20 6 L17 16 L22 16 L19 26" 
          className="fill-none stroke-yellow-400 animate-pulse" 
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </g>
  );
}

function InverterIcon({ active }: { active: boolean }) {
  return (
    <g>
      <rect x="4" y="6" width="32" height="28" rx="3" 
        className={cn("transition-all duration-500", active ? "fill-blue-500/20 stroke-blue-500" : "fill-muted/30 stroke-muted-foreground/30")} 
        strokeWidth="2" />
      <rect x="8" y="10" width="24" height="10" rx="1" 
        className={cn("transition-all", active ? "fill-blue-900/50 stroke-blue-400" : "fill-muted stroke-muted-foreground/20")} 
        strokeWidth="1" />
      {active && (
        <path d="M12 15 Q18 11 20 15 Q22 19 28 15" 
          className="fill-none stroke-blue-400 animate-pulse" 
          strokeWidth="2" strokeLinecap="round" />
      )}
      <circle cx="12" cy="28" r="2" className={cn("transition-all", active ? "fill-emerald-400" : "fill-muted-foreground/30")} />
      <circle cx="20" cy="28" r="2" className={cn("transition-all", active ? "fill-emerald-400" : "fill-muted-foreground/30")} />
      <circle cx="28" cy="28" r="2" className={cn("transition-all", active ? "fill-blue-400" : "fill-muted-foreground/30")} />
    </g>
  );
}

function GeneratorIcon({ active }: { active: boolean }) {
  return (
    <g>
      <rect x="4" y="10" width="32" height="20" rx="2" 
        className={cn("transition-all duration-500", active ? "fill-orange-500/20 stroke-orange-500" : "fill-muted/30 stroke-muted-foreground/30")} 
        strokeWidth="2" />
      <line x1="8" y1="15" x2="14" y2="15" className={cn("transition-all", active ? "stroke-orange-500/60" : "stroke-muted-foreground/20")} strokeWidth="2" />
      <line x1="8" y1="20" x2="14" y2="20" className={cn("transition-all", active ? "stroke-orange-500/60" : "stroke-muted-foreground/20")} strokeWidth="2" />
      <line x1="8" y1="25" x2="14" y2="25" className={cn("transition-all", active ? "stroke-orange-500/60" : "stroke-muted-foreground/20")} strokeWidth="2" />
      <rect x="20" y="14" width="12" height="12" rx="1" 
        className={cn("transition-all", active ? "fill-gray-800 stroke-orange-400" : "fill-muted stroke-muted-foreground/20")} 
        strokeWidth="1" />
      {active && (
        <>
          <circle cx="24" cy="18" r="1.5" className="fill-emerald-400 animate-pulse" />
          <circle cx="28" cy="18" r="1.5" className="fill-orange-400 animate-pulse" />
          <g className="animate-bounce">
            <circle cx="6" cy="6" r="2" className="fill-gray-400/60" />
            <circle cx="10" cy="4" r="1.5" className="fill-gray-400/40" />
          </g>
        </>
      )}
      <circle cx="26" cy="24" r="2" className={cn("transition-all", active ? "fill-orange-600 stroke-orange-400" : "fill-muted-foreground/30 stroke-muted-foreground/20")} strokeWidth="1" />
    </g>
  );
}

function GridIcon({ active }: { active: boolean }) {
  return (
    <g>
      <path d="M20 4 L15 14 L10 14 L6 36 L14 36 L16 24 L24 24 L26 36 L34 36 L30 14 L25 14 L20 4" 
        className={cn("transition-all duration-500", active ? "fill-gray-500/20 stroke-gray-500" : "fill-muted/30 stroke-muted-foreground/30")} 
        strokeWidth="2" strokeLinejoin="round" />
      <line x1="11" y1="18" x2="29" y2="18" className={cn("transition-all", active ? "stroke-gray-500" : "stroke-muted-foreground/30")} strokeWidth="2" />
      <line x1="13" y1="28" x2="27" y2="28" className={cn("transition-all", active ? "stroke-gray-500" : "stroke-muted-foreground/30")} strokeWidth="2" />
      {active && (
        <g>
          <line x1="0" y1="8" x2="12" y2="8" className="stroke-gray-400" strokeWidth="1.5" />
          <line x1="28" y1="8" x2="40" y2="8" className="stroke-gray-400" strokeWidth="1.5" />
          <circle cx="6" cy="8" r="2" className="fill-yellow-400 animate-ping" />
          <circle cx="34" cy="8" r="2" className="fill-yellow-400 animate-ping" />
        </g>
      )}
    </g>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <g>
      <path d="M4 20 L20 6 L36 20" 
        className={cn("transition-all duration-500 fill-none", active ? "stroke-emerald-500" : "stroke-muted-foreground/30")} 
        strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="8" y="20" width="24" height="18" 
        className={cn("transition-all duration-500", active ? "fill-emerald-500/20 stroke-emerald-500" : "fill-muted/30 stroke-muted-foreground/30")} 
        strokeWidth="2" />
      <rect x="16" y="26" width="8" height="12" 
        className={cn("transition-all", active ? "fill-emerald-600/50 stroke-emerald-500" : "fill-muted stroke-muted-foreground/20")} 
        strokeWidth="1" />
      <rect x="11" y="23" width="4" height="4" 
        className={cn("transition-all", active ? "fill-yellow-300/80" : "fill-muted")} />
      <rect x="25" y="23" width="4" height="4" 
        className={cn("transition-all", active ? "fill-yellow-300/80" : "fill-muted")} />
      {active && (
        <circle cx="20" cy="25" r="6" className="fill-yellow-400/20 animate-pulse" />
      )}
    </g>
  );
}

function ATSIcon({ active, gridMode }: { active: boolean; gridMode: boolean }) {
  return (
    <g>
      <rect x="4" y="4" width="32" height="32" rx="3" 
        className={cn("transition-all duration-500", active ? "fill-blue-500/20 stroke-blue-500" : "fill-muted/30 stroke-muted-foreground/30")} 
        strokeWidth="2" />
      <circle cx="20" cy="20" r="8" 
        className={cn("transition-all", active ? "fill-blue-600/30 stroke-blue-400" : "fill-muted stroke-muted-foreground/20")} 
        strokeWidth="2" />
      <line x1="20" y1="20" x2={gridMode ? 14 : 26} y2={gridMode ? 13 : 13} 
        className={cn("transition-all duration-500", active ? (gridMode ? "stroke-gray-400" : "stroke-orange-500") : "stroke-muted-foreground/30")} 
        strokeWidth="3" strokeLinecap="round" />
      <text x="8" y="10" className={cn("text-[5px] font-bold transition-all", gridMode && active ? "fill-gray-500" : "fill-muted-foreground/30")}>GRID</text>
      <text x="24" y="10" className={cn("text-[5px] font-bold transition-all", !gridMode && active ? "fill-orange-500" : "fill-muted-foreground/30")}>GEN</text>
      <circle cx="10" cy="32" r="2" className={cn("transition-all", active && gridMode ? "fill-emerald-400" : "fill-muted-foreground/30")} />
      <circle cx="30" cy="32" r="2" className={cn("transition-all", active && !gridMode ? "fill-orange-400 animate-pulse" : "fill-muted-foreground/30")} />
    </g>
  );
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
      {/* Background track */}
      <path 
        d={path} 
        fill="none" 
        className={cn("transition-all duration-500", active ? "stroke-current opacity-30" : "stroke-muted-foreground/20")}
        style={{ color }}
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Animated flow */}
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

// Flow diagrams for each system type
function GridTiedFlow({ mode }: { mode: OperationMode }) {
  const isNormal = mode === "normal";
  
  return (
    <svg viewBox="0 0 340 160" className="w-full h-auto">
      <style>{`
        @keyframes flowAnimation {
          0% { stroke-dashoffset: 40; }
          100% { stroke-dashoffset: 0; }
        }
        .animate-flow {
          animation: flowAnimation 0.8s linear infinite;
        }
      `}</style>
      
      {/* Solar Panel */}
      <g transform="translate(10, 20)">
        <SolarPanelIcon active={isNormal} />
      </g>
      <text x="30" y="70" className={cn("text-[9px] font-semibold text-center", isNormal ? "fill-foreground" : "fill-muted-foreground/60")}>Solar PV</text>
      <text x="25" y="80" className="text-[7px] fill-muted-foreground">{isNormal ? "Generating" : "Offline"}</text>
      
      {/* Flow: Solar to Inverter */}
      <FlowLine 
        path="M 55 38 L 100 38" 
        active={isNormal} 
        color="#eab308"
      />
      
      {/* Inverter */}
      <g transform="translate(105, 18)">
        <InverterIcon active={isNormal} />
      </g>
      <text x="125" y="70" className={cn("text-[9px] font-semibold text-center", isNormal ? "fill-foreground" : "fill-muted-foreground/60")}>Inverter</text>
      <text x="120" y="80" className="text-[7px] fill-muted-foreground">{isNormal ? "Converting" : "Shutdown"}</text>
      
      {/* Flow: Inverter to Home */}
      <FlowLine 
        path="M 155 38 L 200 38" 
        active={isNormal} 
        color="#22c55e"
      />
      
      {/* Home */}
      <g transform="translate(205, 18)">
        <HomeIcon active={isNormal} />
      </g>
      <text x="230" y="70" className={cn("text-[9px] font-semibold text-center", isNormal ? "fill-foreground" : "fill-muted-foreground/60")}>Loads</text>
      <text x="225" y="80" className="text-[7px] fill-muted-foreground">{isNormal ? "Powered" : "No Power"}</text>
      
      {/* Flow: Inverter to Grid (bidirectional) */}
      <FlowLine 
        path="M 125 55 L 125 95" 
        active={isNormal} 
        color="#6b7280"
      />
      
      {/* Grid */}
      <g transform="translate(105, 100)">
        <GridIcon active={isNormal} />
      </g>
      <text x="130" y="150" className={cn("text-[9px] font-semibold text-center", isNormal ? "fill-foreground" : "fill-muted-foreground/60")}>Grid</text>
      
      {/* Status Box */}
      <rect x="260" y="20" width="70" height="50" rx="4" 
        className={cn("transition-all duration-500", isNormal ? "fill-emerald-500/10 stroke-emerald-500/30" : "fill-red-500/10 stroke-red-500/30")} 
        strokeWidth="1" />
      <text x="295" y="40" className={cn("text-[9px] font-bold text-center", isNormal ? "fill-emerald-600" : "fill-red-600")}>
        {isNormal ? "✓ Normal" : "✗ Offline"}
      </text>
      <text x="295" y="52" className="text-[7px] fill-muted-foreground text-center">
        {isNormal ? "Solar powers" : "Anti-islanding"}
      </text>
      <text x="295" y="62" className="text-[7px] fill-muted-foreground text-center">
        {isNormal ? "loads + grid" : "shutdown"}
      </text>
    </svg>
  );
}

function HybridFlow({ mode }: { mode: OperationMode }) {
  const isNormal = mode === "normal";
  
  return (
    <svg viewBox="0 0 340 180" className="w-full h-auto">
      <style>{`
        @keyframes flowAnimation {
          0% { stroke-dashoffset: 40; }
          100% { stroke-dashoffset: 0; }
        }
        .animate-flow {
          animation: flowAnimation 0.8s linear infinite;
        }
      `}</style>
      
      {/* Solar Panel */}
      <g transform="translate(10, 20)">
        <SolarPanelIcon active={true} />
      </g>
      <text x="30" y="75" className="text-[9px] font-semibold fill-foreground">Solar PV</text>
      <text x="25" y="85" className="text-[7px] fill-muted-foreground">Generating</text>
      
      {/* Flow: Solar to Inverter */}
      <FlowLine 
        path="M 55 38 L 100 38" 
        active={true} 
        color="#eab308"
      />
      
      {/* Hybrid Inverter */}
      <g transform="translate(105, 18)">
        <InverterIcon active={true} />
      </g>
      <text x="115" y="75" className="text-[9px] font-semibold fill-foreground">Hybrid Inv</text>
      <text x="120" y="85" className="text-[7px] fill-muted-foreground">Active</text>
      
      {/* Flow: Inverter to Home */}
      <FlowLine 
        path="M 155 38 L 200 38" 
        active={true} 
        color="#22c55e"
      />
      
      {/* Home */}
      <g transform="translate(205, 18)">
        <HomeIcon active={true} />
      </g>
      <text x="230" y="75" className="text-[9px] font-semibold fill-foreground">Loads</text>
      <text x="225" y="85" className="text-[7px] fill-muted-foreground">Powered</text>
      
      {/* Flow: Grid to Inverter */}
      <FlowLine 
        path="M 45 130 L 105 130 L 105 55" 
        active={isNormal} 
        color="#6b7280"
      />
      
      {/* Grid */}
      <g transform="translate(5, 105)">
        <GridIcon active={isNormal} />
      </g>
      <text x="30" y="155" className={cn("text-[9px] font-semibold", isNormal ? "fill-foreground" : "fill-muted-foreground/60")}>Grid</text>
      <text x="20" y="165" className="text-[7px] fill-muted-foreground">{isNormal ? "Connected" : "Offline"}</text>
      
      {/* Flow: Inverter to/from Battery */}
      <FlowLine 
        path="M 145 55 L 145 105 L 190 105" 
        active={true} 
        color={isNormal ? "#22c55e" : "#f97316"}
        reverse={!isNormal}
      />
      
      {/* Battery */}
      <g transform="translate(195, 90)">
        <BatteryIcon active={true} charging={isNormal} />
      </g>
      <text x="220" y="140" className="text-[9px] font-semibold fill-foreground">Battery</text>
      <text x="210" y="150" className="text-[7px] fill-muted-foreground">{isNormal ? "Charging" : "Discharging"}</text>
      
      {/* Status Box */}
      <rect x="260" y="20" width="70" height="50" rx="4" 
        className="fill-emerald-500/10 stroke-emerald-500/30" 
        strokeWidth="1" />
      <text x="295" y="38" className="text-[9px] font-bold fill-emerald-600 text-center">✓ Always On</text>
      <text x="295" y="50" className="text-[7px] fill-muted-foreground text-center">
        {isNormal ? "Solar + Grid" : "Battery backup"}
      </text>
      <text x="295" y="62" className="text-[7px] fill-muted-foreground text-center">
        {isNormal ? "charging battery" : "<20ms switch"}
      </text>
    </svg>
  );
}

function GeneratorFlow({ mode }: { mode: OperationMode }) {
  const isNormal = mode === "normal";
  
  return (
    <svg viewBox="0 0 340 160" className="w-full h-auto">
      <style>{`
        @keyframes flowAnimation {
          0% { stroke-dashoffset: 40; }
          100% { stroke-dashoffset: 0; }
        }
        .animate-flow {
          animation: flowAnimation 0.8s linear infinite;
        }
      `}</style>
      
      {/* Grid */}
      <g transform="translate(10, 20)">
        <GridIcon active={isNormal} />
      </g>
      <text x="35" y="70" className={cn("text-[9px] font-semibold", isNormal ? "fill-foreground" : "fill-muted-foreground/60")}>Grid</text>
      <text x="25" y="80" className="text-[7px] fill-muted-foreground">{isNormal ? "Connected" : "Offline"}</text>
      
      {/* Flow: Grid to ATS */}
      <FlowLine 
        path="M 55 38 L 100 38" 
        active={isNormal} 
        color="#6b7280"
      />
      
      {/* ATS */}
      <g transform="translate(105, 18)">
        <ATSIcon active={true} gridMode={isNormal} />
      </g>
      <text x="135" y="70" className="text-[9px] font-semibold fill-foreground">ATS</text>
      <text x="125" y="80" className="text-[7px] fill-muted-foreground">{isNormal ? "Grid Mode" : "Gen Mode"}</text>
      
      {/* Flow: ATS to Home */}
      <FlowLine 
        path="M 155 38 L 200 38" 
        active={true} 
        color={isNormal ? "#6b7280" : "#f97316"}
      />
      
      {/* Home */}
      <g transform="translate(205, 18)">
        <HomeIcon active={true} />
      </g>
      <text x="230" y="70" className="text-[9px] font-semibold fill-foreground">Loads</text>
      <text x="225" y="80" className="text-[7px] fill-muted-foreground">Powered</text>
      
      {/* Flow: Generator to ATS */}
      <FlowLine 
        path="M 45 130 L 125 130 L 125 55" 
        active={!isNormal} 
        color="#f97316"
      />
      
      {/* Generator */}
      <g transform="translate(5, 105)">
        <GeneratorIcon active={!isNormal} />
      </g>
      <text x="25" y="150" className={cn("text-[9px] font-semibold", !isNormal ? "fill-foreground" : "fill-muted-foreground/60")}>Generator</text>
      <text x="25" y="160" className="text-[7px] fill-muted-foreground">{!isNormal ? "Running" : "Standby"}</text>
      
      {/* Status Box */}
      <rect x="260" y="20" width="70" height="55" rx="4" 
        className={cn("transition-all duration-500", isNormal ? "fill-emerald-500/10 stroke-emerald-500/30" : "fill-orange-500/10 stroke-orange-500/30")} 
        strokeWidth="1" />
      <text x="295" y="38" className={cn("text-[9px] font-bold text-center", isNormal ? "fill-emerald-600" : "fill-orange-600")}>
        {isNormal ? "✓ Grid Power" : "⚡ Gen Power"}
      </text>
      <text x="295" y="50" className="text-[7px] fill-muted-foreground text-center">
        {isNormal ? "Normal" : "30-60s delay"}
      </text>
      <text x="295" y="62" className="text-[7px] fill-muted-foreground text-center">
        {isNormal ? "operation" : "to switch"}
      </text>
    </svg>
  );
}

function SolarGeneratorFlow({ mode }: { mode: OperationMode }) {
  const isNormal = mode === "normal";
  
  return (
    <svg viewBox="0 0 340 200" className="w-full h-auto">
      <style>{`
        @keyframes flowAnimation {
          0% { stroke-dashoffset: 40; }
          100% { stroke-dashoffset: 0; }
        }
        .animate-flow {
          animation: flowAnimation 0.8s linear infinite;
        }
      `}</style>
      
      {/* Solar Panel */}
      <g transform="translate(10, 10)">
        <SolarPanelIcon active={true} />
      </g>
      <text x="30" y="60" className="text-[9px] font-semibold fill-foreground">Solar PV</text>
      
      {/* Flow: Solar to Inverter */}
      <FlowLine 
        path="M 55 28 L 85 28 L 85 55 L 105 55" 
        active={true} 
        color="#eab308"
      />
      
      {/* Hybrid Inverter */}
      <g transform="translate(105, 35)">
        <InverterIcon active={true} />
      </g>
      <text x="115" y="90" className="text-[9px] font-semibold fill-foreground">Hybrid Inv</text>
      
      {/* Flow: Inverter to Home */}
      <FlowLine 
        path="M 155 55 L 200 55" 
        active={true} 
        color="#22c55e"
      />
      
      {/* Home */}
      <g transform="translate(205, 35)">
        <HomeIcon active={true} />
      </g>
      <text x="230" y="90" className="text-[9px] font-semibold fill-foreground">Loads</text>
      
      {/* Flow: Inverter to Battery */}
      <FlowLine 
        path="M 145 72 L 145 105 L 190 105" 
        active={true} 
        color={isNormal ? "#22c55e" : "#f97316"}
        reverse={!isNormal}
      />
      
      {/* Battery */}
      <g transform="translate(195, 90)">
        <BatteryIcon active={true} charging={isNormal} />
      </g>
      <text x="220" y="140" className="text-[9px] font-semibold fill-foreground">Battery</text>
      
      {/* Grid connection */}
      <FlowLine 
        path="M 45 160 L 105 160 L 105 72" 
        active={isNormal} 
        color="#6b7280"
      />
      
      {/* Grid */}
      <g transform="translate(5, 140)">
        <GridIcon active={isNormal} />
      </g>
      <text x="30" y="190" className={cn("text-[9px] font-semibold", isNormal ? "fill-foreground" : "fill-muted-foreground/60")}>Grid</text>
      
      {/* Generator connection through ATS */}
      <FlowLine 
        path="M 255 160 L 195 160 L 195 125" 
        active={!isNormal} 
        color="#f97316"
      />
      
      {/* Generator */}
      <g transform="translate(260, 140)">
        <GeneratorIcon active={!isNormal} />
      </g>
      <text x="280" y="190" className={cn("text-[9px] font-semibold", !isNormal ? "fill-foreground" : "fill-muted-foreground/60")}>Generator</text>
      
      {/* Status Box */}
      <rect x="260" y="10" width="70" height="55" rx="4" 
        className="fill-emerald-500/10 stroke-emerald-500/30" 
        strokeWidth="1" />
      <text x="295" y="28" className="text-[9px] font-bold fill-emerald-600 text-center">✓ Full Backup</text>
      <text x="295" y="42" className="text-[7px] fill-muted-foreground text-center">
        {isNormal ? "Solar + Battery" : "Gen charging"}
      </text>
      <text x="295" y="54" className="text-[7px] fill-muted-foreground text-center">
        {isNormal ? "+ Grid" : "battery"}
      </text>
    </svg>
  );
}

export function EnergyFlowInfographic({ systemType, className }: EnergyFlowInfographicProps) {
  const [mode, setMode] = useState<OperationMode>("normal");
  
  // Auto-cycle modes - always running
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
        <h4 className="text-sm font-semibold">Energy Flow Diagram</h4>
        <span className={cn(
          "text-xs px-2 py-0.5 rounded-full transition-all duration-500",
          mode === "normal" 
            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
            : "bg-red-500/20 text-red-600 dark:text-red-400"
        )}>
          {mode === "normal" ? "Normal Operation" : "Load Shedding"}
        </span>
      </div>
      
      <FlowComponent mode={mode} />
    </div>
  );
}
