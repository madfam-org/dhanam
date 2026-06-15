import type { LandingPersonaKey } from '@/components/landing/persona-config';

const avatarStyles: Record<LandingPersonaKey, { bg: string; accent: string; silhouette: string }> =
  {
    maria: {
      bg: 'from-info/20 to-info/5',
      accent: 'bg-info',
      silhouette:
        'M28 52c0-8 6-14 14-14s14 6 14 14v6H28v-6z M42 24a10 10 0 1 1 0 20 10 10 0 0 1 0-20z',
    },
    carlos: {
      bg: 'from-success/20 to-success/5',
      accent: 'bg-success',
      silhouette:
        'M26 54c0-7 7-12 16-12s16 5 16 12v4H26v-4z M42 22a11 11 0 1 1 0 22 11 11 0 0 1 0-22z M34 38h16v4H34z',
    },
    diego: {
      bg: 'from-warning/25 to-primary/10',
      accent: 'bg-warning',
      silhouette:
        'M24 56c0-8 8-14 18-14s18 6 18 14v2H24v-2z M42 20a12 12 0 1 1 0 24 12 12 0 0 1 0-24z M36 34l12 8-4 2-8-10z',
    },
    patricia: {
      bg: 'from-primary/20 to-muted/30',
      accent: 'bg-primary',
      silhouette:
        'M27 55c0-9 7-15 15-15s15 6 15 15v5H27v-5z M42 21a10 10 0 1 1 0 20 10 10 0 0 1 0-20z M38 40c4 2 8 2 12 0',
    },
    sofia: {
      bg: 'from-info/15 to-warning/10',
      accent: 'bg-info',
      silhouette:
        'M25 56c0-8 9-14 17-14s17 6 17 14v2H25v-2z M42 19a11 11 0 1 1 0 22 11 11 0 0 1 0-22z M30 36h24M36 32l6-4 6 4',
    },
    roberto: {
      bg: 'from-success/15 to-info/10',
      accent: 'bg-success',
      silhouette:
        'M26 54c0-7 8-13 16-13s16 6 16 13v6H26v-6z M42 22a10 10 0 1 1 0 20 10 10 0 0 1 0-20z M34 42h16v3H34z',
    },
  };

interface PersonaAvatarProps {
  persona: LandingPersonaKey;
  className?: string;
}

export function PersonaAvatar({ persona, className = '' }: PersonaAvatarProps) {
  const style = avatarStyles[persona];

  return (
    <div
      className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br shadow-sm ${style.bg} ${className}`}
      aria-hidden
    >
      <span className={`absolute left-3 top-3 h-2 w-2 rounded-full ${style.accent} opacity-80`} />
      <svg viewBox="0 0 84 84" className="absolute inset-0 h-full w-full" role="presentation">
        <path d={style.silhouette} className="fill-foreground/75" />
      </svg>
    </div>
  );
}
