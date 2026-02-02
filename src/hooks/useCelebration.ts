import { useCallback } from 'react';
import confetti from 'canvas-confetti';

export function useCelebration() {
  const celebrate = useCallback(() => {
    // Fire confetti from both sides
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    // Left side burst
    fire(0.25, {
      spread: 26,
      startVelocity: 55,
      origin: { x: 0.2, y: 0.7 },
    });

    fire(0.2, {
      spread: 60,
      origin: { x: 0.2, y: 0.7 },
    });

    // Right side burst
    fire(0.25, {
      spread: 26,
      startVelocity: 55,
      origin: { x: 0.8, y: 0.7 },
    });

    fire(0.2, {
      spread: 60,
      origin: { x: 0.8, y: 0.7 },
    });

    // Center burst with colors
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
      origin: { x: 0.5, y: 0.6 },
      colors: ['#22c55e', '#3b82f6', '#eab308', '#ec4899', '#a855f7'],
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
      origin: { x: 0.5, y: 0.6 },
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 45,
      origin: { x: 0.5, y: 0.6 },
    });
  }, []);

  const celebrateSubtle = useCallback(() => {
    // Smaller celebration for individual task completion
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#22c55e', '#3b82f6', '#eab308'],
      zIndex: 9999,
    });
  }, []);

  const celebrateAllComplete = useCallback(() => {
    // Big celebration when all tasks are done
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: ReturnType<typeof setInterval> = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#22c55e', '#3b82f6', '#eab308', '#ec4899', '#a855f7'],
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#22c55e', '#3b82f6', '#eab308', '#ec4899', '#a855f7'],
      });
    }, 250);
  }, []);

  return {
    celebrate,
    celebrateSubtle,
    celebrateAllComplete,
  };
}
