import { cn } from '@/lib/utils';

interface DependencyDragLineProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  isValid?: boolean;
}

export function DependencyDragLine({ 
  startX, 
  startY, 
  endX, 
  endY, 
  isValid = true 
}: DependencyDragLineProps) {
  // Calculate control points for a curved line
  const midX = (startX + endX) / 2;
  
  const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-50"
      style={{ width: '100%', height: '100%' }}
    >
      {/* Shadow line for visibility */}
      <path
        d={path}
        fill="none"
        stroke="white"
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.5}
      />
      
      {/* Main line */}
      <path
        d={path}
        fill="none"
        stroke={isValid ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={isValid ? 'none' : '5,5'}
        className={cn(
          'transition-colors',
          !isValid && 'animate-pulse'
        )}
      />
      
      {/* End marker */}
      <circle
        cx={endX}
        cy={endY}
        r={6}
        fill={isValid ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
        stroke="white"
        strokeWidth={2}
      />
      
      {/* Start marker */}
      <circle
        cx={startX}
        cy={startY}
        r={4}
        fill={isValid ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
        stroke="white"
        strokeWidth={2}
      />
    </svg>
  );
}
