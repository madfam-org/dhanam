/**
 * Raw CSV row from a MADFAM-style Google Sheet export.
 *
 * Column names match the Spanish headers exactly.
 */
export interface MadfamCsvRow {
  /** Unique transaction number (may be negative for pre-period rows) */
  No_Transaccion: string;
  /** Operation date in YYYY-MM-DD format */
  Fecha_Operacion: string;
  /** Original bank description / concept */
  Concepto_Original: string;
  /** Cleaned-up description with item details */
  Nota_Items: string;
  /** Income amount in MXN (may have comma formatting, e.g. "1,614.69") */
  Ingreso: string;
  /** Expense amount in MXN (may have comma formatting) */
  Egreso: string;
  /** Bank account name (e.g. "BBVA Empresarial", "Banamex Joy Personal") */
  Cuenta_Origen: string;
  /** Tax ID — business vs personal routing uses MADFAM_BUSINESS_RFC at import time */
  RFC: string;
  /** Original currency of the transaction (MXN or USD) */
  Moneda_Origen: string;
  /** Strategic category group (e.g. "I+D", "OpEx", "CapEx") */
  Categoria_Estrategica: string;
  /** Subcategory (e.g. "SaaS/AI", "Telefonía (Telcel)") */
  Subcategoria: string;
  /** Accounting classification tag */
  Clasificacion_Contable: string;
  /** Cut-off month label */
  Mes_Corte: string;
}

export type { SpaceRole } from './madfam-csv-config';

/** Account mapping result */
export interface AccountMapping {
  providerAccountId: string;
  name: string;
  type: 'checking' | 'credit';
}
