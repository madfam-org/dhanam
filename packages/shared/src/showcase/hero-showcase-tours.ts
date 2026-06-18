import type { ShowcaseTour } from './protocol';

/** Young professional — budgeting, AI categorization, cashflow. */
export const MARIA_HERO_TOUR: ShowcaseTour = {
  id: 'hero-maria',
  persona: 'maria',
  steps: [
    {
      id: 'maria-dashboard',
      path: '/dashboard',
      dwellMs: 6500,
      highlightTarget: 'net-worth',
      cursorPoints: [
        { x: 0.72, y: 0.38 },
        { x: 0.58, y: 0.42 },
      ],
    },
    {
      id: 'maria-transactions',
      path: '/transactions',
      dwellMs: 5500,
      scrollY: 80,
      highlightTarget: 'transactions-list',
    },
    {
      id: 'maria-budgets',
      path: '/budgets',
      dwellMs: 5500,
      highlightTarget: 'budgets-overview',
    },
    {
      id: 'maria-analytics',
      path: '/analytics',
      dwellMs: 5500,
      highlightTarget: 'analytics-chart',
    },
    {
      id: 'maria-goals',
      path: '/goals',
      dwellMs: 5000,
      highlightTarget: 'goals-summary',
    },
  ],
};

/** High net worth — wealth, projections, estate planning. */
export const PATRICIA_HERO_TOUR: ShowcaseTour = {
  id: 'hero-patricia',
  persona: 'patricia',
  steps: [
    {
      id: 'patricia-dashboard',
      path: '/dashboard',
      dwellMs: 6500,
      highlightTarget: 'net-worth',
      cursorPoints: [
        { x: 0.68, y: 0.35 },
        { x: 0.52, y: 0.4 },
      ],
    },
    {
      id: 'patricia-assets',
      path: '/assets',
      dwellMs: 6000,
      highlightTarget: 'assets-allocation',
    },
    {
      id: 'patricia-projections',
      path: '/projections',
      dwellMs: 6000,
      highlightTarget: 'projections-chart',
    },
    {
      id: 'patricia-scenarios',
      path: '/scenarios',
      dwellMs: 5500,
      highlightTarget: 'scenarios-panel',
    },
    {
      id: 'patricia-estate',
      path: '/estate-planning',
      dwellMs: 5500,
      highlightTarget: 'estate-overview',
    },
  ],
};

export const HERO_SHOWCASE_TOURS = [MARIA_HERO_TOUR, PATRICIA_HERO_TOUR] as const;

export function getHeroTourForPersona(persona: ShowcaseTour['persona']): ShowcaseTour {
  return persona === 'patricia' ? PATRICIA_HERO_TOUR : MARIA_HERO_TOUR;
}

/** Sidebar keys aligned with dashboard i18n `sidebar.*` — used by showcase tablet chrome. */
export const MARIA_SHOWCASE_NAV = [
  { key: 'dashboard', path: '/dashboard' },
  { key: 'transactions', path: '/transactions' },
  { key: 'budgets', path: '/budgets' },
  { key: 'analytics', path: '/analytics' },
  { key: 'goals', path: '/goals' },
] as const;

export const PATRICIA_SHOWCASE_NAV = [
  { key: 'dashboard', path: '/dashboard' },
  { key: 'assets', path: '/assets' },
  { key: 'projections', path: '/projections' },
  { key: 'scenarios', path: '/scenarios' },
  { key: 'estatePlanning', path: '/estate-planning' },
] as const;

export function getShowcaseNavForPersona(persona: ShowcaseTour['persona']) {
  return persona === 'patricia' ? PATRICIA_SHOWCASE_NAV : MARIA_SHOWCASE_NAV;
}
