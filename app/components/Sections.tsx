'use client';

import { useEffect, useRef } from 'react';
import { useReel } from '../lib/reel';
import Marquee from './Marquee';

/**
 * Sections — invisible spacers that drive scroll length, plus visible captions
 * for each act. The 3D scene reads scroll progress from the global provider.
 *
 * Parallax: each `[data-parallax]` element is offset on the Y-axis by a
 * factor of its section's scroll-relative position. Driven via a single
 * rAF loop that writes transforms to the DOM directly (no React renders).
 */
export default function Sections() {
  const rootRef = useRef<HTMLElement>(null);
  const { acts } = useReel();

  useEffect(() => {
    if (!rootRef.current) return;
    const root = rootRef.current;
    let raf = 0;

    const tick = () => {
      const wh = window.innerHeight;
      const elements = root.querySelectorAll<HTMLElement>('[data-parallax]');
      elements.forEach((el) => {
        const speed = parseFloat(el.dataset.parallax || '0.2');
        // Use the parallax element's OWN bounding rect against viewport
        // center. Works correctly whether the element is in a normal
        // section or inside a sticky container (long 200vh acts).
        // First clear our transform so we measure the resting position.
        const prev = el.style.transform;
        el.style.transform = '';
        const rect = el.getBoundingClientRect();
        el.style.transform = prev;
        const elCenter = rect.top + rect.height / 2;
        const viewCenter = wh / 2;
        const offset = (elCenter - viewCenter) / wh; // ~-1..1 across screen
        const ty = offset * speed * 100; // scale to px
        el.style.transform = `translate3d(0, ${ty.toFixed(2)}px, 0)`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <main ref={rootRef} className="relative z-10">
      {acts.map((a, i) => {
        const isHero = i === 0;
        const isCredits = i === acts.length - 1;
        const isCar = !isHero && !isCredits;
        const align = i % 2 === 0 ? 'items-start text-left' : 'items-end text-right';

        return (
          <section
            key={a.id}
            id={`act-${i}`}
            // 200vh per act gives the cars twice as much scroll runway,
            // so transitions are slow & cinematic instead of darting.
            // Hero + Credits stay 100vh so they don't feel padded.
            className={`relative w-full snap-start ${
              isHero || isCredits ? 'h-screen' : 'h-[200vh]'
            }`}
            data-act={i}
          >
            {/* Sticky inner so the caption stays in frame across the
                 doubled scroll distance, while the watermark + caption
                 still parallax against the section's center line. */}
            <div className={`${isHero || isCredits ? '' : 'sticky top-0 h-screen'} relative w-full`}>
            {/* Caption block — gentle parallax (slower than scroll) */}
            <div
              data-parallax="-0.18"
              className={`absolute inset-0 flex ${align} justify-end flex-col px-6 md:px-16 pb-[12vh] pt-[12vh] will-change-transform`}
            >
              {isHero && (
                <div className="max-w-5xl">
                  <div className="smallcaps text-bone/60 mb-4 flex items-center gap-3">
                    <span className="inline-block w-10 h-px bg-ember" />
                    A film by OFF TRACKS — Reel 07
                  </div>
                  <h1 className="display text-bone text-[clamp(3.5rem,12vw,11rem)]">
                    OFF<em>TRACKS</em>
                  </h1>
                  <p className="display italic text-bone/80 text-[clamp(1.4rem,2.6vw,2.4rem)] mt-2 max-w-3xl">
                    {a.subtitle}
                  </p>
                  <p className="mt-6 max-w-xl text-bone/70 leading-relaxed">
                    {a.body}
                  </p>
                  <div className="mt-10 flex flex-wrap gap-3">
                    <a href="#act-1" className="btn-ghost">Enter the reel ↓</a>
                    <a href="#access" className="btn-ghost">Request access</a>
                  </div>
                </div>
              )}

              {isCar && (
                <div className="max-w-xl">
                  <div className="smallcaps text-ember mb-3 font-mono">{a.bodyTop}</div>
                  <h2 className="display text-bone text-[clamp(2.2rem,7vw,5.5rem)]">
                    {a.title}
                  </h2>
                  <p className="display italic text-bone/70 text-xl md:text-2xl mt-1">
                    {a.subtitle}
                  </p>
                  <p className="mt-5 text-bone/75 leading-relaxed text-base md:text-lg">
                    {a.body}
                  </p>
                  <dl className={`mt-8 grid grid-cols-3 gap-4 max-w-md ${i % 2 === 0 ? '' : 'ml-auto'}`}>
                    {a.meta.map((m) => (
                      <div key={m.label}>
                        <dt className="smallcaps text-bone/40 font-mono">{m.label}</dt>
                        <dd className="text-bone text-sm md:text-base mt-1">{m.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {isCredits && (
                <div id="access" className="max-w-3xl mx-auto text-center self-center w-full">
                  <div className="smallcaps text-bone/60 mb-3">Fin.</div>
                  <h2 className="display text-bone text-[clamp(3rem,9vw,8rem)]">
                    End of <em>reel.</em>
                  </h2>
                  <p className="display italic text-bone/70 text-xl md:text-2xl mt-2">
                    {a.subtitle}
                  </p>
                  <p className="mt-6 text-bone/70 max-w-xl mx-auto">{a.body}</p>
                  <form
                    className="mt-10 flex flex-col md:flex-row items-center gap-3 max-w-xl mx-auto"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = e.currentTarget as HTMLFormElement;
                      const btn = f.querySelector('button') as HTMLButtonElement | null;
                      if (btn) btn.innerText = 'Reel reserved ✦';
                    }}
                  >
                    <input
                      type="email"
                      required
                      placeholder="your@inbox.com"
                      className="flex-1 bg-transparent border border-bone/30 rounded-full px-5 py-3 text-bone placeholder-bone/40 focus:outline-none focus:border-ember"
                    />
                    <button type="submit" className="btn-ghost !bg-ember !text-ink !border-ember hover:!bg-bone hover:!border-bone">
                      Request next reel →
                    </button>
                  </form>
                  <div className="mt-12 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
                    {a.meta.map((m) => (
                      <div key={m.label}>
                        <dt className="smallcaps text-bone/40 font-mono">{m.label}</dt>
                        <dd className="text-bone text-sm md:text-base mt-1">{m.value}</dd>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Subtle act number watermark — strong parallax (faster) */}
            {!isHero && !isCredits && (
              <div
                data-parallax="0.55"
                className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 display text-bone/[0.03] text-[40vw] font-bold leading-none select-none will-change-transform"
              >
                {String(i).padStart(2, '0')}
              </div>
            )}
            </div>
          </section>
        );
      })}

      {/* Footer ribbon */}
      <div id="story" className="relative z-10">
        <Marquee text="OFF TRACKS · CURATED RARE TRACKS · REEL 07 · 2025 · DIRECTED IN 70MM" />
      </div>
      <footer className="relative z-10 px-6 md:px-10 py-10 text-bone/50 smallcaps flex flex-col md:flex-row items-center justify-between gap-4 border-t border-white/10">
        <div>© {new Date().getFullYear()} OFF TRACKS Studio</div>
        <div className="font-mono">Cinematography · Cars · Cult Objects</div>
        <div>Made for collectors · Built for speed</div>
      </footer>
    </main>
  );
}
