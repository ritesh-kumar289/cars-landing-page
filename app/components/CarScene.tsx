'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  useGLTF,
  Float,
  PerformanceMonitor,
} from '@react-three/drei';
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  DepthOfField,
  Noise,
  Vignette,
  ToneMapping,
} from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { CARS } from '../lib/cars';
import { useScrollProgress } from '../lib/scroll';

const CA_OFFSET = new THREE.Vector2(0.0009, 0.0014);

/** Idle rotation speed for car models (radians per second). */
const IDLE_ROTATION_SPEED = 0.08;
/** Visibility window size (in act-progress units) for the first car's left
 *  extension into the hero section. Wider so W13 is partially visible at p=0
 *  without shifting its peak away from its own act (p=1). */
const W13_LEFT_WINDOW_SIZE = 1.5;
/** Symmetric visibility window for all other cars (±0.75 around their act). */
const DEFAULT_WINDOW_SIZE = 0.75;

/** Smoothly interpolate a value with critical damping. */
function damp(current: number, target: number, lambda: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/** Smoothstep helper */
function smooth(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function CarModel({
  url,
  scale,
  yOffset,
  rotationY,
  visible,
}: {
  url: string;
  scale: number;
  yOffset: number;
  rotationY: number;
  visible: number; // 0..1 fade
}) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const ref = useRef<THREE.Group>(null);

  // Auto-fit: compute bounding box and normalize to unit height ~ 1.6
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const targetHeight = 1.6;
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const fitScale = targetHeight / maxDim;
    return { center, fitScale };
  }, [cloned]);

  // Apply realistic material tweaks
  useMemo(() => {
    cloned.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material) {
          // Slightly bump envMapIntensity for cinematic look
          if ('envMapIntensity' in o.material) {
            o.material.envMapIntensity = 1.4;
          }
          o.material.needsUpdate = true;
        }
      }
    });
  }, [cloned]);

  // Subtle idle rotation
  useFrame((state, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * IDLE_ROTATION_SPEED;
    // Smooth visibility fade via scale
    const target = visible;
    ref.current.userData.v = damp(ref.current.userData.v ?? 0, target, 6, dt);
    const v = ref.current.userData.v;
    ref.current.scale.setScalar(scale * fit.fitScale * (0.6 + 0.4 * v));
    ref.current.visible = v > 0.02;
  });

  return (
    <group
      ref={ref}
      position={[-fit.center.x * scale * fit.fitScale, yOffset - fit.center.y * scale * fit.fitScale, -fit.center.z * scale * fit.fitScale]}
      rotation={[0, rotationY, 0]}
    >
      <primitive object={cloned} />
    </group>
  );
}

// Preload all GLB/GLTF models so transitions are instant
CARS.forEach((c) => useGLTF.preload(c.model));

function Stage({ groundColor }: { groundColor: string }) {
  return (
    <>
      {/* Ground catcher (large dark disc) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.7, 0]} receiveShadow>
        <circleGeometry args={[20, 64]} />
        <meshStandardMaterial color={groundColor} metalness={0.4} roughness={0.6} />
      </mesh>
      <ContactShadows
        position={[0, -0.69, 0]}
        opacity={0.7}
        scale={12}
        blur={2.5}
        far={4}
        resolution={1024}
        color="#000000"
      />
    </>
  );
}

function CinematicLights({
  rim,
  fill,
  intensity,
}: {
  rim: string;
  fill: string;
  intensity: number;
}) {
  return (
    <>
      <ambientLight intensity={0.18 * intensity} />
      {/* Key light (warm) */}
      <directionalLight
        position={[5, 6, 4]}
        intensity={2.4 * intensity}
        color="#ffe8c2"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Rim light (per-car palette) */}
      <directionalLight position={[-6, 4, -4]} intensity={3.0 * intensity} color={rim} />
      {/* Fill (low, colored) */}
      <pointLight position={[0, 1.2, 4]} intensity={1.4 * intensity} color={fill} distance={12} />
      {/* Ground bounce */}
      <pointLight position={[0, -0.3, 0]} intensity={0.6 * intensity} color={rim} distance={6} />
    </>
  );
}

/**
 * Director — drives the camera on a continuous spline based on scroll.
 * Acts:
 *   0           -> hero (slow orbit, far)
 *   1..N (cars) -> per-car beats (low/high/profile/3-quarter)
 *   N+1         -> credits (pull back, fade)
 */
function Director() {
  const { camera } = useThree();
  const { progress, total } = useScrollProgress();

  // Per-act camera "beats" (position, lookAt). The director interpolates between them.
  const beats = useMemo(() => {
    const carBeats = CARS.flatMap((_, i) => {
      // Two beats per car for variety: entrance and reveal
      const sign = i % 2 === 0 ? 1 : -1;
      return [
        { pos: new THREE.Vector3(3.6 * sign, 0.4, 3.4), look: new THREE.Vector3(0, 0.1, 0) }, // entrance: 3/4 low
        { pos: new THREE.Vector3(-2.4 * sign, 1.6, 2.2), look: new THREE.Vector3(0, 0, 0) }, // reveal: hero high
      ];
    });
    return [
      // Hero: distant, slow drift
      { pos: new THREE.Vector3(0, 0.9, 6.2), look: new THREE.Vector3(0, 0.2, 0) },
      ...carBeats,
      // Credits: pull back high
      { pos: new THREE.Vector3(0, 3.2, 8.0), look: new THREE.Vector3(0, 0, 0) },
    ];
  }, []);

  const lookAtTmp = useRef(new THREE.Vector3());
  const posTmp = useRef(new THREE.Vector3());

  useFrame((state, dt) => {
    const p = progress * (beats.length - 1);
    const i0 = Math.floor(p);
    const i1 = Math.min(beats.length - 1, i0 + 1);
    const t = p - i0;
    // smoothstep within segment for cinematic ease
    const ts = smooth(0, 1, t);

    posTmp.current.copy(beats[i0].pos).lerp(beats[i1].pos, ts);
    lookAtTmp.current.copy(beats[i0].look).lerp(beats[i1].look, ts);

    // Add subtle handheld camera shake
    const time = state.clock.elapsedTime;
    posTmp.current.x += Math.sin(time * 0.7) * 0.04;
    posTmp.current.y += Math.cos(time * 0.55) * 0.03;

    camera.position.x = damp(camera.position.x, posTmp.current.x, 4, dt);
    camera.position.y = damp(camera.position.y, posTmp.current.y, 4, dt);
    camera.position.z = damp(camera.position.z, posTmp.current.z, 4, dt);
    camera.lookAt(lookAtTmp.current);

    // Subtle FOV breathing per act
    const fovTarget = 32 + 6 * Math.sin(progress * Math.PI * 2);
    (camera as THREE.PerspectiveCamera).fov = damp(
      (camera as THREE.PerspectiveCamera).fov,
      fovTarget,
      2,
      dt,
    );
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  });

  // suppress unused-var lint
  void total;
  return null;
}

function ActiveCar() {
  const { progress } = useScrollProgress();
  // total acts = 1 (hero) + CARS.length + 1 (credits)
  const total = CARS.length + 2;
  const p = progress * (total - 1);

  return (
    <>
      {CARS.map((c, i) => {
        const center = i + 1; // hero is act 0, car[0] is act 1
        // Asymmetric visibility window:
        //   - Car[0] (W13): left window is 1.5 units wide so it shows during the
        //     hero screen (p=0) without shifting its peak from act center (p=1).
        //   - All other cars: symmetric ±0.75 window.
        const distToCenter = p - center;
        const windowSize = i === 0 && distToCenter < 0 ? W13_LEFT_WINDOW_SIZE : DEFAULT_WINDOW_SIZE;
        const v = Math.max(0, 1 - Math.abs(distToCenter) / windowSize);
        return (
          <group key={c.id} visible={v > 0.01}>
            <Float speed={0.8} rotationIntensity={0.05} floatIntensity={0.25}>
              <CarModel
                url={c.model}
                scale={c.scale}
                yOffset={c.yOffset}
                rotationY={c.rotationY}
                visible={v}
              />
            </Float>
            <CinematicLights rim={c.rim} fill={c.fill} intensity={v} />
          </group>
        );
      })}
    </>
  );
}

function ActiveStage() {
  const { progress } = useScrollProgress();
  const total = CARS.length + 2;
  const p = progress * (total - 1);
  const i = Math.max(0, Math.min(CARS.length - 1, Math.round(p) - 1));
  const c = CARS[i] ?? CARS[0];
  return <Stage groundColor={c.ground} />;
}

function Effects({ dpr }: { dpr: number }) {
  // Disable heavier effects on low-DPR / mobile
  const heavy = dpr >= 1.25;
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom
        intensity={0.9}
        luminanceThreshold={0.55}
        luminanceSmoothing={0.2}
        mipmapBlur
      />
      {heavy ? (
        <DepthOfField focusDistance={0.012} focalLength={0.04} bokehScale={3.2} />
      ) : (
        <></>
      )}
      <ChromaticAberration
        offset={CA_OFFSET}
        radialModulation={false}
        modulationOffset={0}
        blendFunction={BlendFunction.NORMAL}
      />
      <Noise opacity={0.06} blendFunction={BlendFunction.OVERLAY} />
      <Vignette eskil={false} offset={0.18} darkness={0.85} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

export default function CarScene() {
  const [dpr, setDpr] = useState(1.5);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(m.matches);
  }, []);

  return (
    <Canvas
      shadows
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      dpr={[1, dpr]}
      camera={{ position: [0, 1, 6], fov: 35, near: 0.1, far: 60 }}
      style={{ position: 'fixed', inset: 0, zIndex: 0 }}
    >
      <PerformanceMonitor
        onIncline={() => setDpr(Math.min(2, dpr + 0.25))}
        onDecline={() => setDpr(Math.max(1, dpr - 0.25))}
      />
      <color attach="background" args={['#050505']} />
      <fog attach="fog" args={['#050505', 8, 22]} />

      {/* Environment in its own Suspense — the external HDR fetch from the
          drei CDN must NOT block model rendering. If polyhaven/rawgithack is
          slow or unreachable, models still render immediately with direct
          lights only. */}
      <Suspense fallback={null}>
        <Environment preset="warehouse" environmentIntensity={0.55} />
      </Suspense>

      {/* Always-on ambient fill — lights outside Suspense render immediately */}
      <ambientLight intensity={0.12} color="#7dd3fc" />

      {/* Model scene — has its own Suspense so GLB loading is independent */}
      <Suspense fallback={null}>
        <ActiveStage />
        <ActiveCar />
        <Director />
        {!reduced && <Effects dpr={dpr} />}
      </Suspense>
    </Canvas>
  );
}
