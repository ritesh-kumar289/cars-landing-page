'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Loader — cinematic title card with a live, spinning 3D F1 model.
 * Progress is driven by THREE.DefaultLoadingManager so the bar reflects
 * the actual download state of every GLB / texture used by the main scene.
 * Falls back to a hard 12 s timeout so the experience always unlocks.
 */

const HERO_MODEL = '/models/f1_mercedes_w13_concept.glb';

useGLTF.preload(HERO_MODEL);

function LoaderCar() {
  const { scene } = useGLTF(HERO_MODEL);
  const ref = useRef<THREE.Group>(null);
  const fitRef = useRef<{ cx: number; cy: number; cz: number; s: number } | null>(null);

  if (!fitRef.current) {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const targetH = 1.3;
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

  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.85;
    ref.current.rotation.x = Math.sin(performance.now() * 0.0008) * 0.06;
  });

  const f = fitRef.current!;
  return (
    <group
      ref={ref}
      position={[-f.cx * f.s, -f.cy * f.s - 0.15, -f.cz * f.s]}
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

  useEffect(() => {
    const mgr = THREE.DefaultLoadingManager;
    const onProgress = (_: string, loaded: number, total: number) => {
      const pct = Math.min(99, (loaded / Math.max(1, total)) * 100);
      setProgress((p) => Math.max(p, pct));
    };
    const onLoad = () => {
      setProgress(100);
      setTimeout(() => setDone(true), 450);
    };
    const onError = () => {
      setProgress((p) => Math.min(99, p + 4));
    };
    mgr.onProgress = onProgress;
    mgr.onLoad = onLoad;
    mgr.onError = onError;

    // Slow ambient ramp so the bar never sits stuck.
    let raf = 0;
    const tick = () => {
      setProgress((p) => (p < 90 ? p + (90 - p) * 0.006 : p));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Hard cap so the loader always resolves.
    const hardTimeout = setTimeout(() => {
      setProgress(100);
      setDone(true);
    }, 12000);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(hardTimeout);
      mgr.onProgress = () => undefined;
      mgr.onLoad = () => undefined;
      mgr.onError = () => undefined;
    };
  }, []);

  // Unmount fully after fade so we stop holding a Canvas instance.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setHide(true), 900);
    return () => clearTimeout(t);
  }, [done]);

  if (hide) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-ink transition-opacity duration-700"
      style={{ opacity: done ? 0 : 1, pointerEvents: done ? 'none' : 'auto' }}
    >
      <div className="relative w-[min(78vw,560px)] h-[min(42vh,320px)]">
        <Canvas
          camera={{ position: [2.6, 1.2, 3.4], fov: 28, near: 0.1, far: 30 }}
          gl={{ alpha: true, antialias: true }}
          dpr={[1, 1.6]}
        >
          <color attach="background" args={['#050505']} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[3, 4, 2]} intensity={2.4} color="#ffe8c2" />
          <directionalLight position={[-4, 2, -2]} intensity={1.6} color="#7dd3fc" />
          <pointLight position={[0, -1, 2]} intensity={1.2} color="#ff3b1f" />
          <Suspense fallback={null}>
            <Environment preset="warehouse" environmentIntensity={0.6} />
            <LoaderCar />
          </Suspense>
        </Canvas>
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(closest-side, transparent 55%, rgba(0,0,0,0.65) 100%)',
          }}
        />
      </div>

      <div className="smallcaps text-bone/60 mt-2 mb-3">Loading reel</div>
      <div className="display text-bone text-5xl md:text-7xl mb-5 animate-flicker">
        OFF<em>TRACKS</em>
      </div>
      <div className="w-64 md:w-96 h-px bg-white/15 relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-ember"
          style={{ width: `${progress}%`, transition: 'width 0.18s linear' }}
        />
      </div>
      <div className="mt-3 smallcaps text-bone/40 font-mono">
        {progress.toFixed(0).padStart(3, '0')} / 100 · ASSETS
      </div>
    </div>
  );
}
