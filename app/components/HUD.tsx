'use client';

import { useScrollProgress } from '../lib/scroll';
import { ACTS } from '../lib/cars';

export default function HUD() {
  const { progress, act } = useScrollProgress();

  return (
    <>
      {/* Top bar */}
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

      {/* Letterbox bars (cinematic) */}
      <div className="letterbox-top" aria-hidden />
      <div className="letterbox-bottom" aria-hidden />

      {/* Side rail: act dots + reel timecode */}
      <aside className="fixed right-6 top-1/2 -translate-y-1/2 z-50 hidden md:flex flex-col items-center gap-3">
        {ACTS.map((a, i) => (
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

      {/* Bottom-left: timecode */}
      <div className="fixed left-4 sm:left-6 bottom-[max(env(safe-area-inset-bottom),5vh)] z-50 smallcaps font-mono text-xs sm:text-sm text-bone/60">
        REEL 07 · TC {String(Math.floor(progress * 99)).padStart(2, '0')}:
        {String(Math.floor((progress * 99 * 60) % 60)).padStart(2, '0')}:
        {String(Math.floor((progress * 99 * 3600) % 60)).padStart(2, '0')}
      </div>

      {/* Bottom-right: scroll hint */}
      <div className="fixed right-6 bottom-[max(env(safe-area-inset-bottom),5vh)] z-50 smallcaps text-bone/60 hidden md:flex items-center gap-2">
        <span>Scroll</span>
        <span className="inline-block w-12 h-px bg-bone/40" />
      </div>

      {/* Top progress bar */}
      <div
        className="loader-bar"
        style={{ width: `${progress * 100}%`, top: 0, bottom: 'auto', zIndex: 60 }}
      />
    </>
  );
}
