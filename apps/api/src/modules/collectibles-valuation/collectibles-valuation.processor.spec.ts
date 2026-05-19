import { CollectiblesValuationProcessor } from './collectibles-valuation.processor';
import { CollectiblesValuationService } from './collectibles-valuation.service';

describe('CollectiblesValuationProcessor', () => {
  let processor: CollectiblesValuationProcessor;

  const mockService = {
    refreshAsset: jest.fn(),
    getAllLinkedAssets: jest.fn(),
  };

  beforeEach(() => {
    processor = new CollectiblesValuationProcessor(
      mockService as unknown as CollectiblesValuationService
    );
    jest.clearAllMocks();
  });

  describe('process', () => {
    it('should call refreshAsset for refresh-single job', async () => {
      mockService.refreshAsset.mockResolvedValue({ success: true });

      const job = {
        name: 'refresh-single',
        data: { assetId: 'a1', spaceId: 's1' },
      } as any;

      await processor.process(job);

      expect(mockService.refreshAsset).toHaveBeenCalledWith('s1', 'a1');
    });

    it('should call getAllLinkedAssets then refreshAsset for each on refresh-all', async () => {
      mockService.getAllLinkedAssets.mockResolvedValue([
        { id: 'a1', spaceId: 's1' },
        { id: 'a2', spaceId: 's2' },
      ]);
      mockService.refreshAsset.mockResolvedValue({ success: true });

      const job = { name: 'refresh-all', data: { triggeredBy: 'cron' } } as any;

      const result = await processor.process(job);

      expect(mockService.getAllLinkedAssets).toHaveBeenCalled();
      expect(mockService.refreshAsset).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ total: 2, success: 2, failed: 0 });
    });

    it('should count successes and failures correctly', async () => {
      mockService.getAllLinkedAssets.mockResolvedValue([
        { id: 'a1', spaceId: 's1' },
        { id: 'a2', spaceId: 's2' },
        { id: 'a3', spaceId: 's3' },
      ]);
      mockService.refreshAsset
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: 'fail' })
        .mockResolvedValueOnce({ success: true });

      const job = { name: 'refresh-all', data: { triggeredBy: 'manual' } } as any;

      const result = await processor.process(job);

      expect(result).toEqual({ total: 3, success: 2, failed: 1 });
    });

    it('should not throw for unknown job name', async () => {
      const job = { name: 'unknown-job', data: {} } as any;

      await expect(processor.process(job)).resolves.toBeUndefined();
    });
  });
});
