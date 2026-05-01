'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  type Act,
  type Car,
  type Reel,
  type ReelId,
  REELS,
  getActsForReel,
  getCarsForReel,
  isReelReady,
} from './cars';

type Ctx = {
  activeReel: ReelId;
  setActiveReel: (id: ReelId) => void;
  reels: Reel[];
  cars: Car[];
  acts: Act[];
};

const ReelCtx = createContext<Ctx | null>(null);

export function useReel(): Ctx {
  const ctx = useContext(ReelCtx);
  if (!ctx) throw new Error('useReel must be used inside <ReelProvider>');
  return ctx;
}

export default function ReelProvider({
  defaultReel,
  children,
}: {
  defaultReel: ReelId;
  children: React.ReactNode;
}) {
  // Pick the user-requested default if it has cars; otherwise fall back
  // to the first ready reel, then to the first reel overall.
  const initial = useMemo<ReelId>(() => {
    if (getCarsForReel(defaultReel).length > 0) return defaultReel;
    const ready = REELS.find((r) => isReelReady(r.id));
    return (ready ?? REELS[0]).id;
  }, [defaultReel]);

  const [activeReel, setActiveReelState] = useState<ReelId>(initial);

  const setActiveReel = useCallback((id: ReelId) => {
    setActiveReelState((prev) => {
      if (prev === id) return prev;
      // Reset scroll on reel change so scrubbed progress doesn't jump
      // into a different car list.
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
      return id;
    });
  }, []);

  const cars = useMemo(() => getCarsForReel(activeReel), [activeReel]);
  const acts = useMemo(() => getActsForReel(activeReel), [activeReel]);

  const value = useMemo<Ctx>(
    () => ({ activeReel, setActiveReel, reels: REELS, cars, acts }),
    [activeReel, setActiveReel, cars, acts],
  );

  return <ReelCtx.Provider value={value}>{children}</ReelCtx.Provider>;
}
