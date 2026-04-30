'use client';

import { useEffect, useState } from 'react';

export default function CustomCursor() {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [ringPos, setRingPos] = useState({ x: -100, y: -100 });

  useEffect(() => {
    let raf = 0;
    let cur = { x: -100, y: -100 };
    let target = { x: -100, y: -100 };

    const onMove = (e: MouseEvent) => {
      target = { x: e.clientX, y: e.clientY };
      setPos(target);
    };
    const tick = () => {
      cur.x += (target.x - cur.x) * 0.15;
      cur.y += (target.y - cur.y) * 0.15;
      setRingPos({ x: cur.x, y: cur.y });
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('mousemove', onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Hide on touch devices
  if (typeof window !== 'undefined' && 'ontouchstart' in window) return null;

  return (
    <>
      <div className="cursor-dot" style={{ transform: `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)` }} />
      <div
        className="cursor-ring"
        style={{ transform: `translate(${ringPos.x}px, ${ringPos.y}px) translate(-50%, -50%)` }}
      />
    </>
  );
}
