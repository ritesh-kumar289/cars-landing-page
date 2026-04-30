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

export function useScrollProgress() {
  return useContext(ScrollCtx);
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
    const lenis = new Lenis({
      duration: 1.4,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.2,
    });
    lenisRef.current = lenis;

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    const onScroll = () => {
      const scrollTop = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, scrollTop / max)) : 0;
      setProgress(p);
      const a = Math.min(total - 1, Math.floor(p * total + 0.0001));
      setAct(a);
    };

    lenis.on('scroll', onScroll);
    onScroll();

    return () => {
      lenis.destroy();
    };
  }, [total]);

  return (
    <ScrollCtx.Provider value={{ progress, act, total }}>
      {children}
    </ScrollCtx.Provider>
  );
}
