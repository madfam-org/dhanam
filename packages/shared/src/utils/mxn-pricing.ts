/** Mexican IVA (VAT) rate for consumer SaaS display and CFDI alignment. */
export const MXN_IVA_RATE = 0.16;

export const MXN_PRICING_RULE = 'ceil_whole_peso_iva' as const;

export type MxnPricingRule = typeof MXN_PRICING_RULE;

export interface MxnGrossBreakdown {
  netCentavos: number;
  ivaCentavos: number;
  grossCentavos: number;
  netMajor: number;
  ivaMajor: number;
  grossMajor: number;
}

/**
 * Tulana/catalog net centavos → customer-facing gross centavos.
 * Always rounds UP to the nearest whole peso (MADFAM MX convention).
 */
export function mxnGrossCentavosFromNet(netCentavos: number): number {
  if (!Number.isFinite(netCentavos) || netCentavos < 0) {
    throw new RangeError(`Invalid net centavos: ${netCentavos}`);
  }
  const netMajor = netCentavos / 100;
  const grossMajor = Math.ceil(netMajor * (1 + MXN_IVA_RATE));
  return grossMajor * 100;
}

/**
 * Split an IVA-inclusive gross (whole-peso charge) into net + IVA for ledger/CFDI.
 * Values are rounded to centavos (2 decimal pesos).
 */
export function mxnSplitGrossCentavos(grossCentavos: number): MxnGrossBreakdown {
  if (!Number.isFinite(grossCentavos) || grossCentavos < 0) {
    throw new RangeError(`Invalid gross centavos: ${grossCentavos}`);
  }
  const grossMajor = round2(grossCentavos / 100);
  const netMajor = round2(grossMajor / (1 + MXN_IVA_RATE));
  const ivaMajor = round2(grossMajor - netMajor);
  return {
    netCentavos: Math.round(netMajor * 100),
    ivaCentavos: Math.round(ivaMajor * 100),
    grossCentavos: Math.round(grossMajor * 100),
    netMajor,
    ivaMajor,
    grossMajor,
  };
}

/** Major-unit display price for MXN tiers (IVA-inclusive, whole peso). */
export function mxnGrossMajorFromNetCentavos(netCentavos: number): number {
  return mxnGrossCentavosFromNet(netCentavos) / 100;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
