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
  Scanline,
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
const W13_LEFT_WINDOW_SIZE = 1.6;
/** Symmetric visibility window for all other cars. Wider than 1.0 means cars
 *  overlap during transitions, producing a true crossfade instead of a pop. */
const DEFAULT_WINDOW_SIZE = 1.15;

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
  signedDist,
}: {
  url: string;
  scale: number;
  yOffset: number;
  rotationY: number;
  visible: number; // 0..1 fade
  signedDist: number; // -1..1 — where this car sits in the transition
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

  // Subtle idle rotation + cinematic crossfade slide
  useFrame((state, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * IDLE_ROTATION_SPEED;
    // Smooth visibility fade via scale (critically damped)
    const target = visible;
    ref.current.userData.v = damp(ref.current.userData.v ?? 0, target, 4, dt);
    const v = ref.current.userData.v;
    // Gentler scale curve so cars never pop into existence
    ref.current.scale.setScalar(scale * fit.fitScale * (0.78 + 0.22 * v));
    ref.current.visible = v > 0.005;

    // Slide cars horizontally as they enter/leave so transitions feel
    // like a physical dolly-by instead of a fade. signedDist is
    // negative when the car is the previous one, positive when next.
    // Also fade Y when far from center for a graceful exit.
    const slide = signedDist; // -1..+1 across the visibility window
    const slideX = slide * 4.5 * (1 - v); // far when faded, centered when visible
    const lift = (1 - v) * 0.25 * Math.sign(slide || 1);
    ref.current.userData.tx = damp(ref.current.userData.tx ?? slideX, slideX, 5, dt);
    ref.current.userData.ty = damp(ref.current.userData.ty ?? lift, lift, 5, dt);
    ref.current.position.x = -fit.center.x * scale * fit.fitScale + ref.current.userData.tx;
    ref.current.position.y = yOffset - fit.center.y * scale * fit.fitScale + ref.current.userData.ty;
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

  // Per-act camera "beats" (position, lookAt). Three beats per car (in/hero/out)
  // give us long, sweeping transitions instead of short pops.
  const beats = useMemo(() => {
    const carBeats = CARS.flatMap((_, i) => {
      const sign = i % 2 === 0 ? 1 : -1;
      return [
        // Entrance: wide 3/4 low, far away
        { pos: new THREE.Vector3(5.2 * sign, 0.5, 4.4), look: new THREE.Vector3(0.6 * sign, 0.1, 0) },
        // Hero: closer side profile
        { pos: new THREE.Vector3(-2.6 * sign, 1.4, 2.6), look: new THREE.Vector3(0, 0.1, 0) },
        // Exit: dolly past, low and tight — sets up the next car's entrance
        { pos: new THREE.Vector3(-5.2 * sign, 0.6, 3.6), look: new THREE.Vector3(-0.4 * sign, 0.0, 0) },
      ];
    });
    return [
      // Hero: distant, slow drift
      { pos: new THREE.Vector3(0, 1.1, 6.6), look: new THREE.Vector3(0, 0.3, 0) },
      ...carBeats,
      // Credits: pull back high
      { pos: new THREE.Vector3(0, 3.4, 8.4), look: new THREE.Vector3(0, 0, 0) },
    ];
  }, []);

  const lookAtTmp = useRef(new THREE.Vector3());
  const posTmp = useRef(new THREE.Vector3());
  const lookAtCurrent = useRef(new THREE.Vector3());

  useFrame((state, dt) => {
    // Catmull–Rom-style 4-point cubic interp for buttery camera path
    const p = progress * (beats.length - 1);
    const i1 = Math.floor(p);
    const i2 = Math.min(beats.length - 1, i1 + 1);
    const i0 = Math.max(0, i1 - 1);
    const i3 = Math.min(beats.length - 1, i2 + 1);
    const t = p - i1;
    // Smootherstep ease for cinematic ramp
    const ts = t * t * t * (t * (t * 6 - 15) + 10);

    catmullRom(
      beats[i0].pos, beats[i1].pos, beats[i2].pos, beats[i3].pos, ts, posTmp.current,
    );
    catmullRom(
      beats[i0].look, beats[i1].look, beats[i2].look, beats[i3].look, ts, lookAtTmp.current,
    );

    // Add subtle handheld camera shake
    const time = state.clock.elapsedTime;
    posTmp.current.x += Math.sin(time * 0.7) * 0.03;
    posTmp.current.y += Math.cos(time * 0.55) * 0.02;

    // Interactive mouse parallax — cursor pushes the camera around the subject
    const mx = state.pointer.x;
    const my = state.pointer.y;
    posTmp.current.x += mx * 0.7;
    posTmp.current.y += my * 0.35;
    lookAtTmp.current.x += mx * 0.12;
    lookAtTmp.current.y += my * 0.06;

    // Slower damping so the camera glides rather than snaps
    const lambda = 2.6;
    camera.position.x = damp(camera.position.x, posTmp.current.x, lambda, dt);
    camera.position.y = damp(camera.position.y, posTmp.current.y, lambda, dt);
    camera.position.z = damp(camera.position.z, posTmp.current.z, lambda, dt);
    // Smooth the lookAt target itself — prevents jitter at segment joins
    lookAtCurrent.current.x = damp(lookAtCurrent.current.x, lookAtTmp.current.x, lambda, dt);
    lookAtCurrent.current.y = damp(lookAtCurrent.current.y, lookAtTmp.current.y, lambda, dt);
    lookAtCurrent.current.z = damp(lookAtCurrent.current.z, lookAtTmp.current.z, lambda, dt);
    camera.lookAt(lookAtCurrent.current);

    // FOV: gently zoom in mid-transition for a dolly-zoom feel
    const segT = Math.abs(t - 0.5) * 2; // 1 at beat, 0 at midpoint
    const fovTarget = 30 + 8 * (1 - segT) + 4 * Math.sin(progress * Math.PI * 2);
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

/** Catmull–Rom interpolation between p1 and p2 using p0 and p3 as tangents. */
function catmullRom(
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  p3: THREE.Vector3,
  t: number,
  out: THREE.Vector3,
) {
  const t2 = t * t;
  const t3 = t2 * t;
  out.x = 0.5 * (
    2 * p1.x +
    (-p0.x + p2.x) * t +
    (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
    (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
  );
  out.y = 0.5 * (
    2 * p1.y +
    (-p0.y + p2.y) * t +
    (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
    (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
  );
  out.z = 0.5 * (
    2 * p1.z +
    (-p0.z + p2.z) * t +
    (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
    (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3
  );
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
        const distToCenter = p - center;
        const windowSize = i === 0 && distToCenter < 0 ? W13_LEFT_WINDOW_SIZE : DEFAULT_WINDOW_SIZE;
        // Smoothstep curve gives a soft S-curve fade instead of linear ramps,
        // and the wider window makes adjacent cars overlap (true crossfade).
        const x = Math.min(1, Math.abs(distToCenter) / windowSize);
        const v = 1 - x * x * (3 - 2 * x);
        const signed = Math.max(-1, Math.min(1, distToCenter / windowSize));
        return (
          <group key={c.id} visible={v > 0.005}>
            <Float speed={0.8} rotationIntensity={0.05} floatIntensity={0.25}>
              <CarModel
                url={c.model}
                scale={c.scale}
                yOffset={c.yOffset}
                rotationY={c.rotationY}
                visible={v}
                signedDist={signed}
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
  // Smoothly blend ground color across the active and neighbour acts.
  const i0 = Math.max(0, Math.min(CARS.length - 1, Math.floor(p) - 1));
  const i1 = Math.max(0, Math.min(CARS.length - 1, i0 + 1));
  const t = Math.max(0, Math.min(1, p - 1 - i0));
  const ts = t * t * (3 - 2 * t);
  const a = new THREE.Color(CARS[i0].ground);
  const b = new THREE.Color(CARS[i1].ground);
  const c = a.lerp(b, ts);
  return <Stage groundColor={`#${c.getHexString()}`} />;
}

function Effects({ dpr }: { dpr: number }) {
  // Disable heavier effects on low-DPR / mobile
  const heavy = dpr >= 1.25;
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom
        intensity={1.0}
        luminanceThreshold={0.5}
        luminanceSmoothing={0.25}
        mipmapBlur
      />
      {heavy ? (
        <DepthOfField focusDistance={0.013} focalLength={0.05} bokehScale={3.6} />
      ) : (
        <></>
      )}
      <ChromaticAberration
        offset={CA_OFFSET}
        radialModulation={false}
        modulationOffset={0}
        blendFunction={BlendFunction.NORMAL}
      />
      <Scanline density={1.1} opacity={0.04} blendFunction={BlendFunction.OVERLAY} />
      <Noise opacity={0.06} blendFunction={BlendFunction.OVERLAY} />
      <Vignette eskil={false} offset={0.2} darkness={0.9} />
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
