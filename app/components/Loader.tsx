'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { CARS } from '../lib/cars';

/**
 * Loader — clean, full-screen black card with the F1 3D model driving
 * across the screen left → right. The loading percentage sits behind
 * it so it reads like a number being "driven past" by the car.
 *
 *  - No SVG silhouette, no vignette/background overlays.
 *  - All car GLBs are preloaded at module-parse time, so the showcase
 *    is ready as soon as the loader fades.
 *  - Progress comes from `THREE.DefaultLoadingManager`, with a slow
 *    ambient ramp + 14 s safety cap so the bar never sits stuck.
 */

const HERO_MODEL = '/models/formula_1_generico_2.glb';

useGLTF.preload(HERO_MODEL);
CARS.forEach((c) => useGLTF.preload(c.model));

function LoaderCar({ onReady }: { onReady?: () => void }) {
  const { scene } = useGLTF(HERO_MODEL);
  const ref = useRef<THREE.Group>(null);
  const fitRef = useRef<{ cx: number; cy: number; cz: number; s: number } | null>(null);

  if (!fitRef.current) {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const targetH = 1.4;
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = targetH / maxDim;
    fitRef.current = { cx: center.x, cy: center.y, cz: center.z, s };
    scene.traverse((o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (mesh.isMesh && mat && 'envMapIntensity' in mat) {
        mat.envMapIntensity = 1.6;
      }
    });
  }

  // gentle bob + a touch of forward lean as it "drives"
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y = -Math.PI / 2 + Math.sin(performance.now() * 0.0015) * 0.06;
    ref.current.position.y =
      -fitRef.current!.cy * fitRef.current!.s -
      0.05 +
      Math.sin(performance.now() * 0.006) * 0.02;
    ref.current.rotation.z = Math.sin(performance.now() * 0.005) * 0.02;
    void dt;
  });

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  const f = fitRef.current!;
  return (
    <group
      ref={ref}
      position={[-f.cx * f.s, -f.cy * f.s - 0.05, -f.cz * f.s]}
      scale={f.s}
    >
      <primitive object={scene} />
    </group>
  );
}

export default function Loader() {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [hide, setHide] = useState(false);
  const [carReady, setCarReady] = useState(false);
  const carWrapRef = useRef<HTMLDivElement | null>(null);

  // Drive the car wrapper position from progress via the DOM (avoids
  // re-rendering the whole loader at 60 fps).
  useEffect(() => {
    if (!carWrapRef.current) return;
    // Map 0..100 → -42vw..+42vw
    const t = Math.min(1, Math.max(0, progress / 100));
    carWrapRef.current.style.transform = `translateX(${(t - 0.5) * 84}vw)`;
  }, [progress]);

  useEffect(() => {
    const mgr = THREE.DefaultLoadingManager;
    const onProgress = (_: string, loaded: number, total: number) => {
      const pct = Math.min(99, (loaded / Math.max(1, total)) * 100);
      setProgress((p) => Math.max(p, pct));
    };
    const onLoad = () => {
      setProgress(100);
      setTimeout(() => setDone(true), 500);
    };
    const onError = () => {
      setProgress((p) => Math.min(99, p + 4));
    };
    mgr.onProgress = onProgress;
    mgr.onLoad = onLoad;
    mgr.onError = onError;

    let raf = 0;
    const tick = () => {
      setProgress((p) => (p < 92 ? p + (92 - p) * 0.008 : p));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const hardTimeout = setTimeout(() => {
      setProgress(100);
      setDone(true);
    }, 14000);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(hardTimeout);
      mgr.onProgress = () => undefined;
      mgr.onLoad = () => undefined;
      mgr.onError = () => undefined;
    };
  }, []);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setHide(true), 900);
    return () => clearTimeout(t);
  }, [done]);

  if (hide) return null;

  const pct = Math.floor(progress);

  return (
    <div
      className="fixed inset-0 z-[150] bg-ink overflow-hidden transition-opacity duration-700"
      style={{ opacity: done ? 0 : 1, pointerEvents: done ? 'none' : 'auto' }}
    >
      {/* HUGE percentage that lives BEHIND the car */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
        aria-hidden
      >
        <div
          className="display text-bone/10 leading-none tracking-tighter font-bold"
          style={{
            fontSize: 'min(56vw, 56vh)',
            transition: 'opacity 0.3s ease',
          }}
        >
          {String(pct).padStart(3, '0')}
        </div>
      </div>

      {/* The F1 — translated left → right by progress, in front of % */}
      <div
        ref={carWrapRef}
        className="absolute inset-0 will-change-transform"
        style={{
          transform: 'translateX(-42vw)',
          transition: 'transform 0.25s linear',
          opacity: carReady ? 1 : 0,
          transitionProperty: 'transform, opacity',
          transitionDuration: '0.25s, 0.7s',
        }}
      >
        <Canvas
          camera={{ position: [0, 0.6, 3.4], fov: 30, near: 0.1, far: 30 }}
          gl={{ alpha: true, antialias: true }}
          dpr={[1, 1.5]}
          style={{ background: 'transparent' }}
        >
          <ambientLight intensity={0.45} />
          <directionalLight position={[3, 4, 2]} intensity={2.4} color="#ffe8c2" />
          <directionalLight position={[-4, 2, -2]} intensity={1.6} color="#7dd3fc" />
          <pointLight position={[0, -1, 2]} intensity={1.2} color="#ff3b1f" />
          <Suspense fallback={null}>
            <Environment preset="warehouse" environmentIntensity={0.6} />
            <LoaderCar onReady={() => setCarReady(true)} />
          </Suspense>
        </Canvas>
      </div>

      {/* Brand mark + thin progress line, anchored to bottom */}
      <div className="absolute inset-x-0 bottom-[12vh] flex flex-col items-center gap-4">
        <div className="display text-bone text-3xl md:text-5xl animate-flicker">
          OFF<em>TRACKS</em>
        </div>
        <div className="w-64 md:w-96 h-px bg-white/15 relative overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-ember"
            style={{ width: `${progress}%`, transition: 'width 0.18s linear' }}
          />
        </div>
        <div className="smallcaps text-bone/40 font-mono">
          {String(pct).padStart(3, '0')} / 100 · ASSETS
        </div>
      </div>
    </div>
  );
}
