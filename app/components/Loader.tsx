'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { CARS } from '../lib/cars';

/**
 * Loader — black card with a small F1 car canvas that drives left → right
 * across the screen as progress fills. The percent number sits behind it.
 *
 *  - Tiny canvas (300 x 220) translated by progress so the wheels never
 *    get clipped by the canvas edges.
 *  - Side-profile camera so it reads as a car driving past, not a
 *    rear-three-quarter shot.
 *  - All car GLBs preload at module-parse so the showcase is hot when
 *    the loader fades.
 */

const HERO_MODEL = '/models/formula_1_generico_2.glb';

useGLTF.preload(HERO_MODEL);
CARS.forEach((c) => useGLTF.preload(c.model));

function LoaderCar({ onReady }: { onReady?: () => void }) {
  const { scene } = useGLTF(HERO_MODEL);
  const ref = useRef<THREE.Group>(null);
  const fitRef = useRef<{
    cx: number;
    cy: number;
    cz: number;
    s: number;
  } | null>(null);

  if (!fitRef.current) {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    // Fit the longest horizontal dimension into ~2 world units so the
    // car comfortably fills the small canvas.
    const targetW = 2.0;
    const longest = Math.max(size.x, size.z) || 1;
    const s = targetW / longest;
    fitRef.current = { cx: center.x, cy: center.y, cz: center.z, s };
    scene.traverse((o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (mesh.isMesh && mat && 'envMapIntensity' in mat) {
        mat.envMapIntensity = 1.4;
      }
    });
  }

  useFrame(() => {
    if (!ref.current) return;
    // Subtle bob/tilt to feel "alive" — but model stays in side profile.
    const t = performance.now();
    ref.current.position.y =
      -fitRef.current!.cy * fitRef.current!.s - 0.05 +
      Math.sin(t * 0.006) * 0.015;
    ref.current.rotation.z = Math.sin(t * 0.004) * 0.015;
  });

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  const f = fitRef.current!;
  return (
    <group
      ref={ref}
      // Side profile facing right (-Z toward the camera + rotated -90° around Y
      // so the long axis is horizontal in screen space).
      rotation={[0, -Math.PI / 2, 0]}
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
  // re-rendering the whole loader on every progress tick).
  useEffect(() => {
    if (!carWrapRef.current) return;
    const t = Math.min(1, Math.max(0, progress / 100));
    // 0% → far-left edge, 100% → far-right edge.
    // Using calc so the car-box stays fully on-screen at both ends.
    carWrapRef.current.style.left = `calc(${t * 100}vw - ${t * 320}px)`;
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
      {/* Big percentage that lives BEHIND the car */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
        aria-hidden
      >
        <div
          className="display text-bone/[0.08] leading-none tracking-tighter font-bold"
          style={{ fontSize: 'min(48vw, 48vh)' }}
        >
          {String(pct).padStart(3, '0')}
        </div>
      </div>

      {/* Small F1 canvas — translated left → right by `left` style above.
          Sits on a horizontal "track" line for context. */}
      <div
        ref={carWrapRef}
        className="absolute will-change-transform"
        style={{
          top: '50%',
          left: '0px',
          width: '320px',
          height: '220px',
          transform: 'translateY(-50%)',
          opacity: carReady ? 1 : 0,
          transition: 'opacity 0.7s ease, left 0.18s linear',
        }}
      >
        <Canvas
          camera={{ position: [0, 0.45, 3.6], fov: 28, near: 0.1, far: 30 }}
          gl={{ alpha: true, antialias: true }}
          dpr={[1, 1.5]}
          style={{ background: 'transparent' }}
        >
          <ambientLight intensity={0.55} />
          <directionalLight position={[3, 4, 4]} intensity={2.2} color="#ffe8c2" />
          <directionalLight position={[-4, 2, -2]} intensity={1.4} color="#7dd3fc" />
          <pointLight position={[0, -1, 2]} intensity={1.0} color="#ff3b1f" />
          <Suspense fallback={null}>
            <Environment preset="warehouse" environmentIntensity={0.55} />
            <LoaderCar onReady={() => setCarReady(true)} />
          </Suspense>
        </Canvas>
      </div>

      {/* Thin track line under the car for "driving" reference. */}
      <div
        className="pointer-events-none absolute left-0 right-0 z-0"
        style={{
          top: 'calc(50% + 80px)',
          height: '1px',
          background:
            'linear-gradient(90deg, transparent, rgba(255,59,31,0.35) 20%, rgba(255,59,31,0.35) 80%, transparent)',
        }}
        aria-hidden
      />

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
