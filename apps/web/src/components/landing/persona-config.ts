import type { ChapterPreviewVariant } from '@/components/landing/product-chapter-preview';

export type LandingPersonaKey = 'maria' | 'carlos' | 'diego' | 'patricia' | 'sofia' | 'roberto';

export type DemoApiPersonaKey = 'maria' | 'carlos' | 'diego' | 'patricia';

export function resolveDemoPersonaKey(persona: LandingPersonaKey): DemoApiPersonaKey {
  if (persona === 'sofia') return 'patricia';
  if (persona === 'roberto') return 'carlos';
  return persona;
}

export const landingPersonas: {
  key: LandingPersonaKey;
  preview: ChapterPreviewVariant;
}[] = [
  { key: 'maria', preview: 'spending' },
  { key: 'carlos', preview: 'household' },
  { key: 'diego', preview: 'depth' },
  { key: 'patricia', preview: 'planning' },
  { key: 'sofia', preview: 'netWorth' },
  { key: 'roberto', preview: 'spending' },
];
