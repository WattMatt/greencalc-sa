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
// Icon bounds reference:
// SolarIcon: y+15 = bottom, GridIcon: y+18 = bottom, GeneratorIcon: y+12 = bottom
// InverterIcon: y-16 = top, y+16 = bottom, ATSIcon: y-16 = top, y+16 = bottom
// BatteryIcon: x-18 = left, x+22 = right, y-12 = top, y+12 = bottom
// HomeIcon: y-16 = top (roof)

function GridTiedFlow({ mode }: { mode: OperationMode }) {
  const isNormal = mode === "normal";
  
  // Positions
  const solarX = 60, solarY = 40;
  const gridX = 140, gridY = 40;
  const invX = 100, invY = 110;
  const homeX = 100, homeY = 190;
  
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
      <SolarIcon active={isNormal} x={solarX} y={solarY} />
      <GridIcon active={isNormal} x={gridX} y={gridY} />
      
      {/* Flow: Solar down to Inverter - solar bottom at y+15, inverter top at y-16 */}
      <FlowLine 
        path={`M ${solarX} ${solarY + 15} L ${solarX} ${invY - 26} L ${invX} ${invY - 26} L ${invX} ${invY - 16}`} 
        active={isNormal} 
        color="#eab308" 
      />
      
      {/* Flow: Grid down to Inverter - grid bottom at y+18 */}
      <FlowLine 
        path={`M ${gridX} ${gridY + 18} L ${gridX} ${invY - 26} L ${invX} ${invY - 26}`} 
        active={isNormal} 
        color="#6b7280" 
      />
      
      {/* Middle: Inverter */}
      <InverterIcon active={isNormal} x={invX} y={invY} />
      
      {/* Flow: Inverter down to Home - inverter bottom at y+16, home top at y-16 */}
      <FlowLine 
        path={`M ${invX} ${invY + 16} L ${invX} ${homeY - 16}`} 
        active={isNormal} 
        color="#22c55e" 
      />
      
      {/* Bottom: Home/Loads */}
      <HomeIcon active={isNormal} x={homeX} y={homeY} />
      
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
  
  // Positions
  const solarX = 50, solarY = 40;
  const gridX = 150, gridY = 40;
  const invX = 100, invY = 115;
  const battX = 170, battY = 115;
  const homeX = 100, homeY = 195;
  
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
      <SolarIcon active={true} x={solarX} y={solarY} />
      <GridIcon active={isNormal} x={gridX} y={gridY} />
      
      {/* Flow: Solar to Inverter - solar bottom at y+15, inverter top at y-16 */}
      <FlowLine 
        path={`M ${solarX} ${solarY + 15} L ${solarX} ${invY - 30} L ${invX} ${invY - 30} L ${invX} ${invY - 16}`} 
        active={true} 
        color="#eab308" 
      />
      
      {/* Flow: Grid to Inverter - grid bottom at y+18 */}
      <FlowLine 
        path={`M ${gridX} ${gridY + 18} L ${gridX} ${invY - 30} L ${invX} ${invY - 30}`} 
        active={isNormal} 
        color="#6b7280" 
      />
      
      {/* Middle: Hybrid Inverter */}
      <InverterIcon active={true} x={invX} y={invY} label="Hybrid Inv" />
      
      {/* Flow: Inverter to Battery - inverter right at x+18, battery left at x-18 */}
      <FlowLine 
        path={`M ${invX + 18} ${invY} L ${battX - 18} ${battY}`} 
        active={true} 
        color={isNormal ? "#22c55e" : "#f97316"}
        reverse={!isNormal}
      />
      
      {/* Battery on right side */}
      <BatteryIcon active={true} charging={isNormal} x={battX} y={battY} />
      
      {/* Flow: Inverter to Home - inverter bottom at y+16, home top at y-16 */}
      <FlowLine 
        path={`M ${invX} ${invY + 16} L ${invX} ${homeY - 16}`} 
        active={true} 
        color="#22c55e" 
      />
      
      {/* Bottom: Home */}
      <HomeIcon active={true} x={homeX} y={homeY} />
      
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
  
  // Positions
  const gridX = 60, gridY = 40;
  const genX = 140, genY = 40;
  const atsX = 100, atsY = 115;
  const homeX = 100, homeY = 195;
  
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
      <GridIcon active={isNormal} x={gridX} y={gridY} />
      <GeneratorIcon active={!isNormal} x={genX} y={genY} />
      
      {/* Flow: Grid to ATS - grid bottom at y+18, ATS top at y-16 */}
      <FlowLine 
        path={`M ${gridX} ${gridY + 18} L ${gridX} ${atsY - 30} L ${atsX} ${atsY - 30} L ${atsX} ${atsY - 16}`} 
        active={isNormal} 
        color="#6b7280" 
      />
      
      {/* Flow: Generator to ATS - generator bottom at y+12 */}
      <FlowLine 
        path={`M ${genX} ${genY + 12} L ${genX} ${atsY - 30} L ${atsX} ${atsY - 30}`} 
        active={!isNormal} 
        color="#f97316" 
      />
      
      {/* Middle: ATS */}
      <ATSIcon active={true} gridMode={isNormal} x={atsX} y={atsY} />
      
      {/* Flow: ATS to Home - ATS bottom at y+16, home top at y-16 */}
      <FlowLine 
        path={`M ${atsX} ${atsY + 16} L ${atsX} ${homeY - 16}`} 
        active={true} 
        color={isNormal ? "#6b7280" : "#f97316"} 
      />
      
      {/* Bottom: Home */}
      <HomeIcon active={true} x={homeX} y={homeY} />
      
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
  
  // Positions - Solar + Generator system WITHOUT battery
  const solarX = 50, solarY = 40;
  const gridX = 110, gridY = 40;
  const genX = 170, genY = 40;
  const invX = 80, invY = 115;
  const atsX = 145, atsY = 115;
  const homeX = 110, homeY = 195;
  
  return (
    <svg viewBox="0 0 220 260" className="w-full h-auto max-w-[220px] mx-auto">
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
      <SolarIcon active={true} x={solarX} y={solarY} />
      <GridIcon active={isNormal} x={gridX} y={gridY} />
      <GeneratorIcon active={!isNormal} x={genX} y={genY} />
      
      {/* Flow: Solar to Inverter */}
      <FlowLine 
        path={`M ${solarX} ${solarY + 15} L ${solarX} ${invY - 30} L ${invX} ${invY - 30} L ${invX} ${invY - 16}`} 
        active={true} 
        color="#eab308" 
      />
      
      {/* Flow: Grid to ATS */}
      <FlowLine 
        path={`M ${gridX} ${gridY + 18} L ${gridX} ${atsY - 30} L ${atsX} ${atsY - 30} L ${atsX} ${atsY - 16}`} 
        active={isNormal} 
        color="#6b7280" 
      />
      
      {/* Flow: Generator to ATS */}
      <FlowLine 
        path={`M ${genX} ${genY + 12} L ${genX} ${atsY - 30} L ${atsX} ${atsY - 30}`} 
        active={!isNormal} 
        color="#f97316" 
      />
      
      {/* Middle: Inverter (for solar) and ATS (for grid/gen switching) */}
      <InverterIcon active={true} x={invX} y={invY} label="Inverter" />
      <ATSIcon active={true} gridMode={isNormal} x={atsX} y={atsY} />
      
      {/* Flow: Inverter to Home */}
      <FlowLine 
        path={`M ${invX} ${invY + 16} L ${invX} ${homeY - 30} L ${homeX} ${homeY - 30} L ${homeX} ${homeY - 16}`} 
        active={true} 
        color="#22c55e" 
      />
      
      {/* Flow: ATS to Home */}
      <FlowLine 
        path={`M ${atsX} ${atsY + 16} L ${atsX} ${homeY - 30} L ${homeX} ${homeY - 30}`} 
        active={true} 
        color={isNormal ? "#6b7280" : "#f97316"} 
      />
      
      {/* Bottom: Home */}
      <HomeIcon active={true} x={homeX} y={homeY} />
      
      {/* Status */}
      <rect x="10" y="230" width="200" height="24" rx="4" 
        className={cn("transition-all duration-500", isNormal ? "fill-emerald-500/10 stroke-emerald-500/30" : "fill-orange-500/10 stroke-orange-500/30")} 
        strokeWidth="1" />
      <text x="110" y="246" className={cn("text-[9px] font-semibold", isNormal ? "fill-emerald-600" : "fill-orange-600")} textAnchor="middle">
        {isNormal ? "✓ Solar + Grid powering loads" : "⚡ Solar + Generator backup"}
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
