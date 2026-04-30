'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import Lenis from 'lenis';

type Ctx = {
  /** Total scroll progress: 0..1 */
  progress: number;
  /** Active act index */
  act: number;
  /** Total acts */
  total: number;
};

const ScrollCtx = createContext<Ctx>({ progress: 0, act: 0, total: 1 });

/**
 * Module-level ref so R3F components (Director, ActiveCar, ActiveStage)
 * can poll the latest scroll progress every frame without subscribing to
 * React context (which would re-render the entire scene tree on every
 * scroll event and cause noticeable jank).
 */
export const scrollRef = { current: 0, total: 1, act: 0 };

export function useScrollProgress() {
  return useContext(ScrollCtx);
}

/** R3F-friendly: returns the live module-level ref. Read inside `useFrame`. */
export function getScrollProgress() {
  return scrollRef;
}

export default function ScrollProvider({
  total,
  children,
}: {
  total: number;
  children: React.ReactNode;
}) {
  const [progress, setProgress] = useState(0);
  const [act, setAct] = useState(0);
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    scrollRef.total = total;
    const lenis = new Lenis({
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.2,
    });
    lenisRef.current = lenis;

    let rafId = 0;
    let lastReactCommit = 0;
    let lastReactProgress = -1;
    let lastReactAct = -1;

    function raf(time: number) {
      lenis.raf(time);
      // Update the module ref every frame — cheap, no React work.
      const scrollTop = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, scrollTop / max)) : 0;
      const a = Math.min(total - 1, Math.floor(p * total + 0.0001));
      scrollRef.current = p;
      scrollRef.act = a;

      // Throttle React state updates to ~30 Hz AND only when the value
      // actually changes meaningfully. This is what fixes scroll jank —
      // R3F components read from `scrollRef` directly and never re-render.
      const dueByTime = time - lastReactCommit > 33;
      const dueByDelta = Math.abs(p - lastReactProgress) > 0.0015 || a !== lastReactAct;
      if (dueByTime && dueByDelta) {
        lastReactCommit = time;
        lastReactProgress = p;
        lastReactAct = a;
        setProgress(p);
        setAct(a);
      }
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [total]);

  return (
    <ScrollCtx.Provider value={{ progress, act, total }}>
      {children}
    </ScrollCtx.Provider>
  );
}
