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
  Vignette,
  ToneMapping,
} from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { CARS } from '../lib/cars';
import { scrollRef } from '../lib/scroll';

const CA_OFFSET = new THREE.Vector2(0.0008, 0.0012);

/**
 * Module-level user-drag state. Updated by Canvas pointer handlers,
 * read every frame by `CarModel`. The active car (highest visibility)
 * applies `userYaw` to its rotation so click-and-drag rotates it like
 * a showroom turntable. After release, `userVel` provides inertia.
 */
const dragState = {
  yaw: 0,
  vel: 0,
  active: false,
  lastX: 0,
};

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

// Preload all GLB/GLTF models so transitions are instant
CARS.forEach((c) => useGLTF.preload(c.model));

/**
 * Director — drives the camera on a continuous spline based on scroll.
 * Acts:
 *   0           -> hero (slow orbit, far)
 *   1..N (cars) -> per-car beats (low/high/profile/3-quarter)
 *   N+1         -> credits (pull back, fade)
 */
function Director() {
  const { camera } = useThree();

  // Per-act camera "beats" (position, lookAt). Three beats per car (in/hero/out)
  // give us long, sweeping transitions instead of short pops.
  const beats = useMemo(() => {
    const carBeats = CARS.flatMap((_, i) => {
      const sign = i % 2 === 0 ? 1 : -1;
      return [
        // Entrance: wide 3/4 low, far away
        { pos: new THREE.Vector3(5.6 * sign, 0.9, 5.2), look: new THREE.Vector3(0.5 * sign, 0.0, 0) },
        // Hero: closer side profile (pulled back so wheels stay in frame
        // for taller models like the F40 + RWB)
        { pos: new THREE.Vector3(-3.0 * sign, 1.5, 3.6), look: new THREE.Vector3(0, 0.0, 0) },
        // Exit: dolly past, low and tight — sets up the next car's entrance
        { pos: new THREE.Vector3(-5.6 * sign, 1.0, 4.4), look: new THREE.Vector3(-0.4 * sign, 0.0, 0) },
      ];
    });
    return [
      // Hero: distant, slow drift
      { pos: new THREE.Vector3(0, 1.3, 7.2), look: new THREE.Vector3(0, 0.2, 0) },
      ...carBeats,
      // Credits: pull back high
      { pos: new THREE.Vector3(0, 3.4, 8.4), look: new THREE.Vector3(0, 0, 0) },
    ];
  }, []);

  const lookAtTmp = useRef(new THREE.Vector3());
  const posTmp = useRef(new THREE.Vector3());
  const lookAtCurrent = useRef(new THREE.Vector3());

  useFrame((state, dt) => {
    const progress = scrollRef.current;
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

    // Responsive framing: pull the camera back on portrait/narrow
    // viewports so cars (especially the F40 + RWB) keep their wheels
    // in frame on mobile and tablets.
    const aspect = state.viewport.aspect || (state.size.width / Math.max(1, state.size.height));
    const aspectScale = aspect < 1 ? 1.6 : aspect < 1.4 ? 1.25 : 1;
    posTmp.current.z *= aspectScale;
    posTmp.current.x *= aspectScale * 0.95;

    // Add subtle handheld camera shake
    const time = state.clock.elapsedTime;
    posTmp.current.x += Math.sin(time * 0.7) * 0.03;
    posTmp.current.y += Math.cos(time * 0.55) * 0.02;

    // Interactive mouse parallax — cursor pushes the camera around the
    // subject. Suppress while the user is drag-rotating, so the two
    // gestures don’t fight each other.
    if (!dragState.active) {
      const mx = state.pointer.x;
      const my = state.pointer.y;
      posTmp.current.x += mx * 0.7;
      posTmp.current.y += my * 0.35;
      lookAtTmp.current.x += mx * 0.12;
      lookAtTmp.current.y += my * 0.06;
    }

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
  const groupRefs = useRef<THREE.Group[]>([]);
  const total = CARS.length + 2;

  useFrame(() => {
    const p = scrollRef.current * (total - 1);
    CARS.forEach((_, i) => {
      const center = i + 1;
      const distToCenter = p - center;
      const windowSize = i === 0 && distToCenter < 0 ? W13_LEFT_WINDOW_SIZE : DEFAULT_WINDOW_SIZE;
      const x = Math.min(1, Math.abs(distToCenter) / windowSize);
      const v = 1 - x * x * (3 - 2 * x);
      const signed = Math.max(-1, Math.min(1, distToCenter / windowSize));
      const g = groupRefs.current[i];
      if (g) {
        g.userData.v = v;
        g.userData.signed = signed;
        g.visible = v > 0.005;
      }
    });
  });

  return (
    <>
      {CARS.map((c, i) => (
        <group key={c.id} ref={(el) => { if (el) groupRefs.current[i] = el; }}>
          <Float speed={0.8} rotationIntensity={0.05} floatIntensity={0.25}>
            <CarModelDriven
              url={c.model}
              scale={c.scale}
              yOffset={c.yOffset}
              rotationY={c.rotationY}
              groupRef={() => groupRefs.current[i]}
            />
          </Float>
          <CinematicLightsDriven
            rim={c.rim}
            fill={c.fill}
            groupRef={() => groupRefs.current[i]}
          />
        </group>
      ))}
    </>
  );
}

/** CarModel variant that reads its visibility / signed distance from the
 *  parent group's userData (set every frame by ActiveCar). This avoids
 *  React renders per scroll tick. */
function CarModelDriven({
  url,
  scale,
  yOffset,
  rotationY,
  groupRef,
}: {
  url: string;
  scale: number;
  yOffset: number;
  rotationY: number;
  groupRef: () => THREE.Group | undefined;
}) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const ref = useRef<THREE.Group>(null);

  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const targetHeight = 1.6;
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const fitScale = targetHeight / maxDim;
    // Distance from the bbox center to the bbox bottom — we use this so
    // the car sits ON the ground disc (-0.7) regardless of model origin.
    const bottomFromCenter = (center.y - box.min.y);
    return { center, fitScale, bottomFromCenter };
  }, [cloned]);

  useMemo(() => {
    cloned.traverse((o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
        if (mat && 'envMapIntensity' in mat) {
          mat.envMapIntensity = 1.4;
          mat.needsUpdate = true;
        }
      }
    });
  }, [cloned]);

  const idleRef = useRef(0);
  // Tmp vectors to avoid per-frame allocations
  const tmpForward = useRef(new THREE.Vector3());

  useFrame((_state, dt) => {
    if (!ref.current) return;
    const parent = groupRef();
    const targetV = (parent?.userData.v as number | undefined) ?? 0;
    const signedDist = (parent?.userData.signed as number | undefined) ?? 0;

    ref.current.userData.v = damp(ref.current.userData.v ?? 0, targetV, 4, dt);
    const v = ref.current.userData.v;
    // Keep cars at full scale — the visibility crossfade is handled by
    // movement + opacity (via lights), not by scaling them down (which
    // made them appear to "shrink into the floor").
    ref.current.scale.setScalar(scale * fit.fitScale * (0.92 + 0.08 * v));
    ref.current.visible = v > 0.005;

    const isFront = v > 0.55;
    if (!dragState.active || !isFront) {
      idleRef.current += dt * IDLE_ROTATION_SPEED;
    }

    // Drive-off rotation kick: outgoing/incoming cars get an extra yaw
    // sweep (banking into a turn) for drama.
    const driveSpin = (1 - v) * signedDist * 0.6;

    if (isFront) {
      if (!dragState.active) {
        dragState.yaw += dragState.vel * dt;
        dragState.vel *= Math.exp(-1.6 * dt);
      }
      ref.current.rotation.y = idleRef.current + dragState.yaw + rotationY + driveSpin;
    } else {
      ref.current.rotation.y = idleRef.current + rotationY + driveSpin;
    }
    // Banking tilt during exit
    ref.current.rotation.z = -driveSpin * 0.25;

    // ====== Drive-off transition along the car's facing direction ======
    // Forward vector for the car's current yaw (around Y). When fading
    // out, the car drives forward off-screen; when fading in, it
    // approaches from the opposite side. This makes transitions feel
    // like the previous car drove away in the direction it was facing.
    const yaw = idleRef.current + rotationY;
    tmpForward.current.set(Math.sin(yaw), 0, Math.cos(yaw));
    // Quadratic ease so the car accelerates as it leaves (and
    // decelerates as it arrives). signedDist sign chooses direction:
    //   signedDist < 0  → previous car: drive forward and exit
    //   signedDist > 0  → next car: arrive from in-front of its motion
    const driveDist = signedDist * 9 * (1 - v) * (1 - v);
    const targetX = tmpForward.current.x * driveDist;
    const targetZ = tmpForward.current.z * driveDist;

    ref.current.userData.tx = damp(ref.current.userData.tx ?? targetX, targetX, 5, dt);
    ref.current.userData.tz = damp(ref.current.userData.tz ?? targetZ, targetZ, 5, dt);

    // Auto-ground: the bbox bottom rests on the floor disc (y = -0.69)
    // plus the car-specific yOffset (used for fine art-direction lifts).
    // Critically: we never let the car *sink* during transitions — y is
    // clamped at the ground regardless of fade state.
    const groundY = -0.69 + yOffset * 0.1; // small per-car artistic adjustment
    const bottomLocal = -fit.bottomFromCenter * scale * fit.fitScale;
    const restingY = groundY - bottomLocal;
    ref.current.position.x = -fit.center.x * scale * fit.fitScale + ref.current.userData.tx;
    ref.current.position.y = restingY;
    ref.current.position.z = -fit.center.z * scale * fit.fitScale + ref.current.userData.tz;
  });

  return (
    <group
      ref={ref}
      position={[
        -fit.center.x * scale * fit.fitScale,
        yOffset - fit.center.y * scale * fit.fitScale,
        -fit.center.z * scale * fit.fitScale,
      ]}
      rotation={[0, rotationY, 0]}
    >
      <primitive object={cloned} />
    </group>
  );
}

function CinematicLightsDriven({
  rim,
  fill,
  groupRef,
}: {
  rim: string;
  fill: string;
  groupRef: () => THREE.Group | undefined;
}) {
  const ambRef = useRef<THREE.AmbientLight>(null);
  const keyRef = useRef<THREE.DirectionalLight>(null);
  const rimRef = useRef<THREE.DirectionalLight>(null);
  const fillRef = useRef<THREE.PointLight>(null);
  const bounceRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    const v = (groupRef()?.userData.v as number | undefined) ?? 0;
    if (ambRef.current) ambRef.current.intensity = 0.18 * v;
    if (keyRef.current) keyRef.current.intensity = 2.4 * v;
    if (rimRef.current) rimRef.current.intensity = 3.0 * v;
    if (fillRef.current) fillRef.current.intensity = 1.4 * v;
    if (bounceRef.current) bounceRef.current.intensity = 0.6 * v;
  });

  return (
    <>
      <ambientLight ref={ambRef} intensity={0} />
      <directionalLight
        ref={keyRef}
        position={[5, 6, 4]}
        intensity={0}
        color="#ffe8c2"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight ref={rimRef} position={[-6, 4, -4]} intensity={0} color={rim} />
      <pointLight ref={fillRef} position={[0, 1.2, 4]} intensity={0} color={fill} distance={12} />
      <pointLight ref={bounceRef} position={[0, -0.3, 0]} intensity={0} color={rim} distance={6} />
    </>
  );
}

function ActiveStage() {
  const stageRef = useRef<THREE.MeshStandardMaterial>(null);
  const colorA = useMemo(() => new THREE.Color(), []);
  const colorB = useMemo(() => new THREE.Color(), []);
  const total = CARS.length + 2;

  useFrame(() => {
    if (!stageRef.current) return;
    const p = scrollRef.current * (total - 1);
    const i0 = Math.max(0, Math.min(CARS.length - 1, Math.floor(p) - 1));
    const i1 = Math.max(0, Math.min(CARS.length - 1, i0 + 1));
    const t = Math.max(0, Math.min(1, p - 1 - i0));
    const ts = t * t * (3 - 2 * t);
    colorA.set(CARS[i0].ground);
    colorB.set(CARS[i1].ground);
    stageRef.current.color.copy(colorA).lerp(colorB, ts);
  });

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.7, 0]} receiveShadow>
        <circleGeometry args={[20, 64]} />
        <meshStandardMaterial ref={stageRef} color={CARS[0].ground} metalness={0.4} roughness={0.6} />
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

function Effects() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom
        intensity={0.85}
        luminanceThreshold={0.55}
        luminanceSmoothing={0.25}
        mipmapBlur
      />
      <ChromaticAberration
        offset={CA_OFFSET}
        radialModulation={false}
        modulationOffset={0}
        blendFunction={BlendFunction.NORMAL}
      />
      <Vignette eskil={false} offset={0.2} darkness={0.85} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

export default function CarScene() {
  const [dpr, setDpr] = useState(1.25);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(m.matches);
  }, []);

  // Drag-to-rotate: attach native pointer listeners on window so the
  // gesture works even when the cursor moves outside the canvas. We use
  // movementX as a fast, robust delta; threshold guard prevents tiny
  // accidental rotations during scroll.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      // Ignore right/middle clicks and clicks on UI elements.
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (target && target.closest('a, button, input, textarea, [data-no-drag]')) return;
      dragState.active = true;
      dragState.lastX = e.clientX;
      dragState.vel = 0;
      document.body.classList.add('cursor-grabbing');
    };
    const onMove = (e: PointerEvent) => {
      if (!dragState.active) return;
      const dx = e.clientX - dragState.lastX;
      dragState.lastX = e.clientX;
      // Direction-faithful rotation: dragging right rotates the car right.
      dragState.yaw += dx * 0.008;
      dragState.vel = dx * 0.5; // capture instantaneous velocity for inertia
    };
    const onUp = () => {
      if (!dragState.active) return;
      dragState.active = false;
      document.body.classList.remove('cursor-grabbing');
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  return (
    <Canvas
      shadows
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      dpr={[1, dpr]}
      camera={{ position: [0, 1, 6], fov: 35, near: 0.1, far: 60 }}
      style={{ position: 'fixed', inset: 0, zIndex: 0, cursor: 'grab', touchAction: 'pan-y' }}
      frameloop="always"
    >
      <PerformanceMonitor
        onIncline={() => setDpr((d) => Math.min(1.75, d + 0.25))}
        onDecline={() => setDpr((d) => Math.max(1, d - 0.25))}
      />
      <color attach="background" args={['#050505']} />
      <fog attach="fog" args={['#050505', 8, 22]} />

      <Suspense fallback={null}>
        <Environment preset="warehouse" environmentIntensity={0.55} />
      </Suspense>

      <ambientLight intensity={0.12} color="#7dd3fc" />

      <Suspense fallback={null}>
        <ActiveStage />
        <ActiveCar />
        <Director />
        {!reduced && <Effects />}
      </Suspense>
    </Canvas>
  );
}
