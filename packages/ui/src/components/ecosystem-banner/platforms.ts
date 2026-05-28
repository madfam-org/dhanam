/**
 * MADFAM Ecosystem Platform List — Source of Truth
 *
 * Add/edit a platform here and it propagates to every landing that imports
 * `EcosystemBanner` from `@dhanam/ui`.
 *
 * Verified live on 2026-05-04 via HEAD probe (200/301/302/405-method-allowed).
 * PhyndCRM was omitted from the v1 default list because its apex domain was
 * not resolving at audit time. Re-add it once it is live by uncommenting the
 * entry below. Sim4D is bundled into Yantra4D, not listed independently.
 */
export interface EcosystemPlatform {
  /** Short uppercase keyword shown before the colon, e.g. "BUDGETING & WEALTH". */
  keyword: string;
  /** Platform display name shown after the colon, e.g. "Dhanam". */
  name: string;
  /** Apex domain URL, e.g. "https://dhan.am". No trailing slash. */
  url: string;
}

export const DEFAULT_ECOSYSTEM_PLATFORMS: readonly EcosystemPlatform[] = [
  { keyword: 'BUDGETING & WEALTH', name: 'Dhanam', url: 'https://dhan.am' },
  { keyword: 'AI AGENT OFFICE', name: 'Selva', url: 'https://selva.town' },
  { keyword: 'COMPLIANCE & CFDI', name: 'Karafiel', url: 'https://karafiel.mx' },
  { keyword: 'AUTHENTICATION', name: 'Janua', url: 'https://auth.madfam.io' },
  { keyword: 'DEPLOYMENT', name: 'Enclii', url: 'https://enclii.dev' },
  { keyword: 'LEGAL OPS', name: 'Tezca', url: 'https://tezca.mx' },
  { keyword: 'PHYGITAL FABRICATION', name: 'Yantra4D', url: 'https://yantra4d.com' },
  { keyword: 'QUOTING ENGINE', name: 'Cotiza', url: 'https://cotiza.studio' },
  { keyword: 'INDUSTRY INTELLIGENCE', name: 'Forgesight', url: 'https://forgesight.io' },
  { keyword: 'MANUFACTURING', name: 'Pravara', url: 'https://mes.madfam.io' },
  { keyword: 'GAMES', name: 'Rondelio', url: 'https://rondel.io' },
  { keyword: 'ROUTING & LOGISTICS', name: 'RouteCraft', url: 'https://routecraft.app' },
  // { keyword: 'CLIENT PORTAL & CRM', name: 'PhyndCRM', url: 'https://phynd-crm.madfam.io' }, // 2026-05-04: connection refused
] as const;
