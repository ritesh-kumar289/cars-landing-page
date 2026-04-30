'use client';

import { useEffect, useRef, useState } from 'react';
import { useScrollProgress, scrollRef } from '../lib/scroll';

/**
 * CarsAudio — plays the user-supplied engine mp3 loop and modulates its
 * playback rate from scroll progress + scroll velocity so it "revs" as
 * the user scrolls between cars. A floating button toggles mute/unmute.
 *
 * Browsers block autoplay until a user gesture, so playback starts on
 * the first click / keydown / touch.
 */
const ENGINE_SRC = '/engine.mp3';

export default function CarsAudio() {
  const { act } = useScrollProgress();
  const [enabled, setEnabled] = useState(false);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastProgressRef = useRef(0);
  const lastTimeRef = useRef(0);
  const lastActRef = useRef(-1);
  const rafRef = useRef<number | null>(null);

  // Create the <audio> element once
  useEffect(() => {
    const a = new Audio(ENGINE_SRC);
    a.loop = true;
    a.preload = 'auto';
    a.volume = 0;
    audioRef.current = a;
    return () => {
      try {
        a.pause();
      } catch {}
      audioRef.current = null;
    };
  }, []);

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

  // Start / stop playback when enabled / muted change
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!enabled) {
      a.pause();
      return;
    }
    a.play().catch(() => {});
    const target = muted ? 0 : 0.45;
    const start = a.volume;
    const t0 = performance.now();
    const dur = 600;
    let raf = 0;
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      a.volume = start + (target - start) * k;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [enabled, muted]);

  // Modulate playback rate from scroll progress + velocity for a rev feel
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const loop = () => {
      if (!alive) return;
      const a = audioRef.current;
      if (a && !a.paused) {
        const progress = scrollRef.current;
        const now = performance.now();
        const dt = Math.max(1, now - (lastTimeRef.current || now)) / 1000;
        const dp = Math.abs(progress - lastProgressRef.current) / dt;
        lastProgressRef.current = progress;
        lastTimeRef.current = now;
        const target = 0.85 + progress * 0.25 + Math.min(0.5, dp * 1.4);
        const cur = a.playbackRate;
        a.playbackRate = cur + (target - cur) * 0.15;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      alive = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled]);

  // Quick rev "blip" on act change — briefly bumps playback rate
  useEffect(() => {
    if (!enabled) return;
    const a = audioRef.current;
    if (!a) return;
    if (lastActRef.current === act) return;
    lastActRef.current = act;
    const original = a.playbackRate;
    a.playbackRate = Math.min(2, original + 0.55);
    const t = setTimeout(() => {
      if (audioRef.current) audioRef.current.playbackRate = original;
    }, 280);
    return () => clearTimeout(t);
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
