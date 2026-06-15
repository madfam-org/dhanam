import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Dhanam — Budget & Wealth Tracker';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 72,
        background: 'linear-gradient(145deg, #0f2e2a 0%, #1a4d45 45%, #f5f0e8 100%)',
        color: '#f5f0e8',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 28,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          opacity: 0.85,
          marginBottom: 24,
        }}
      >
        Dhanam
      </div>
      <div
        style={{
          fontSize: 64,
          fontWeight: 700,
          lineHeight: 1.1,
          maxWidth: 900,
          marginBottom: 24,
        }}
      >
        Your entire financial life. One platform.
      </div>
      <div style={{ fontSize: 28, opacity: 0.9, maxWidth: 820 }}>
        Budget, wealth, DeFi, and planning — built for LATAM by MADFAM
      </div>
    </div>,
    { ...size }
  );
}
