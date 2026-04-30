'use client';

import { useEffect, useRef, useState } from 'react';
import { useScrollProgress } from '../lib/scroll';
import { CARS } from '../lib/cars';

/**
 * CarsAudio — synthesized cinematic engine soundscape using the Web Audio API.
 *
 * - A low sawtooth + a higher detuned saw create the engine "growl".
 * - A filtered noise source layers a road/turbulence rumble.
 * - Pitch & filter cutoff are modulated by scroll progress (revs follow scroll
 *   speed) and the active car's "personality" (each car has a unique base RPM).
 * - On every act change we fire a short rev / whoosh transient.
 *
 * Browsers block autoplay until a user gesture, so audio is initialized on
 * the first click/keydown. A floating button lets the user mute/unmute.
 */
export default function CarsAudio() {
  const { progress, act } = useScrollProgress();
  const [enabled, setEnabled] = useState(false);
  const [muted, setMuted] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const oscARef = useRef<OscillatorNode | null>(null);
  const oscBRef = useRef<OscillatorNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);
  const lastProgressRef = useRef(0);
  const lastTimeRef = useRef(0);
  const lastActRef = useRef(-1);
  const rafRef = useRef<number | null>(null);

  // Initialize audio graph on first user gesture
  useEffect(() => {
    if (!enabled) return;
    const Ctor =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    const ctx: AudioContext = new Ctor();
    ctxRef.current = ctx;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    masterRef.current = master;

    // ---- Engine oscillators ----
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    filter.Q.value = 8;
    filter.connect(master);
    filterRef.current = filter;

    const oscA = ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscA.frequency.value = 70;
    const gA = ctx.createGain();
    gA.gain.value = 0.35;
    oscA.connect(gA).connect(filter);
    oscA.start();
    oscARef.current = oscA;

    const oscB = ctx.createOscillator();
    oscB.type = 'sawtooth';
    oscB.frequency.value = 105; // slight detune harmonic
    oscB.detune.value = -8;
    const gB = ctx.createGain();
    gB.gain.value = 0.18;
    oscB.connect(gB).connect(filter);
    oscB.start();
    oscBRef.current = oscB;

    // ---- Noise / road rumble ----
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const out = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) out[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 220;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.04;
    noise.connect(noiseFilter).connect(noiseGain).connect(master);
    noise.start();
    noiseGainRef.current = noiseGain;

    // Fade in master
    master.gain.setTargetAtTime(0.18, ctx.currentTime, 0.6);

    return () => {
      try {
        oscA.stop();
        oscB.stop();
        noise.stop();
      } catch {}
      try {
        ctx.close();
      } catch {}
    };
  }, [enabled]);

  // Mute toggle
  useEffect(() => {
    const m = masterRef.current;
    const ctx = ctxRef.current;
    if (!m || !ctx) return;
    m.gain.cancelScheduledValues(ctx.currentTime);
    m.gain.setTargetAtTime(muted ? 0 : 0.18, ctx.currentTime, 0.2);
  }, [muted]);

  // First-gesture activation
  useEffect(() => {
    if (enabled) return;
    const onGesture = () => {
      setEnabled(true);
      window.removeEventListener('click', onGesture);
      window.removeEventListener('keydown', onGesture);
      window.removeEventListener('touchstart', onGesture);
    };
    window.addEventListener('click', onGesture);
    window.addEventListener('keydown', onGesture);
    window.addEventListener('touchstart', onGesture);
    return () => {
      window.removeEventListener('click', onGesture);
      window.removeEventListener('keydown', onGesture);
      window.removeEventListener('touchstart', onGesture);
    };
  }, [enabled]);

  // Drive engine pitch from scroll progress + velocity
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const loop = () => {
      if (!alive) return;
      const ctx = ctxRef.current;
      const oscA = oscARef.current;
      const oscB = oscBRef.current;
      const filter = filterRef.current;
      if (ctx && oscA && oscB && filter) {
        const now = performance.now();
        const dt = Math.max(1, now - (lastTimeRef.current || now)) / 1000;
        const dp = Math.abs(progress - lastProgressRef.current) / dt; // scroll velocity 0..~5
        lastProgressRef.current = progress;
        lastTimeRef.current = now;

        // Per-car pitch personality
        const carIdx = Math.max(
          0,
          Math.min(CARS.length - 1, act - 1),
        );
        const baseHz = 60 + carIdx * 8 + progress * 30;
        const revBoost = Math.min(1, dp * 4) * 90; // boost on fast scroll
        const targetA = baseHz + revBoost;
        const targetB = (baseHz + revBoost) * 1.5;
        const targetCutoff = 380 + revBoost * 6 + progress * 600;

        const t = ctx.currentTime;
        oscA.frequency.setTargetAtTime(targetA, t, 0.15);
        oscB.frequency.setTargetAtTime(targetB, t, 0.15);
        filter.frequency.setTargetAtTime(targetCutoff, t, 0.2);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      alive = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, progress, act]);

  // Rev burst on act change
  useEffect(() => {
    if (!enabled) return;
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (!ctx || !master) return;
    if (lastActRef.current === act) return;
    lastActRef.current = act;

    // Quick whoosh-ish blip: sine swept up then down through a bandpass
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 800;
    bp.Q.value = 2;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(540, t0 + 0.18);
    osc.frequency.exponentialRampToValueAtTime(120, t0 + 0.65);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.22, t0 + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.7);
    osc.connect(bp).connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + 0.75);
  }, [act, enabled]);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!enabled) {
          setEnabled(true);
          setMuted(false);
        } else {
          setMuted((m) => !m);
        }
      }}
      className="fixed left-6 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col items-center gap-2 smallcaps font-mono text-bone/70 hover:text-ember transition"
      aria-label={muted || !enabled ? 'Enable engine sound' : 'Mute engine sound'}
    >
      <span
        className={`block w-2.5 h-2.5 rounded-full ${
          enabled && !muted ? 'bg-ember animate-pulse' : 'bg-bone/30'
        }`}
      />
      <span className="[writing-mode:vertical-rl] rotate-180 tracking-[0.3em]">
        {!enabled ? 'SOUND · OFF' : muted ? 'SOUND · MUTED' : 'ENGINE · ON'}
      </span>
    </button>
  );
}
