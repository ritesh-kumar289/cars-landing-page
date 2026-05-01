'use client';

import { useReel } from '../lib/reel';
import { REEL_MIN_CARS } from '../lib/cars';

/**
 * ReelEmpty — overlay shown when the active reel has fewer than
 * REEL_MIN_CARS. Tells the user the reel is being assembled. Hidden
 * automatically when enough cars are in place.
 */
export default function ReelEmpty() {
  const { activeReel, reels, cars } = useReel();
  const reel = reels.find((r) => r.id === activeReel);
  if (!reel) return null;
  const need = REEL_MIN_CARS - cars.length;
  if (need <= 0) return null;

  return (
    <div className="fixed inset-0 z-[40] pointer-events-none flex items-center justify-center">
      <div className="pointer-events-auto max-w-xl mx-6 text-center bg-ink/70 backdrop-blur-md border border-bone/15 rounded-2xl px-8 py-10">
        <div className="smallcaps text-ember font-mono text-xs">{reel.name}</div>
        <h2 className="display text-bone text-3xl md:text-4xl mt-3">
          Reel in production.
        </h2>
        <p className="mt-4 text-bone/70 leading-relaxed">
          {reel.tagline} This collection currently has{' '}
          <strong className="text-bone">{cars.length}</strong>{' '}
          {cars.length === 1 ? 'car' : 'cars'} on file. We screen reels at{' '}
          <strong className="text-bone">{REEL_MIN_CARS}</strong> minimum — so we&rsquo;re
          still scouting <strong className="text-ember">{need}</strong> more.
        </p>
        <p className="mt-3 text-bone/50 text-sm">
          Switch tabs above to view a finished reel.
        </p>
      </div>
    </div>
  );
}
