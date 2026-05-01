'use client';

import { useEffect, useRef } from 'react';
import { useScrollProgress, scrollRef } from '../lib/scroll';
import { useReel } from '../lib/reel';

export default function HUD() {
  // Only `act` is read from React state (changes rarely). Progress is
  // pulled from `scrollRef` every frame and written directly to the DOM
  // so the HUD never re-renders during scroll.
  const { act } = useScrollProgress();
  const { acts } = useReel();
  const barRef = useRef<HTMLDivElement | null>(null);
  const tcRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let raf = 0;
    let lastP = -1;
    const tick = () => {
      const p = scrollRef.current;
      if (Math.abs(p - lastP) > 0.0008) {
        lastP = p;
        if (barRef.current) barRef.current.style.width = `${p * 100}%`;
        if (tcRef.current) {
          const a = Math.floor(p * 99);
          const b = Math.floor((p * 99 * 60) % 60);
          const c = Math.floor((p * 99 * 3600) % 60);
          tcRef.current.textContent = `REEL 07 · TC ${String(a).padStart(2, '0')}:${String(b).padStart(2, '0')}:${String(c).padStart(2, '0')}`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 px-4 sm:px-6 md:px-10 pt-[max(env(safe-area-inset-top),5vh)] flex items-center justify-between gap-3 mix-blend-difference text-bone">
        <a href="#" className="display text-xl sm:text-2xl tracking-tight whitespace-nowrap">
          OFF<em>TRACKS</em>
        </a>
        <nav className="hidden md:flex items-center gap-8 smallcaps">
          <a href="#collection" className="hover:text-ember transition">Collection</a>
          <a href="#story" className="hover:text-ember transition">Reel</a>
          <a href="#access" className="hover:text-ember transition">Access</a>
        </nav>
        <a href="#access" className="btn-ghost whitespace-nowrap text-xs sm:text-sm">Request Access →</a>
      </header>

      <div className="letterbox-top" aria-hidden />
      <div className="letterbox-bottom" aria-hidden />

      <aside className="fixed right-6 top-1/2 -translate-y-1/2 z-50 hidden md:flex flex-col items-center gap-3">
        {acts.map((a, i) => (
          <a
            key={a.id}
            href={`#act-${i}`}
            className="group flex items-center gap-3"
            aria-label={a.title}
          >
            <span className={`smallcaps font-mono text-bone/40 transition group-hover:text-bone ${i === act ? 'text-bone' : ''}`}>
              {String(i).padStart(2, '0')}
            </span>
            <span className={`dot ${i === act ? 'active' : ''}`} />
          </a>
        ))}
      </aside>

      <div
        ref={tcRef}
        className="fixed left-4 sm:left-6 bottom-[max(env(safe-area-inset-bottom),5vh)] z-50 smallcaps font-mono text-xs sm:text-sm text-bone/60"
      >
        REEL 07 · TC 00:00:00
      </div>

      <div className="fixed right-6 bottom-[max(env(safe-area-inset-bottom),5vh)] z-50 smallcaps text-bone/60 hidden md:flex items-center gap-2">
        <span>Scroll</span>
        <span className="inline-block w-12 h-px bg-bone/40" />
      </div>

      <div
        ref={barRef}
        className="loader-bar"
        style={{ width: '0%', top: 0, bottom: 'auto', zIndex: 60 }}
      />
    </>
  );
}
