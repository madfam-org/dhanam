'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';

interface PointerState {
  x: number;
  y: number;
}

export interface HeroTabletMotion {
  transform: string;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
}

const BASE_TILT_X = 8;
const BASE_TILT_Y = -4;

function buildTransform(
  elapsedSeconds: number,
  pointer: PointerState,
  reducedMotion: boolean
): string {
  const floatY = reducedMotion ? 0 : Math.sin(elapsedSeconds * 0.55) * 6;
  const tiltX = reducedMotion ? BASE_TILT_X : BASE_TILT_X + pointer.y * 5;
  const tiltY = reducedMotion ? BASE_TILT_Y : BASE_TILT_Y + pointer.x * 8;

  return `perspective(1200px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(${floatY}px)`;
}

export function useHeroTabletMotion(reducedMotion: boolean): HeroTabletMotion {
  const pointerRef = useRef<PointerState>({ x: 0, y: 0 });
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const [transform, setTransform] = useState(() =>
    buildTransform(0, pointerRef.current, reducedMotion)
  );

  useEffect(() => {
    if (reducedMotion) {
      setTransform(buildTransform(0, pointerRef.current, true));
      return undefined;
    }

    const tick = (timestamp: number) => {
      if (startRef.current === null) {
        startRef.current = timestamp;
      }
      const elapsed = (timestamp - startRef.current) / 1000;
      setTransform(buildTransform(elapsed, pointerRef.current, false));
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [reducedMotion]);

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    pointerRef.current = {
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y)),
    };
  }, []);

  const onPointerLeave = useCallback(() => {
    pointerRef.current = { x: 0, y: 0 };
  }, []);

  return { transform, onPointerMove, onPointerLeave };
}
