'use client';

import dynamic from 'next/dynamic';
import { TOTAL_ACTS } from './lib/cars';
import ScrollProvider from './lib/scroll';
import HUD from './components/HUD';
import Sections from './components/Sections';
import Loader from './components/Loader';
import CustomCursor from './components/CustomCursor';

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
      <CarScene />
      <HUD />
      <Sections />
    </ScrollProvider>
  );
}
