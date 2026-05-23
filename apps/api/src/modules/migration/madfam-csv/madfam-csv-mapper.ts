/**
 * Mapping functions for MADFAM CSV import.
 *
 * Converts raw CSV data into Dhanam-compatible entities.
 */
import type { MadfamCsvRoutingConfig, SpaceRole } from './madfam-csv-config';
import { loadMadfamCsvRoutingConfig } from './madfam-csv-config';
import type { MadfamCsvRow, AccountMapping } from './madfam-csv-types';

/** Canonical account definitions keyed by Cuenta_Origen (generic bank labels). */
const ACCOUNT_DEFS: Record<string, { slug: string; name: string; type: 'checking' | 'credit' }> = {
  'BBVA Empresarial': { slug: 'bbva-empresarial', name: 'BBVA Empresarial', type: 'checking' },
  'Banamex Joy Personal': {
    slug: 'banamex-joy',
    name: 'Banamex Joy Personal',
    type: 'checking',
  },
  'BBVA Azul Personal': { slug: 'bbva-azul', name: 'BBVA Azul Personal', type: 'credit' },
  'Banamex Oro Personal': { slug: 'banamex-oro', name: 'Banamex Oro Personal', type: 'credit' },
};

/**
 * Returns true if the RFC corresponds to the configured business entity.
 */
export function isBusinessRfc(
  rfc: string,
  config: MadfamCsvRoutingConfig = loadMadfamCsvRoutingConfig()
): boolean {
  if (!config.businessRfc) return false;
  return rfc.trim().toUpperCase() === config.businessRfc;
}

/**
 * Determine which space role a transaction routes to based on RFC and accounting classification.
 *
 * Routing rules:
 * - Business RFC (from config) → business
 * - Personal RFC + "Gasto No Deducible" → personal
 * - Personal RFC + anything else → partner
 */
export function routeToSpace(
  rfc: string,
  clasificacion: string,
  config: MadfamCsvRoutingConfig = loadMadfamCsvRoutingConfig()
): SpaceRole {
  if (isBusinessRfc(rfc, config)) return 'business';
  if (clasificacion.trim() === 'Gasto No Deducible') return 'personal';
  return 'partner';
}

/**
 * Resolve configured space slug for a routing role.
 */
export function spaceKeyForRole(
  role: SpaceRole,
  config: MadfamCsvRoutingConfig = loadMadfamCsvRoutingConfig()
): string {
  return config.spaceKeys[role];
}

/**
 * Map a Cuenta_Origen + space role to an account with unique providerAccountId.
 *
 * Partner/personal roles get a suffix on shared personal-bank accounts.
 *
 * @throws Error if the account name is not recognized
 */
export function mapAccount(
  cuentaOrigen: string,
  spaceRole: SpaceRole,
  config: MadfamCsvRoutingConfig = loadMadfamCsvRoutingConfig()
): AccountMapping {
  const def = ACCOUNT_DEFS[cuentaOrigen];
  if (!def) {
    throw new Error(`Unknown Cuenta_Origen: "${cuentaOrigen}"`);
  }

  let suffix = '';
  if (spaceRole === 'partner') suffix = config.accountSuffixes.partner;
  else if (spaceRole === 'personal') suffix = config.accountSuffixes.personal;

  return {
    providerAccountId: `madfam-csv-${def.slug}${suffix}`,
    name: def.name,
    type: def.type,
  };
}

/**
 * Parse a potentially comma-formatted number string to a float.
 * Strips commas before parsing (e.g. "1,614.69" → 1614.69).
 * Returns 0 for empty/whitespace-only strings.
 */
export function parseAmount(raw: string): number {
  const cleaned = (raw || '').replace(/,/g, '').trim();
  if (!cleaned) return 0;
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return num;
}

/**
 * Compute signed transaction amount.
 * Income (Ingreso) is positive, expense (Egreso) is negative.
 *
 * @returns signed amount, or null if both are zero
 */
export function mapAmount(ingreso: string, egreso: string): number | null {
  const inc = parseAmount(ingreso);
  const exp = parseAmount(egreso);
  if (inc > 0) return inc;
  if (exp > 0) return -exp;
  if (inc === 0 && exp === 0) return null;
  return 0;
}

/**
 * Parse a YYYY-MM-DD date string, setting time to noon UTC to avoid timezone drift.
 */
export function mapDate(fechaOperacion: string): Date {
  const trimmed = fechaOperacion.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`Invalid date format: "${fechaOperacion}" (expected YYYY-MM-DD)`);
  }
  return new Date(`${trimmed}T12:00:00Z`);
}

/**
 * Extract groupName and category name from Categoria_Estrategica and Subcategoria.
 */
export function parseGroupAndCategory(
  categoriaEstrategica: string,
  subcategoria: string
): { groupName: string; categoryName: string } {
  return {
    groupName: categoriaEstrategica.trim(),
    categoryName: subcategoria.trim(),
  };
}

/**
 * Determine if a category group is income-producing.
 * Only "Financiamiento" is income (treasury/capital inflows).
 */
export function isIncomeGroup(groupName: string): boolean {
  return groupName.startsWith('Financiamiento');
}

/**
 * Parse a single CSV line into column values, handling quoted fields.
 */
export function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        values.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  values.push(current);
  return values;
}

/**
 * Parse a CSV row from column values and header names.
 */
export function parseCsvRow(values: string[], headers: string[]): MadfamCsvRow {
  const row: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    row[headers[i]] = (values[i] || '').trim();
  }
  return row as unknown as MadfamCsvRow;
}

/**
 * Parse full CSV content into an array of MadfamCsvRow.
 */
export function parseCsv(content: string): MadfamCsvRow[] {
  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows: MadfamCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    rows.push(parseCsvRow(values, headers));
  }

  return rows;
}
