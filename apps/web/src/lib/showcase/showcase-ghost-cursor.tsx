'use client';

import { useEffect, useState } from 'react';

interface ShowcaseGhostCursorProps {
  points: Array<{ x: number; y: number }>;
  durationMs: number;
  active: boolean;
}

export function ShowcaseGhostCursor({ points, durationMs, active }: ShowcaseGhostCursorProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!active || points.length === 0) {
      setPosition(null);
      return undefined;
    }

    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const segmentCount = Math.max(points.length - 1, 1);
      const scaled = progress * segmentCount;
      const index = Math.min(Math.floor(scaled), points.length - 1);
      const localT = scaled - index;
      const from = points[index] ?? points[0]!;
      const to = points[Math.min(index + 1, points.length - 1)] ?? from;

      setPosition({
        x: from.x + (to.x - from.x) * localT,
        y: from.y + (to.y - from.y) * localT,
      });

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, points, durationMs]);

  if (!active || !position) {
    return null;
  }

  return (
    <div
      className="showcase-ghost-cursor pointer-events-none fixed z-[200]"
      style={{
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
        transform: 'translate(-50%, -50%)',
      }}
      aria-hidden
    >
      <span className="showcase-ghost-cursor-ring" />
      <span className="showcase-ghost-cursor-dot" />
    </div>
  );
}
