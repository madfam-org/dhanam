describe('hero tablet motion math', () => {
  function buildTransform(
    elapsedSeconds: number,
    pointer: { x: number; y: number },
    reducedMotion: boolean
  ): string {
    const BASE_TILT_X = 8;
    const BASE_TILT_Y = -4;
    const floatY = reducedMotion ? 0 : Math.sin(elapsedSeconds * 0.55) * 6;
    const tiltX = reducedMotion ? BASE_TILT_X : BASE_TILT_X + pointer.y * 5;
    const tiltY = reducedMotion ? BASE_TILT_Y : BASE_TILT_Y + pointer.x * 8;
    return `perspective(1200px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(${floatY}px)`;
  }

  it('freezes float when reduced motion is requested', () => {
    expect(buildTransform(2, { x: 0.5, y: -0.25 }, true)).toBe(
      'perspective(1200px) rotateX(8deg) rotateY(-4deg) translateY(0px)'
    );
  });

  it('applies pointer tilt when motion is enabled', () => {
    const transform = buildTransform(0, { x: 0.5, y: 0.5 }, false);
    expect(transform).toContain('rotateX(10.5deg)');
    expect(transform).toContain('rotateY(0deg)');
  });
});
