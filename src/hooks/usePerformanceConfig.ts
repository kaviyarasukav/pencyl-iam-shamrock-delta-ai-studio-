import { useState, useEffect } from 'react';

/**
 * Hook to detect mobile devices and return performance-optimized configuration.
 */
export function usePerformanceConfig() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // Optimization trigger for tablet/mobile
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return {
    isMobile,
    // On mobile, we reduce render frequency for high-update components (DOM, Tape)
    renderThrottleMs: isMobile ? 800 : 100,
    // On mobile, we limit the number of items in real-time lists to reduce DOM nodes
    maxListItems: isMobile ? 5 : 15,
    // On mobile, heavy animations are disabled or simplified
    allowComplexAnimations: !isMobile
  };
}
