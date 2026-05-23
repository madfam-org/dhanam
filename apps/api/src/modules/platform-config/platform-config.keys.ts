/** Well-known platform config keys (non-secret operator settings). */
export const MADFAM_IMPORT_CONFIG_KEYS = {
  businessRfc: 'madfam.import.business_rfc',
  spaceNameBusiness: 'madfam.import.space_name.business',
  spaceNamePartner: 'madfam.import.space_name.partner',
  spaceNamePersonal: 'madfam.import.space_name.personal',
  accountSuffixPartner: 'madfam.import.account_suffix.partner',
  accountSuffixPersonal: 'madfam.import.account_suffix.personal',
} as const;

export type MadfamImportConfigKey =
  (typeof MADFAM_IMPORT_CONFIG_KEYS)[keyof typeof MADFAM_IMPORT_CONFIG_KEYS];

export const MADFAM_IMPORT_KEY_PREFIX = 'madfam.import.';

/** Map platform_config keys → import script env vars (env wins when already set). */
export const MADFAM_IMPORT_ENV_MAP: Record<MadfamImportConfigKey, string> = {
  [MADFAM_IMPORT_CONFIG_KEYS.businessRfc]: 'MADFAM_BUSINESS_RFC',
  [MADFAM_IMPORT_CONFIG_KEYS.spaceNameBusiness]: 'MADFAM_SPACE_NAME_BUSINESS',
  [MADFAM_IMPORT_CONFIG_KEYS.spaceNamePartner]: 'MADFAM_SPACE_NAME_PARTNER',
  [MADFAM_IMPORT_CONFIG_KEYS.spaceNamePersonal]: 'MADFAM_SPACE_NAME_PERSONAL',
  [MADFAM_IMPORT_CONFIG_KEYS.accountSuffixPartner]: 'MADFAM_ACCOUNT_SUFFIX_PARTNER',
  [MADFAM_IMPORT_CONFIG_KEYS.accountSuffixPersonal]: 'MADFAM_ACCOUNT_SUFFIX_PERSONAL',
};

export function jsonConfigToString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const inner = (value as { value: unknown }).value;
    return typeof inner === 'string' ? inner.trim() || null : String(inner);
  }
  return null;
}
