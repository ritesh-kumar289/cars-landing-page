'use client';

import { useEffect, useState } from 'react';

export default function Loader() {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let p = 0;
    let raf = 0;
    let stalled = 0;

    const tick = () => {
      // Asymptotic loader to 90% while images/models stream, then snap to 100 on load
      p = p + (90 - p) * 0.02;
      setProgress(p);
      stalled++;
      if (stalled < 600) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onReady = () => {
      cancelAnimationFrame(raf);
      let v = p;
      const finish = () => {
        v += 4;
        setProgress(Math.min(100, v));
        if (v < 100) requestAnimationFrame(finish);
        else setTimeout(() => setDone(true), 500);
      };
      finish();
    };

    if (document.readyState === 'complete') {
      setTimeout(onReady, 1200);
    } else {
      window.addEventListener('load', () => setTimeout(onReady, 800));
    }
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <div
        className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-ink transition-opacity duration-700"
        style={{ opacity: done ? 0 : 1, pointerEvents: done ? 'none' : 'auto' }}
      >
        <div className="smallcaps text-bone/60 mb-4">Loading reel</div>
        <div className="display text-bone text-5xl md:text-7xl mb-6 animate-flicker">
          OFF<em>FINDS</em>
        </div>
        <div className="w-64 md:w-96 h-px bg-white/15 relative overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-ember"
            style={{ width: `${progress}%`, transition: 'width 0.2s linear' }}
          />
        </div>
        <div className="mt-3 smallcaps text-bone/40 font-mono">
          {progress.toFixed(0).padStart(3, '0')} / 100
        </div>
      </div>
    </>
  );
}
