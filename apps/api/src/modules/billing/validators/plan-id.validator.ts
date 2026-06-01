/**
 * Pattern-based plan ID validator for the MADFAM billing ecosystem.
 *
 * Accepts any plan following the convention:
 *   - Bare tiers: "essentials", "pro", "premium", "madfam"
 *   - Product-prefixed catalog tiers: "{product}_{tier}" (e.g., "karafiel_contador")
 *   - With billing period: "{product}_{tier}_{period}" (e.g., "karafiel_contador_yearly")
 *   - Legacy exact-match plans for backwards compatibility
 *
 * This validator only checks syntax. PriceResolver/ProductCatalogService remain
 * the source of truth for whether a product/tier actually exists.
 */

import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
  type ValidatorConstraintInterface,
  ValidatorConstraint,
} from 'class-validator';

const KNOWN_TIERS = new Set(['essentials', 'pro', 'premium', 'madfam', 'sovereign']);

const LEGACY_PLANS = new Set([
  'sovereign',
  'ecosystem',
  'enterprise',
  'scale',
  'enclii_sovereign',
  'enclii_ecosystem',
]);

const BILLING_PERIODS = new Set(['monthly', 'yearly', 'annual']);

const PRODUCT_RE = /^[a-z][a-z0-9-]*$/;
const CATALOG_TIER_RE = /^[a-z][a-z0-9_]*$/;

export function isValidPlanId(value: unknown): boolean {
  if (!value || typeof value !== 'string') return false;

  const v = value.toLowerCase();

  // Legacy exact-match plans (backwards compat)
  if (LEGACY_PLANS.has(v)) return true;

  // Bare tier names: "essentials", "pro", etc.
  if (KNOWN_TIERS.has(v)) return true;

  // Strip billing period suffix: "karafiel_pro_yearly" → "karafiel_pro"
  let core = v;
  for (const p of BILLING_PERIODS) {
    if (core.endsWith(`_${p}`)) {
      core = core.slice(0, -(p.length + 1));
      break;
    }
  }

  // Bare tier after stripping period: "pro_yearly" → "pro"
  if (KNOWN_TIERS.has(core)) return true;

  // {product}_{tier}: "karafiel_contador", "newservice_launch"
  // Existence is checked later by catalog-backed price resolution.
  const idx = core.indexOf('_');
  if (idx <= 0) return false;

  const product = core.slice(0, idx);
  const tier = core.slice(idx + 1);

  return PRODUCT_RE.test(product) && CATALOG_TIER_RE.test(tier);
}

@ValidatorConstraint({ name: 'isValidPlanId', async: false })
class IsValidPlanIdConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, _args: ValidationArguments): boolean {
    return isValidPlanId(value);
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'plan must be a valid plan ID ({product}_{tier} format, e.g. "karafiel_contador")';
  }
}

export function IsValidPlanId(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidPlanIdConstraint,
    });
  };
}

/** Validates a product name: lowercase alphanumeric, at least 1 char. */
export const PRODUCT_PATTERN = PRODUCT_RE;
