'use client';

import { useReel } from '../lib/reel';
import { getCarsForReel, isReelReady, REEL_MIN_CARS } from '../lib/cars';

/**
 * ReelTabs — fixed top header that lets the visitor switch between
 * curated reels (Formula 1, Hypercars, JDM, Muscle, Overland).
 *
 *  - Tabs that don't yet have REEL_MIN_CARS cars are shown as "Coming
 *    soon" with a lock indicator. Clicking still switches to them so
 *    the user can see the placeholder.
 *  - Active tab is underlined in ember.
 *  - Sits above the canvas (z-50) and respects the cursor styling used
 *    elsewhere (data-no-drag prevents the showroom turntable gesture
 *    from triggering when clicking tabs).
 */
export default function ReelTabs() {
  const { reels, activeReel, setActiveReel } = useReel();

  return (
    <header
      data-no-drag
      className="fixed top-0 left-0 right-0 z-[60] pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto flex flex-wrap items-center gap-1 md:gap-2 px-3 md:px-6 py-3 backdrop-blur-md bg-ink/40 border-b border-bone/10">
        <div className="smallcaps text-bone/70 mr-2 md:mr-4 font-mono text-xs md:text-sm select-none">
          Reels —
        </div>
        {reels.map((r) => {
          const count = getCarsForReel(r.id).length;
          const ready = isReelReady(r.id);
          const active = r.id === activeReel;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setActiveReel(r.id)}
              className={[
                'group relative px-2.5 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm transition-colors duration-200 select-none',
                active
                  ? 'text-bone bg-bone/10 border border-bone/30'
                  : 'text-bone/55 hover:text-bone border border-transparent hover:border-bone/20',
              ].join(' ')}
              aria-current={active ? 'true' : undefined}
              title={ready ? r.tagline : `Coming soon — needs ${REEL_MIN_CARS - count} more car${REEL_MIN_CARS - count === 1 ? '' : 's'}`}
            >
              <span className="font-mono tracking-wide">{r.name}</span>
              <span className="ml-1.5 text-[10px] md:text-xs text-bone/40 align-middle">
                {ready ? `· ${count}` : '· soon'}
              </span>
              {active && (
                <span className="absolute -bottom-1 left-3 right-3 h-px bg-ember" />
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
}
