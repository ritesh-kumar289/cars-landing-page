'use client';

import { ACTS, TOTAL_ACTS } from '../lib/cars';
import Marquee from './Marquee';

/**
 * Sections — invisible spacers that drive scroll length, plus visible captions
 * for each act. The 3D scene reads scroll progress from the global provider.
 */
export default function Sections() {
  return (
    <main className="relative z-10">
      {ACTS.map((a, i) => {
        const isHero = i === 0;
        const isCredits = i === TOTAL_ACTS - 1;
        const isCar = !isHero && !isCredits;
        const align = i % 2 === 0 ? 'items-start text-left' : 'items-end text-right';

        return (
          <section
            key={a.id}
            id={`act-${i}`}
            className="relative h-screen w-full snap-start"
            data-act={i}
          >
            {/* Caption block */}
            <div className={`absolute inset-0 flex ${align} justify-end flex-col px-6 md:px-16 pb-[12vh] pt-[12vh]`}>
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

            {/* Subtle act number watermark */}
            {!isHero && !isCredits && (
              <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 display text-bone/[0.03] text-[40vw] font-bold leading-none select-none">
                {String(i).padStart(2, '0')}
              </div>
            )}
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
