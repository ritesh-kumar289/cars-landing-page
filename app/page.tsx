'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import ScrollProvider from './lib/scroll';
import ReelProvider, { useReel } from './lib/reel';
import HUD from './components/HUD';
import Sections from './components/Sections';
import Loader from './components/Loader';
import CustomCursor from './components/CustomCursor';
import SceneErrorBoundary from './components/SceneErrorBoundary';
import CarsAudio from './components/CarsAudio';
import ReelTabs from './components/ReelTabs';
import ReelEmpty from './components/ReelEmpty';

// 3D scene must be client-side only (uses WebGL/Three). Lazy import so
// each reel switch doesn't pay the full Three bundle cost upfront.
const CarScene = dynamic(() => import('./components/CarScene'), {
  ssr: false,
  loading: () => null,
});

function ReelStage() {
  const { activeReel, acts, cars } = useReel();
  return (
    <ScrollProvider key={activeReel} total={Math.max(2, acts.length)}>
      <Loader key={activeReel} />
      {cars.length > 0 ? (
        <SceneErrorBoundary>
          <Suspense fallback={null}>
            <CarScene key={activeReel} />
          </Suspense>
        </SceneErrorBoundary>
      ) : null}
      <HUD />
      <Sections />
      <ReelEmpty />
      <CarsAudio />
    </ScrollProvider>
  );
}

export default function Page() {
  return (
    <ReelProvider defaultReel="jdm">
      <CustomCursor />
      <ReelTabs />
      <ReelStage />
    </ReelProvider>
  );
}
