import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';

import { PrismaService } from '@core/prisma/prisma.service';
import { RedisService } from '@core/redis/redis.service';
import { Currency } from '@db';

import { FxRatesService } from './fx-rates.service';

describe('FxRatesService', () => {
  let service: FxRatesService;
  let prisma: jest.Mocked<PrismaService>;
  let redisService: jest.Mocked<RedisService>;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;

  const mockBanxicoResponse = {
    data: {
      bmx: {
        series: [
          {
            idSerie: 'SF43718',
            titulo: 'USD/MXN',
            datos: [
              {
                fecha: '2025-01-15',
                dato: '17.25',
              },
            ],
          },
        ],
      },
    },
  };

  beforeEach(async () => {
    const mockPrisma = {
      exchangeRate: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const mockHttpService = {
      get: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'BANXICO_API_TOKEN') return 'test-token';
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FxRatesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedisService },
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<FxRatesService>(FxRatesService);
    prisma = module.get(PrismaService);
    redisService = module.get(RedisService);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getExchangeRate', () => {
    it('should return 1 for same currency pair', async () => {
      const rate = await service.getExchangeRate(Currency.USD, Currency.USD);

      expect(rate).toBe(1);
      expect(redisService.get).not.toHaveBeenCalled();
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('should return cached rate if available', async () => {
      redisService.get.mockResolvedValue('17.25');

      const rate = await service.getExchangeRate(Currency.USD, Currency.MXN);

      expect(rate).toBe(17.25);
      expect(redisService.get).toHaveBeenCalledWith(expect.stringContaining('fx:USD:MXN'));
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('should fetch USD to MXN rate from Banxico API', async () => {
      redisService.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(of(mockBanxicoResponse) as any);
      prisma.exchangeRate.upsert.mockResolvedValue({} as any);

      const rate = await service.getExchangeRate(Currency.USD, Currency.MXN);

      expect(rate).toBe(17.25);
      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('SF43718'),
        expect.objectContaining({
          headers: { Accept: 'application/json' },
        })
      );
      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringContaining('fx:USD:MXN'),
        '17.25',
        3600
      );
    });

    it('should calculate inverse rate for MXN to USD', async () => {
      redisService.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(of(mockBanxicoResponse) as any);
      prisma.exchangeRate.upsert.mockResolvedValue({} as any);

      const rate = await service.getExchangeRate(Currency.MXN, Currency.USD);

      // Inverse of 17.25
      expect(rate).toBeCloseTo(1 / 17.25, 5);
    });

    it('should fetch EUR to MXN rate from Banxico API', async () => {
      redisService.get.mockResolvedValue(null);
      const eurResponse = {
        data: {
          bmx: {
            series: [
              {
                idSerie: 'SF46410',
                titulo: 'EUR/MXN',
                datos: [{ fecha: '2025-01-15', dato: '19.50' }],
              },
            ],
          },
        },
      };
      httpService.get.mockReturnValue(of(eurResponse) as any);
      prisma.exchangeRate.upsert.mockResolvedValue({} as any);

      const rate = await service.getExchangeRate(Currency.EUR, Currency.MXN);

      expect(rate).toBe(19.5);
      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('SF46410'),
        expect.any(Object)
      );
    });

    it('should calculate cross rate for USD to EUR', async () => {
      redisService.get.mockResolvedValue(null);
      httpService.get
        .mockReturnValueOnce(of(mockBanxicoResponse) as any) // USD to MXN
        .mockReturnValueOnce(
          of({
            data: {
              bmx: {
                series: [
                  {
                    idSerie: 'SF46410',
                    datos: [{ fecha: '2025-01-15', dato: '19.50' }],
                  },
                ],
              },
            },
          }) as any
        ); // EUR to MXN

      prisma.exchangeRate.upsert.mockResolvedValue({} as any);

      const rate = await service.getExchangeRate(Currency.USD, Currency.EUR);

      // USD to EUR = USD to MXN / EUR to MXN = 17.25 / 19.50
      expect(rate).toBeCloseTo(17.25 / 19.5, 5);
    });

    it('should calculate inverse rate for MXN to EUR', async () => {
      redisService.get.mockResolvedValue(null);
      const eurMxnResponse = {
        data: {
          bmx: {
            series: [
              {
                idSerie: 'SF46410',
                titulo: 'EUR/MXN',
                datos: [{ fecha: '2025-01-15', dato: '19.50' }],
              },
            ],
          },
        },
      };
      httpService.get.mockReturnValue(of(eurMxnResponse) as any);
      prisma.exchangeRate.upsert.mockResolvedValue({} as any);

      const rate = await service.getExchangeRate(Currency.MXN, Currency.EUR);

      // MXN to EUR is inverse of EUR to MXN (1/19.50)
      expect(rate).toBeCloseTo(1 / 19.5, 5);
    });

    it('should calculate cross rate for EUR to USD', async () => {
      redisService.get.mockResolvedValue(null);
      httpService.get
        .mockReturnValueOnce(of(mockBanxicoResponse) as any) // USD to MXN (17.25)
        .mockReturnValueOnce(
          of({
            data: {
              bmx: {
                series: [
                  {
                    idSerie: 'SF46410',
                    datos: [{ fecha: '2025-01-15', dato: '19.50' }],
                  },
                ],
              },
            },
          }) as any
        ); // EUR to MXN (19.50)

      prisma.exchangeRate.upsert.mockResolvedValue({} as any);

      const rate = await service.getExchangeRate(Currency.EUR, Currency.USD);

      // EUR to USD = EUR to MXN / USD to MXN = 19.50 / 17.25
      expect(rate).toBeCloseTo(19.5 / 17.25, 5);
    });

    it('should store exchange rate in database', async () => {
      redisService.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(of(mockBanxicoResponse) as any);
      prisma.exchangeRate.upsert.mockResolvedValue({} as any);

      await service.getExchangeRate(Currency.USD, Currency.MXN);

      expect(prisma.exchangeRate.upsert).toHaveBeenCalledWith({
        where: {
          fromCurrency_toCurrency_date: {
            fromCurrency: Currency.USD,
            toCurrency: Currency.MXN,
            date: expect.any(Date),
          },
        },
        update: {
          rate: 17.25,
          source: 'banxico',
          updatedAt: expect.any(Date),
        },
        create: expect.objectContaining({
          fromCurrency: Currency.USD,
          toCurrency: Currency.MXN,
          rate: 17.25,
          source: 'banxico',
        }),
      });
    });

    it('should use database fallback if API fails', async () => {
      redisService.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(throwError(() => new Error('API Error')) as any);
      prisma.exchangeRate.findFirst.mockResolvedValue({
        rate: 17.0,
        fromCurrency: Currency.USD,
        toCurrency: Currency.MXN,
      } as any);

      const rate = await service.getExchangeRate(Currency.USD, Currency.MXN);

      expect(rate).toBe(17.0);
      expect(prisma.exchangeRate.findFirst).toHaveBeenCalledWith({
        where: {
          fromCurrency: Currency.USD,
          toCurrency: Currency.MXN,
        },
        orderBy: {
          date: 'desc',
        },
      });
    });

    it('should use hardcoded fallback if database also fails', async () => {
      redisService.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(throwError(() => new Error('API Error')) as any);
      prisma.exchangeRate.findFirst.mockResolvedValue(null);

      const rate = await service.getExchangeRate(Currency.USD, Currency.MXN);

      // Hardcoded fallback for USD_MXN
      expect(rate).toBe(17.5);
    });

    it('should handle historical date queries', async () => {
      redisService.get.mockResolvedValue(null);
      const historicalDate = new Date('2025-01-10');
      httpService.get.mockReturnValue(of(mockBanxicoResponse) as any);
      prisma.exchangeRate.upsert.mockResolvedValue({} as any);

      await service.getExchangeRate(Currency.USD, Currency.MXN, historicalDate);

      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('2025-01-10'),
        expect.any(Object)
      );
    });
  });

  describe('convertAmount', () => {
    it('should convert amount using exchange rate', async () => {
      redisService.get.mockResolvedValue('17.25');

      const result = await service.convertAmount(100, Currency.USD, Currency.MXN);

      // 100 USD * 17.25 = 1725 MXN
      expect(result).toBe(1725);
    });

    it('should round result to 2 decimal places', async () => {
      redisService.get.mockResolvedValue('17.257');

      const result = await service.convertAmount(100, Currency.USD, Currency.MXN);

      // 100 * 17.257 = 1725.7 (rounded)
      expect(result).toBe(1725.7);
    });

    it('should handle decimal amounts', async () => {
      redisService.get.mockResolvedValue('17.25');

      const result = await service.convertAmount(123.45, Currency.USD, Currency.MXN);

      // 123.45 * 17.25 = 2129.51
      expect(result).toBeCloseTo(2129.51, 2);
    });

    it('should convert same currency without rate lookup', async () => {
      const result = await service.convertAmount(100, Currency.USD, Currency.USD);

      expect(result).toBe(100);
      expect(redisService.get).not.toHaveBeenCalled();
    });

    it('should pass date parameter to getExchangeRate', async () => {
      redisService.get.mockResolvedValue('17.25');
      const historicalDate = new Date('2025-01-10');

      await service.convertAmount(100, Currency.USD, Currency.MXN, historicalDate);

      expect(redisService.get).toHaveBeenCalledWith(expect.stringContaining('2025-01-10'));
    });
  });

  describe('getHistoricalRates', () => {
    it('should return historical rates for date range', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-15');

      const mockRates = [
        {
          fromCurrency: Currency.USD,
          toCurrency: Currency.MXN,
          rate: 17.2,
          date: new Date('2025-01-01'),
          source: 'banxico',
        },
        {
          fromCurrency: Currency.USD,
          toCurrency: Currency.MXN,
          rate: 17.25,
          date: new Date('2025-01-15'),
          source: 'banxico',
        },
      ];

      prisma.exchangeRate.findMany.mockResolvedValue(mockRates as any);

      const result = await service.getHistoricalRates(
        Currency.USD,
        Currency.MXN,
        startDate,
        endDate
      );

      expect(prisma.exchangeRate.findMany).toHaveBeenCalledWith({
        where: {
          fromCurrency: Currency.USD,
          toCurrency: Currency.MXN,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          date: 'asc',
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0].rate).toBe(17.2);
      expect(result[1].rate).toBe(17.25);
    });

    it('should return empty array if no historical data exists', async () => {
      prisma.exchangeRate.findMany.mockResolvedValue([]);

      const result = await service.getHistoricalRates(
        Currency.USD,
        Currency.MXN,
        new Date('2025-01-01'),
        new Date('2025-01-15')
      );

      expect(result).toEqual([]);
    });

    it('should order results by date ascending', async () => {
      prisma.exchangeRate.findMany.mockResolvedValue([] as any);

      await service.getHistoricalRates(
        Currency.USD,
        Currency.MXN,
        new Date('2025-01-01'),
        new Date('2025-01-15')
      );

      expect(prisma.exchangeRate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { date: 'asc' },
        })
      );
    });
  });

  describe('getSupportedCurrencies', () => {
    it('should return list of supported currencies', async () => {
      const currencies = await service.getSupportedCurrencies();

      expect(currencies).toContain(Currency.MXN);
      expect(currencies).toContain(Currency.USD);
      expect(currencies).toContain(Currency.EUR);
      expect(currencies).toHaveLength(3);
    });
  });

  describe('updateExchangeRates (cron job)', () => {
    it('should update all major currency pairs', async () => {
      redisService.get.mockResolvedValue(null);
      httpService.get.mockReturnValueOnce(of(mockBanxicoResponse) as any).mockReturnValueOnce(
        of({
          data: {
            bmx: {
              series: [
                {
                  idSerie: 'SF46410',
                  datos: [{ fecha: '2025-01-15', dato: '19.50' }],
                },
              ],
            },
          },
        }) as any
      );

      prisma.exchangeRate.upsert.mockResolvedValue({} as any);

      await service.updateExchangeRates();

      // Should call API twice (USD/MXN and EUR/MXN)
      expect(httpService.get).toHaveBeenCalledTimes(2);
    });

    it('should not throw if update fails', async () => {
      redisService.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(throwError(() => new Error('API Error')) as any);
      prisma.exchangeRate.findFirst.mockResolvedValue(null);

      // Should not throw
      await expect(service.updateExchangeRates()).resolves.not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle no Banxico token configured', async () => {
      const noTokenConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'BANXICO_API_TOKEN') return '';
          return '';
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          FxRatesService,
          { provide: PrismaService, useValue: prisma },
          { provide: RedisService, useValue: redisService },
          { provide: HttpService, useValue: httpService },
          { provide: ConfigService, useValue: noTokenConfigService },
        ],
      }).compile();

      const serviceNoToken = module.get<FxRatesService>(FxRatesService);

      redisService.get.mockResolvedValue(null);
      prisma.exchangeRate.findFirst.mockResolvedValue(null);

      const rate = await serviceNoToken.getExchangeRate(Currency.USD, Currency.MXN);

      // Should fall back to hardcoded rate
      expect(rate).toBe(17.5);
    });

    it('should handle malformed Banxico API response', async () => {
      redisService.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(
        of({
          data: {
            bmx: {
              series: [
                {
                  idSerie: 'SF43718',
                  datos: [], // Empty data array
                },
              ],
            },
          },
        }) as any
      );

      prisma.exchangeRate.findFirst.mockResolvedValue(null);

      const rate = await service.getExchangeRate(Currency.USD, Currency.MXN);

      // Should fall back to hardcoded rate
      expect(rate).toBe(17.5);
    });

    it('should handle very small amounts in conversion', async () => {
      redisService.get.mockResolvedValue('17.25');

      const result = await service.convertAmount(0.01, Currency.USD, Currency.MXN);

      expect(result).toBeCloseTo(0.17, 2);
    });

    it('should handle very large amounts in conversion', async () => {
      redisService.get.mockResolvedValue('17.25');

      const result = await service.convertAmount(1000000, Currency.USD, Currency.MXN);

      expect(result).toBe(17250000);
    });

    it('should cache rates with appropriate TTL', async () => {
      redisService.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(of(mockBanxicoResponse) as any);
      prisma.exchangeRate.upsert.mockResolvedValue({} as any);

      await service.getExchangeRate(Currency.USD, Currency.MXN);

      expect(redisService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        3600 // 1 hour TTL
      );
    });

    it('should handle unsupported currency pairs with fallback', async () => {
      redisService.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(throwError(() => new Error('Unsupported pair')) as any);
      prisma.exchangeRate.findFirst.mockResolvedValue(null);

      // GBP is not in supported currencies
      const rate = await service.getExchangeRate('GBP' as Currency, Currency.MXN);

      // Should return fallback of 1
      expect(rate).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should log error and use fallback when API fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      redisService.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(throwError(() => new Error('Network Error')) as any);
      prisma.exchangeRate.findFirst.mockResolvedValue(null);

      const rate = await service.getExchangeRate(Currency.USD, Currency.MXN);

      expect(rate).toBe(17.5); // Fallback
      consoleSpy.mockRestore();
    });

    it('should handle database errors gracefully during storage', async () => {
      redisService.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(of(mockBanxicoResponse) as any);
      prisma.exchangeRate.upsert.mockRejectedValue(new Error('DB Error'));

      // Should not throw even if storage fails
      const rate = await service.getExchangeRate(Currency.USD, Currency.MXN);

      expect(rate).toBe(17.25);
    });

    it('should propagate Redis errors (cache check is not guarded)', async () => {
      // Reset mocks to ensure clean state
      jest.clearAllMocks();

      redisService.get.mockRejectedValue(new Error('Redis connection failed'));

      // Note: The service does not have try-catch around the initial Redis get call
      // so Redis errors will propagate. This is expected behavior for cache failures
      // that should be handled at a higher level.
      await expect(service.getExchangeRate(Currency.USD, Currency.MXN)).rejects.toThrow(
        'Redis connection failed'
      );
    });
  });

  describe('getBanxicoRate edge cases', () => {
    it('should handle API response with missing dato field (line 152 fallback)', async () => {
      redisService.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(
        of({
          data: {
            bmx: {
              series: [
                {
                  idSerie: 'SF43718',
                  datos: [{ fecha: '2025-01-15' }], // dato field missing
                },
              ],
            },
          },
        }) as any
      );
      prisma.exchangeRate.upsert.mockResolvedValue({} as any);

      const rate = await service.getExchangeRate(Currency.USD, Currency.MXN);

      // Should default to 1 when dato is undefined
      expect(rate).toBe(1);
    });

    it('should handle API response with null series (line 147 branch)', async () => {
      redisService.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(
        of({
          data: {
            bmx: {
              series: [null], // Series is null
            },
          },
        }) as any
      );
      prisma.exchangeRate.findFirst.mockResolvedValue(null);

      const rate = await service.getExchangeRate(Currency.USD, Currency.MXN);

      // Should fall back to hardcoded rate
      expect(rate).toBe(17.5);
    });
  });

  describe('getLatestFromDatabase edge cases', () => {
    it('should return null when rate property is undefined (line 188 branch)', async () => {
      redisService.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(throwError(() => new Error('API Error')) as any);
      // Return object without rate property
      prisma.exchangeRate.findFirst.mockResolvedValue({
        fromCurrency: Currency.USD,
        toCurrency: Currency.MXN,
        date: new Date(),
        // rate is undefined
      } as any);

      const rate = await service.getExchangeRate(Currency.USD, Currency.MXN);

      // Should fall back to hardcoded rate because rate is undefined
      expect(rate).toBe(17.5);
    });
  });

  describe('getFallbackRate edge cases', () => {
    it('should return 1 for unknown currency pair (line 171 fallback)', async () => {
      redisService.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(throwError(() => new Error('API Error')) as any);
      prisma.exchangeRate.findFirst.mockResolvedValue(null);

      // BTC is not a supported currency, so fallback key won't exist
      const rate = await service.getExchangeRate('BTC' as Currency, 'ETH' as Currency);

      // Should return default of 1
      expect(rate).toBe(1);
    });

    it('should return hardcoded rate for EUR_USD', async () => {
      redisService.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(throwError(() => new Error('API Error')) as any);
      prisma.exchangeRate.findFirst.mockResolvedValue(null);

      const rate = await service.getExchangeRate(Currency.EUR, Currency.USD);

      // Should return hardcoded EUR_USD fallback of 1.1
      expect(rate).toBe(1.1);
    });

    it('should return hardcoded rate for MXN_EUR', async () => {
      redisService.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(throwError(() => new Error('API Error')) as any);
      prisma.exchangeRate.findFirst.mockResolvedValue(null);

      const rate = await service.getExchangeRate(Currency.MXN, Currency.EUR);

      // Should return hardcoded MXN_EUR fallback of 0.052
      expect(rate).toBe(0.052);
    });

    it('should return hardcoded rate for MXN_USD', async () => {
      redisService.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(throwError(() => new Error('API Error')) as any);
      prisma.exchangeRate.findFirst.mockResolvedValue(null);

      const rate = await service.getExchangeRate(Currency.MXN, Currency.USD);

      // Should return hardcoded MXN_USD fallback of 0.057
      expect(rate).toBe(0.057);
    });
  });
});
