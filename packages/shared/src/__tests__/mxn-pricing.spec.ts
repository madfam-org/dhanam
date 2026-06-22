import {
  MXN_IVA_RATE,
  mxnGrossCentavosFromNet,
  mxnGrossMajorFromNetCentavos,
  mxnSplitGrossCentavos,
} from '../utils/mxn-pricing';

describe('mxn-pricing', () => {
  describe('mxnGrossCentavosFromNet', () => {
    it('Essentials monthly: 7900 net → 9200 gross', () => {
      expect(mxnGrossCentavosFromNet(7900)).toBe(9200);
      expect(mxnGrossMajorFromNetCentavos(7900)).toBe(92);
    });

    it('Essentials yearly: 75900 net → 88100 gross', () => {
      expect(mxnGrossCentavosFromNet(75900)).toBe(88100);
    });

    it('Pro monthly: 29900 net → 34700 gross', () => {
      expect(mxnGrossCentavosFromNet(29900)).toBe(34700);
    });

    it('Premium monthly: 49900 net → 57900 gross', () => {
      expect(mxnGrossCentavosFromNet(49900)).toBe(57900);
    });

    it('rounds up at fractional peso boundary (MXN 1.00 net → MXN 2.00 gross)', () => {
      expect(mxnGrossCentavosFromNet(100)).toBe(200);
    });
  });

  describe('mxnSplitGrossCentavos', () => {
    it('Essentials charge: 9200 gross → net 7931 + iva 1269', () => {
      const split = mxnSplitGrossCentavos(9200);
      expect(split.grossMajor).toBe(92);
      expect(split.netMajor).toBe(79.31);
      expect(split.ivaMajor).toBe(12.69);
      expect(split.netMajor + split.ivaMajor).toBeCloseTo(92, 2);
      expect(split.ivaMajor / split.netMajor).toBeCloseTo(MXN_IVA_RATE, 2);
    });

    it('rejects negative amounts', () => {
      expect(() => mxnSplitGrossCentavos(-1)).toThrow(RangeError);
    });
  });
});
