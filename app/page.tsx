'use client';

import dynamic from 'next/dynamic';
import { TOTAL_ACTS } from './lib/cars';
import ScrollProvider from './lib/scroll';
import HUD from './components/HUD';
import Sections from './components/Sections';
import Loader from './components/Loader';
import CustomCursor from './components/CustomCursor';
import SceneErrorBoundary from './components/SceneErrorBoundary';
import CarsAudio from './components/CarsAudio';

// 3D scene must be client-side only (uses WebGL/Three)
const CarScene = dynamic(() => import('./components/CarScene'), {
  ssr: false,
  loading: () => null,
});

export default function Page() {
  return (
    <ScrollProvider total={TOTAL_ACTS}>
      <Loader />
      <CustomCursor />
      <SceneErrorBoundary>
        <CarScene />
      </SceneErrorBoundary>
      <HUD />
      <Sections />
      <CarsAudio />
    </ScrollProvider>
  );
}
