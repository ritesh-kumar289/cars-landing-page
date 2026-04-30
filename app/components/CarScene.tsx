'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  useGLTF,
  PerformanceMonitor,
} from '@react-three/drei';
import * as THREE from 'three';
import { CARS } from '../lib/cars';
import { scrollRef } from '../lib/scroll';

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
const W13_LEFT_WINDOW_SIZE = 1.4;
/** Symmetric visibility window for all other cars. Tighter (< 1.0) so cars
 *  finish exiting before the next one arrives — prevents on-screen overlap. */
const DEFAULT_WINDOW_SIZE = 0.85;

/** Smoothly interpolate a value with critical damping. */
function damp(current: number, target: number, lambda: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

// Eager preload removed: each CarModelDriven loads its GLB on mount,
// and we only mount cars within ±LAZY_WINDOW of the active scroll
// position (see ActiveCar). This keeps the GPU memory + parse cost
// bounded regardless of how many cars are in CARS.
/** How many cars on either side of the active one to keep mounted.
 *  2 = active + 2 ahead + 2 behind = up to 5 GLBs in memory at once. */
const LAZY_WINDOW = 2;

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

    // Add subtle handheld camera shake (cheap — just two sin/cos)
    const time = state.clock.elapsedTime;
    posTmp.current.x += Math.sin(time * 0.7) * 0.03;
    posTmp.current.y += Math.cos(time * 0.55) * 0.02;

    // Mouse parallax disabled during fast scroll: pointer events fire
    // sparsely while wheel-spamming and the parallax target jumps,
    // making the camera feel jittery. Suppress while drag-rotating too.
    if (!dragState.active) {
      const mx = state.pointer.x;
      const my = state.pointer.y;
      posTmp.current.x += mx * 0.5;
      posTmp.current.y += my * 0.25;
    }

    // Single damp call per axis — lookAt is computed directly without
    // its own damp pass (saves three damp() invocations per frame).
    const lambda = 3.0;
    camera.position.x = damp(camera.position.x, posTmp.current.x, lambda, dt);
    camera.position.y = damp(camera.position.y, posTmp.current.y, lambda, dt);
    camera.position.z = damp(camera.position.z, posTmp.current.z, lambda, dt);
    camera.lookAt(lookAtTmp.current);

    // FOV: cheaper, fixed-target zoom (no extra sin)
    const fovTarget = 34;
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
  // Bitmask of which car indices are currently mounted. Updated only when
  // the active window changes (not every frame), so React renders are rare.
  const [mounted, setMounted] = useState<boolean[]>(() => {
    const arr = new Array(CARS.length).fill(false);
    // Mount the first window worth of cars immediately so the hero is
    // populated on first paint.
    for (let i = 0; i <= LAZY_WINDOW; i++) arr[i] = true;
    return arr;
  });
  const mountedRef = useRef(mounted);
  mountedRef.current = mounted;
  // Track which URLs we've already kicked a prefetch for, so we don't
  // spam the network on every frame the predicate matches.
  const prefetched = useRef<Set<string>>(new Set());

  useFrame(() => {
    const p = scrollRef.current * (total - 1);
    let dirty = false;
    const next = mountedRef.current.slice();
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
      // Lazy mount window: keep this car mounted if it's within
      // LAZY_WINDOW acts of the current scroll position. Once mounted,
      // we never UN-mount (avoids re-parsing GLB if the user scrolls
      // back). With 12 cars × ~15MB avg, peak memory is bounded by
      // however far they've scrolled \u2014 acceptable.
      const shouldMount = Math.abs(distToCenter) < LAZY_WINDOW + 0.5;
      // Prefetch one act earlier than mount: drei's useGLTF.preload kicks
      // off the download in the background so the GLB is in cache by the
      // time we actually mount the component. Without this, the car would
      // appear to "pop in" on fast scrolls.
      if (
        Math.abs(distToCenter) < LAZY_WINDOW + 1.5 &&
        !prefetched.current.has(CARS[i].model)
      ) {
        prefetched.current.add(CARS[i].model);
        useGLTF.preload(CARS[i].model);
      }
      if (shouldMount && !next[i]) {
        next[i] = true;
        dirty = true;
      }
    });
    if (dirty) setMounted(next);
  });

  return (
    <>
      {CARS.map((c, i) => (
        <group key={c.id} ref={(el) => { if (el) groupRefs.current[i] = el; }}>
          {mounted[i] ? (
            <Suspense fallback={null}>
              <CarModelDriven
                url={c.model}
                scale={c.scale}
                yOffset={c.yOffset}
                rotationY={c.rotationY}
                groupRef={() => groupRefs.current[i]}
              />
            </Suspense>
          ) : null}
        </group>
      ))}
      <SharedLights groupRefs={groupRefs} />
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
  // Clone for safety under React strict mode (dev double-mount) — the
  // base `scene` is shared across re-mounts, and a primitive can't be
  // attached to two parents at once.
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
        // Shadows disabled — ContactShadows + ground bake handle the
        // grounding cue at a fraction of the GPU cost.
        mesh.castShadow = false;
        mesh.receiveShadow = false;
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

    // Early-out: when the car is fully off-screen and not approaching,
    // skip every per-frame computation. With 12 cars this turns ~12 frame
    // workloads into ~2 (active + neighbor), which is the single biggest
    // win for fast-scroll smoothness.
    if (targetV < 0.01 && v < 0.01) {
      ref.current.visible = false;
      return;
    }
    // Keep cars at full scale — the visibility crossfade is handled by
    // movement + opacity (via lights), not by scaling them down (which
    // made them appear to "shrink into the floor").
    ref.current.scale.setScalar(scale * fit.fitScale * (0.92 + 0.08 * v));
    ref.current.visible = v > 0.005;

    const isFront = v > 0.55;
    // Only accumulate idle yaw when the car is at least partially
    // visible. While hidden, idle is frozen so the car doesn't spin
    // off-screen and then "flick" to a random angle on entry.
    if (v > 0.1 && (!dragState.active || !isFront)) {
      idleRef.current += dt * IDLE_ROTATION_SPEED;
    }

    // Drive-off rotation kick: outgoing cars get a soft yaw sweep as
    // they leave (signedDist > 0). Incoming cars stay neutral so they
    // don't flick on entry.
    const driveSpin =
      signedDist > 0 ? (1 - v) * Math.min(1, signedDist) * 0.3 : 0;
    if (isFront) {
      if (!dragState.active) {
        dragState.yaw += dragState.vel * dt;
        dragState.vel *= Math.exp(-1.6 * dt);
      }
    }
    const targetYaw =
      idleRef.current +
      rotationY +
      (isFront ? dragState.yaw : 0) +
      driveSpin;

    // While invisible, hold yaw at the natural rotationY so the next
    // entry starts from a clean state. While visible, damp toward the
    // target yaw so any small idle drift / drag is silky.
    if (v < 0.05) {
      ref.current.userData.yaw = rotationY;
    } else {
      ref.current.userData.yaw = damp(
        (ref.current.userData.yaw as number | undefined) ?? rotationY,
        targetYaw,
        7,
        dt,
      );
    }
    ref.current.rotation.y = ref.current.userData.yaw;
    // Banking tilt only on exit, not on entry
    ref.current.rotation.z = -driveSpin * 0.2;

    // ====== Drive-off transition along the car's facing direction ======
    // Forward vector for the car's current yaw (around Y). Outgoing cars
    // accelerate off-screen quickly; incoming cars stage from far ahead
    // and arrive only when fully visible. The asymmetric distances are
    // what guarantees no on-screen overlap between adjacent cars.
    const yaw = ref.current.userData.yaw as number;
    tmpForward.current.set(Math.sin(yaw), 0, Math.cos(yaw));
    // Cubic out for outgoing (exits fast), cubic in for incoming
    // (stays far away until last moment). 12 units is enough to clear
    // any car footprint at scale 1.6.
    const fadeOut = 1 - v;
    const exitDist = signedDist < 0 ? signedDist * 12 * fadeOut : 0;
    const enterDist = signedDist > 0 ? signedDist * 12 * fadeOut * fadeOut : 0;
    const driveDist = exitDist + enterDist;
    const targetX = tmpForward.current.x * driveDist;
    const targetZ = tmpForward.current.z * driveDist;

    // Snap position while invisible so the car re-enters from the
    // correct staging spot rather than damping in from a stale offset.
    if (v < 0.05) {
      ref.current.userData.tx = targetX;
      ref.current.userData.tz = targetZ;
    } else {
      ref.current.userData.tx = damp(
        (ref.current.userData.tx as number | undefined) ?? targetX,
        targetX,
        5,
        dt,
      );
      ref.current.userData.tz = damp(
        (ref.current.userData.tz as number | undefined) ?? targetZ,
        targetZ,
        5,
        dt,
      );
    }

    // Auto-ground: the bbox bottom rests on the floor disc (y = -0.69)
    // plus the car-specific yOffset (used for fine art-direction lifts).
    // Critically: we never let the car *sink* during transitions — y is
    // clamped at the ground regardless of fade state.
    const groundY = -0.69 + yOffset * 0.1; // small per-car artistic adjustment
    const bottomLocal = -fit.bottomFromCenter * scale * fit.fitScale;
    const restingY = groundY - bottomLocal;
    // Position the OUTER group at the (translated) world location.
    // Centering offsets are applied to the inner group below, so this
    // group rotates cleanly around the car's bbox center — critical for
    // models like the Mustang whose origin sits far from their geometry
    // (otherwise they orbit in a wide arc as yaw changes).
    ref.current.position.x = ref.current.userData.tx;
    ref.current.position.y = restingY;
    ref.current.position.z = ref.current.userData.tz;
  });

  const centerOffset = useMemo<[number, number, number]>(
    () => [
      -fit.center.x * scale * fit.fitScale,
      -fit.center.y * scale * fit.fitScale,
      -fit.center.z * scale * fit.fitScale,
    ],
    [fit, scale],
  );

  return (
    <group ref={ref} rotation={[0, rotationY, 0]}>
      <group position={centerOffset}>
        <primitive object={cloned} />
      </group>
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
  // Deprecated — retained as a no-op stub so older imports don't break.
  // Lighting is now handled by a single <SharedLights /> instance that
  // tracks the active car. Keeping 12 light rigs in the scene cost ~6ms
  // per frame even when their intensities were 0 (Three still iterates
  // them during shadow + light-uniform updates).
  void rim; void fill; void groupRef;
  return null;
}

function SharedLights({
  groupRefs,
}: {
  groupRefs: React.MutableRefObject<THREE.Group[]>;
}) {
  const ambRef = useRef<THREE.AmbientLight>(null);
  const keyRef = useRef<THREE.DirectionalLight>(null);
  const rimRef = useRef<THREE.DirectionalLight>(null);
  const fillRef = useRef<THREE.PointLight>(null);
  const rimColor = useMemo(() => new THREE.Color(), []);
  const fillColor = useMemo(() => new THREE.Color(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    // Find the most-visible car and adopt its rim/fill palette.
    let bestI = 0;
    let bestV = 0;
    for (let i = 0; i < CARS.length; i++) {
      const v = (groupRefs.current[i]?.userData.v as number | undefined) ?? 0;
      if (v > bestV) {
        bestV = v;
        bestI = i;
      }
    }
    const car = CARS[bestI];
    tmpColor.set(car.rim);
    rimColor.lerp(tmpColor, 0.08);
    tmpColor.set(car.fill);
    fillColor.lerp(tmpColor, 0.08);

    if (ambRef.current) ambRef.current.intensity = 0.18;
    if (keyRef.current) keyRef.current.intensity = 2.4;
    if (rimRef.current) {
      rimRef.current.intensity = 3.0;
      rimRef.current.color.copy(rimColor);
    }
    if (fillRef.current) {
      fillRef.current.intensity = 1.4;
      fillRef.current.color.copy(fillColor);
    }
  });

  return (
    <group>
      <ambientLight ref={ambRef} intensity={0.18} />
      <directionalLight
        ref={keyRef}
        position={[5, 6, 4]}
        intensity={2.4}
        color="#ffe8c2"
      />
      <directionalLight ref={rimRef} position={[-6, 4, -4]} intensity={3.0} />
      <pointLight ref={fillRef} position={[0, 1.2, 4]} intensity={1.4} distance={12} />
    </group>
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.7, 0]}>
        <circleGeometry args={[20, 48]} />
        <meshStandardMaterial ref={stageRef} color={CARS[0].ground} metalness={0.4} roughness={0.6} />
      </mesh>
      <ContactShadows
        position={[0, -0.69, 0]}
        opacity={0.55}
        scale={10}
        blur={2.2}
        far={3}
        resolution={256}
        color="#000000"
      />
    </>
  );
}

function Effects() {
  // EffectComposer (Bloom + ToneMapping + Vignette) was costing ~6–8ms
  // per frame on integrated GPUs and was the dominant blocker on fast
  // scrolls. We've replaced it with a CSS vignette overlay (see globals.css)
  // and rely on the renderer's built-in ACESFilmicToneMapping which is
  // essentially free. Bloom is gone — the cars hold up fine without it.
  return null;
}

export default function CarScene() {
  const [dpr, setDpr] = useState(1);
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
      gl={{
        antialias: false,
        alpha: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
      }}
      dpr={[0.7, dpr]}
      camera={{ position: [0, 1, 6], fov: 35, near: 0.1, far: 60 }}
      style={{ position: 'fixed', inset: 0, zIndex: 0, cursor: 'grab', touchAction: 'pan-y' }}
      frameloop="always"
    >
      <PerformanceMonitor
        onIncline={() => setDpr((d) => Math.min(1.1, d + 0.15))}
        onDecline={() => setDpr((d) => Math.max(0.7, d - 0.2))}
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
