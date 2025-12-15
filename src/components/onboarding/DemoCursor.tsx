import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { MousePointer2 } from "lucide-react";

interface DemoCursorProps {
  targetSelector: string;
  isActive: boolean;
  onArrived?: () => void;
  className?: string;
}

interface CursorPosition {
  x: number;
  y: number;
}

export function DemoCursor({ targetSelector, isActive, onArrived, className }: DemoCursorProps) {
  const [position, setPosition] = useState<CursorPosition>({ x: -100, y: -100 });
  const [isMoving, setIsMoving] = useState(false);
  const [showClick, setShowClick] = useState(false);
  const arrivedRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      setPosition({ x: -100, y: -100 });
      arrivedRef.current = false;
      return;
    }

    const element = document.querySelector(targetSelector);
    if (!element) {
      // No target, hide cursor
      setPosition({ x: -100, y: -100 });
      return;
    }

    const rect = element.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;

    // Start from current position or center of screen
    setIsMoving(true);
    arrivedRef.current = false;

    // Animate to target
    const startX = position.x < 0 ? window.innerWidth / 2 : position.x;
    const startY = position.y < 0 ? window.innerHeight / 2 : position.y;
    
    const duration = 800; // ms
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);

      const currentX = startX + (targetX - startX) * eased;
      const currentY = startY + (targetY - startY) * eased;

      setPosition({ x: currentX, y: currentY });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsMoving(false);
        // Trigger click animation
        setShowClick(true);
        setTimeout(() => {
          setShowClick(false);
          if (!arrivedRef.current) {
            arrivedRef.current = true;
            onArrived?.();
          }
        }, 300);
      }
    };

    requestAnimationFrame(animate);
  }, [targetSelector, isActive]);

  if (!isActive || position.x < 0) return null;

  return (
    <div
      className={cn(
        "fixed z-[105] pointer-events-none transition-opacity duration-200",
        isMoving ? "opacity-100" : "opacity-90",
        className
      )}
      style={{
        left: position.x,
        top: position.y,
        transform: "translate(-4px, -4px)",
      }}
    >
      {/* Cursor icon */}
      <div className={cn(
        "relative",
        showClick && "animate-[cursor-click_0.3s_ease-out]"
      )}>
        <MousePointer2 
          className="h-6 w-6 text-primary drop-shadow-lg" 
          style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}
        />
        
        {/* Click ripple effect */}
        {showClick && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="h-8 w-8 rounded-full border-2 border-primary animate-[cursor-ripple_0.4s_ease-out_forwards] opacity-60" />
          </div>
        )}
      </div>

      {/* Cursor trail dots */}
      {isMoving && (
        <>
          <div 
            className="absolute h-2 w-2 rounded-full bg-primary/40"
            style={{ 
              left: -8, 
              top: -8,
              animation: "cursor-trail 0.3s ease-out infinite"
            }}
          />
          <div 
            className="absolute h-1.5 w-1.5 rounded-full bg-primary/20"
            style={{ 
              left: -16, 
              top: -16,
              animation: "cursor-trail 0.3s ease-out infinite 0.1s"
            }}
          />
        </>
      )}

      {/* CSS for cursor animations */}
      <style>{`
        @keyframes cursor-click {
          0% { transform: scale(1); }
          50% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        
        @keyframes cursor-ripple {
          0% { 
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 0.6;
          }
          100% { 
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
          }
        }
        
        @keyframes cursor-trail {
          0% { opacity: 0.4; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.5); }
        }
      `}</style>
    </div>
  );
}
