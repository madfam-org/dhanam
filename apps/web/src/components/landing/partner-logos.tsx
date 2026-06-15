/** Minimal wordmark-style SVG logos for landing partner strip (no emoji). */
const logos: Record<string, { label: string; viewBox: string; paths: string }> = {
  Belvo: {
    label: 'Belvo',
    viewBox: '0 0 120 32',
    paths:
      'M8 26V6h10c4.5 0 7.5 2.4 7.5 6.2S22.5 18.4 18 18.4H14v7.6H8zm6-12.2h3.2c1.8 0 2.8-.9 2.8-2.4s-1-2.4-2.8-2.4H14v4.8zM36 26l-4.8-8.2L26.4 26h-6.4l8.4-13.6L20 6h6.4l4.6 7.8L35.6 6H42l-8.2 13.2L42 26h-6zM48 26V6h6v20h-6zM62 26V6h6l9.2 12.4V6H83v20h-6L67.8 13.6V26h-5.8z',
  },
  Plaid: {
    label: 'Plaid',
    viewBox: '0 0 120 32',
    paths:
      'M10 26V6h8.4c5.6 0 9.2 3.2 9.2 8.2 0 3.4-1.8 6-4.8 7.2L30 26h-7l-6.2-4.2H16v4.2H10zm6-10.2h2.4c2.6 0 4-1.2 4-3.2s-1.4-3.2-4-3.2H16v6.4zM38 26V6h6v7.6h8.4V6H58v20h-6V15.2H43.6V26H38zM66 26V6h14v5.2H72v3.6h7.2v5H72v6.2H66z',
  },
  Bitso: {
    label: 'Bitso',
    viewBox: '0 0 120 32',
    paths:
      'M12 26c-4.4 0-7.2-2.8-7.2-7.4V6h6v12.2c0 2.2 1.2 3.4 3.2 3.4s3.2-1.2 3.2-3.4V6h6v12.6C23.2 23.2 20.4 26 16 26h-4zm22 0V6h6v14.8h8.4V26H34zM58 26V6h6l9.8 14.2V6h5.8v20h-6L64 11.8V26h-6z',
  },
  Zapper: {
    label: 'Zapper',
    viewBox: '0 0 120 32',
    paths:
      'M10 26 28 6h8L18 26H10zm14 0 18-20h8L32 26h-8zm18 0V6h6v20h-6zM68 26V6h6v14.4h8V26H68zM88 26V6h6v20h-6zM102 26V6h12v5h-6v3.4h5.4v4.6H108v7h-6z',
  },
  Zillow: {
    label: 'Zillow',
    viewBox: '0 0 120 32',
    paths:
      'M12 26 30 6h7.2L48 26h-6.8l-3.2-9.2H22l-3.2 9.2H12zm10.8-14.4-4.2 12h8.4l-4.2-12zM54 26V6h6v20h-6zm16 0V6h6l8.4 11.6V6h5.6v20h-6L75.6 14.4V26H70zM96 26V6h12v5h-6v3.4h5.4v4.6H102v7H96z',
  },
  Banxico: {
    label: 'Banxico',
    viewBox: '0 0 120 32',
    paths:
      'M10 26V6h7.2l7.8 12.4V6h5.6v20h-7.2L15.6 13.6V26H10zm28 0V6h6v20h-6zm14 0V6h6v7.2h8V6h6v20h-6v-7.6h-8V26h-6zm28 0-6-8.6c3.8-1.2 6-3.8 6-7.4 0-4.8-3.8-8-9.8-8H74v20h6V15.8h4.2l4.8 10.2h6.8zM80 11.2h3c2 0 3.2.8 3.2 2.2s-1.2 2.2-3.2 2.2H80v-4.4z',
  },
};

export function PartnerLogo({ name }: { name: string }) {
  const logo = logos[name];
  if (!logo) {
    return (
      <span className="text-sm font-semibold tracking-wide text-muted-foreground">{name}</span>
    );
  }

  return (
    <svg
      viewBox={logo.viewBox}
      role="img"
      aria-label={logo.label}
      className="h-7 w-auto fill-current text-muted-foreground transition-colors duration-200 group-hover:text-foreground"
    >
      <title>{logo.label}</title>
      <path d={logo.paths} />
    </svg>
  );
}
