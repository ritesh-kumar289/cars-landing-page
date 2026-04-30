'use client';

export default function Marquee({
  text,
  reverse = false,
}: {
  text: string;
  reverse?: boolean;
}) {
  const items = Array.from({ length: 8 }, (_, i) => i);
  return (
    <div className="overflow-hidden border-y border-white/10 py-3 bg-black/40 backdrop-blur-sm">
      <div
        className="marquee-track"
        style={{ animationDirection: reverse ? 'reverse' : 'normal' }}
      >
        {items.map((i) => (
          <span
            key={i}
            className="display text-[clamp(1.5rem,4vw,3rem)] mx-8 text-bone/80"
          >
            {text} <span className="text-ember">✦</span>{' '}
          </span>
        ))}
      </div>
    </div>
  );
}
