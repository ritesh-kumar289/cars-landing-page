'use client';

import { useEffect, useRef, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { CARS } from '../lib/cars';

/**
 * Loader — black card with an SVG F1 car silhouette that drives left → right
 * across the screen as progress fills. The percent number sits behind it.
 *
 *  - Pure SVG (no 3D canvas) so the car is visible at 0% and renders
 *    instantly, with no GLB-load dependency.
 *  - Side profile, nose pointing RIGHT (direction of travel).
 *  - All car GLBs preload at module-parse so the showcase is hot when
 *    the loader fades.
 */

CARS.forEach((c) => useGLTF.preload(c.model));
useGLTF.preload('/models/formula_1_generico_2.glb');

export default function Loader() {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [hide, setHide] = useState(false);
  const carWrapRef = useRef<HTMLDivElement | null>(null);
  const wheelLRef = useRef<SVGGElement | null>(null);
  const wheelRRef = useRef<SVGGElement | null>(null);

  // Drive the car wrapper position from progress via the DOM (avoids
  // re-rendering on every progress tick).
  useEffect(() => {
    if (!carWrapRef.current) return;
    const t = Math.min(1, Math.max(0, progress / 100));
    // 0% → far-left edge (left:0), 100% → car-box flush against right edge.
    carWrapRef.current.style.left = `calc(${t * 100}vw - ${t * 320}px)`;
  }, [progress]);

  useEffect(() => {
    // Explicit per-URL completion tracking — the THREE DefaultLoadingManager
    // can fire `onLoad` prematurely when one batch finishes before the next
    // registers, causing the loader to flash 100% while other models are
    // still downloading. We instead fetch each model URL ourselves with
    // `Cache.add` so the browser caches the bytes and we know exactly when
    // every car is in cache.
    const expected = CARS.map((c) => c.model);
    let cancelled = false;
    let loaded = 0;

    const update = () => {
      if (cancelled) return;
      const pct = (loaded / expected.length) * 100;
      setProgress((p) => Math.max(p, pct));
      if (loaded >= expected.length) {
        setProgress(100);
        setTimeout(() => !cancelled && setDone(true), 350);
      }
    };

    const fetchOne = async (url: string) => {
      try {
        // Prime the HTTP cache. r3f's GLTFLoader will then read from cache
        // (instant) so the showcase is hot the moment the loader fades.
        const r = await fetch(url, { cache: 'force-cache' });
        await r.arrayBuffer();
      } catch {
        // ignore — count as loaded so we don't deadlock the UI
      } finally {
        if (!cancelled) {
          loaded += 1;
          update();
        }
      }
    };

    expected.forEach(fetchOne);

    // Hard timeout safety net — never strand the user if a slow CDN drags
    const hardTimeout = setTimeout(() => {
      if (cancelled) return;
      setProgress(100);
      setDone(true);
    }, 30000);

    return () => {
      cancelled = true;
      clearTimeout(hardTimeout);
    };
  }, []);

  // Spin the wheels via direct DOM (no React re-renders).
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let phase = 0;
    const tick = (t: number) => {
      const dt = Math.max(1, t - last);
      last = t;
      phase += dt * 0.5;
      if (wheelLRef.current) wheelLRef.current.style.transform = `rotate(${phase}deg)`;
      if (wheelRRef.current) wheelRRef.current.style.transform = `rotate(${phase}deg)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setHide(true), 800);
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

      {/* Track line under the car */}
      <div
        className="pointer-events-none absolute left-0 right-0 z-0"
        style={{
          top: 'calc(50% + 60px)',
          height: '1px',
          background:
            'linear-gradient(90deg, transparent, rgba(255,59,31,0.35) 15%, rgba(255,59,31,0.45) 50%, rgba(255,59,31,0.35) 85%, transparent)',
        }}
        aria-hidden
      />

      {/* Speed dashes for motion */}
      <div
        className="pointer-events-none absolute z-0"
        aria-hidden
        style={{
          top: 'calc(50% - 4px)',
          left: 0,
          right: 0,
          height: '8px',
          opacity: 0.35,
          background:
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.0) 0 6px, rgba(255,255,255,0.18) 6px 10px)',
          maskImage:
            'linear-gradient(90deg, transparent, black 20%, black 80%, transparent)',
          WebkitMaskImage:
            'linear-gradient(90deg, transparent, black 20%, black 80%, transparent)',
        }}
      />

      {/* The car silhouette — translated left → right via inline `left`. */}
      <div
        ref={carWrapRef}
        className="absolute will-change-transform z-10"
        style={{
          top: '50%',
          left: '0px',
          width: '320px',
          height: '120px',
          transform: 'translateY(-50%)',
          transition: 'left 0.16s linear',
          filter: 'drop-shadow(0 12px 18px rgba(255,59,31,0.25))',
        }}
      >
        <svg
          viewBox="0 0 320 120"
          width="100%"
          height="100%"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <defs>
            <linearGradient id="bodyGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ff5b35" />
              <stop offset="55%" stopColor="#e0341a" />
              <stop offset="100%" stopColor="#7a1707" />
            </linearGradient>
            <linearGradient id="tireGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2a2a2a" />
              <stop offset="100%" stopColor="#0a0a0a" />
            </linearGradient>
          </defs>

          <ellipse cx="160" cy="100" rx="140" ry="6" fill="rgba(255,59,31,0.18)" />

          {/* Floor / sidepod (nose at right) */}
          <path
            d="M 30 80 L 60 70 L 110 64 L 180 60 L 240 58 L 295 62 L 305 72 L 300 86 L 250 88 L 60 88 Z"
            fill="url(#bodyGrad)"
          />
          {/* Cockpit */}
          <path
            d="M 130 60 L 150 38 L 175 32 L 205 32 L 218 44 L 222 58 Z"
            fill="#1a1a1a"
          />
          {/* Helmet + visor */}
          <ellipse cx="182" cy="40" rx="14" ry="8" fill="#f4f4f4" />
          <rect x="172" y="36" width="20" height="3" fill="#0a0a0a" />
          {/* Front wing (right) */}
          <path d="M 290 80 L 318 78 L 318 86 L 290 86 Z" fill="#1a1a1a" />
          <rect x="295" y="74" width="22" height="3" fill="#ff3b1f" />
          {/* Rear wing (left) */}
          <path d="M 18 60 L 38 60 L 38 84 L 18 84 Z" fill="#1a1a1a" />
          <rect x="14" y="56" width="28" height="4" fill="#ff3b1f" />
          {/* Engine cover highlight */}
          <path
            d="M 70 70 L 130 64 L 130 70 L 80 76 Z"
            fill="rgba(255,255,255,0.18)"
          />

          {/* Rear wheel (left in side view) */}
          <g
            ref={wheelLRef}
            style={{
              transformOrigin: '70px 88px',
              transformBox: 'view-box',
            }}
          >
            <circle cx="70" cy="88" r="18" fill="url(#tireGrad)" />
            <circle cx="70" cy="88" r="7" fill="#2a2a2a" stroke="#888" strokeWidth="1" />
            <rect x="62" y="86" width="16" height="4" fill="#666" />
            <rect x="68" y="80" width="4" height="16" fill="#666" />
          </g>
          {/* Front wheel (right in side view) */}
          <g
            ref={wheelRRef}
            style={{
              transformOrigin: '260px 88px',
              transformBox: 'view-box',
            }}
          >
            <circle cx="260" cy="88" r="18" fill="url(#tireGrad)" />
            <circle cx="260" cy="88" r="7" fill="#2a2a2a" stroke="#888" strokeWidth="1" />
            <rect x="252" y="86" width="16" height="4" fill="#666" />
            <rect x="258" y="80" width="4" height="16" fill="#666" />
          </g>
        </svg>
      </div>

      {/* Brand mark + thin progress line, anchored to bottom */}
      <div className="absolute inset-x-0 bottom-[12vh] flex flex-col items-center gap-4 z-20">
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
