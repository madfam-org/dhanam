import { Test, TestingModule } from '@nestjs/testing';

import { createLoggerMock } from '../../../test/helpers/api-mock-factory';
import { R2StorageService } from '../storage/r2.service';

import { CsvPreviewService } from './csv-preview.service';

describe('CsvPreviewService', () => {
  let service: CsvPreviewService;
  let r2Storage: jest.Mocked<Pick<R2StorageService, 'downloadFile'>>;

  beforeEach(async () => {
    r2Storage = {
      downloadFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CsvPreviewService, { provide: R2StorageService, useValue: r2Storage }],
    }).compile();

    service = module.get<CsvPreviewService>(CsvPreviewService);
    (service as any).logger = createLoggerMock();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detectDelimiter', () => {
    it('should detect comma delimiter', () => {
      const content = 'a,b,c\n1,2,3\n4,5,6';
      expect(service.detectDelimiter(content)).toBe(',');
    });

    it('should detect semicolon delimiter', () => {
      const content = 'a;b;c\n1;2;3\n4;5;6';
      expect(service.detectDelimiter(content)).toBe(';');
    });

    it('should detect tab delimiter', () => {
      const content = 'a\tb\tc\n1\t2\t3\n4\t5\t6';
      expect(service.detectDelimiter(content)).toBe('\t');
    });

    it('should detect pipe delimiter', () => {
      const content = 'a|b|c\n1|2|3\n4|5|6';
      expect(service.detectDelimiter(content)).toBe('|');
    });

    it('should default to comma for empty string', () => {
      expect(service.detectDelimiter('')).toBe(',');
    });

    it('should handle mixed delimiters and pick the most frequent', () => {
      // 2 semicolons per line, 1 comma per line
      const content = 'a;b;c,d\n1;2;3,4\n5;6;7,8';
      expect(service.detectDelimiter(content)).toBe(';');
    });

    it('should only check first 5 lines', () => {
      const lines = Array(10).fill('a|b|c').join('\n');
      // All 10 lines have pipes, but only first 5 are checked
      // Should still detect pipe
      expect(service.detectDelimiter(lines)).toBe('|');
    });
  });

  describe('generatePreview', () => {
    it('should parse a standard CSV file', async () => {
      const csv = 'name,age,city\nAlice,30,NYC\nBob,25,LA\nCharlie,35,SF';
      r2Storage.downloadFile.mockResolvedValue(Buffer.from(csv));

      const result = await service.generatePreview('test.csv');

      expect(result.headers).toEqual(['name', 'age', 'city']);
      expect(result.rows).toHaveLength(3);
      expect(result.rows[0]).toEqual(['Alice', '30', 'NYC']);
      expect(result.totalRows).toBe(3);
      expect(result.delimiter).toBe(',');
      expect(result.previewRowCount).toBe(3);
    });

    it('should respect maxRows limit', async () => {
      const rows = ['h1,h2'];
      for (let i = 0; i < 50; i++) rows.push(`v${i},v${i}`);
      r2Storage.downloadFile.mockResolvedValue(Buffer.from(rows.join('\n')));

      const result = await service.generatePreview('test.csv', 5);

      expect(result.rows).toHaveLength(5);
      expect(result.totalRows).toBe(50);
      expect(result.previewRowCount).toBe(5);
    });

    it('should count totalRows excluding header', async () => {
      const csv = 'h1,h2\nr1c1,r1c2\nr2c1,r2c2';
      r2Storage.downloadFile.mockResolvedValue(Buffer.from(csv));

      const result = await service.generatePreview('test.csv');

      expect(result.totalRows).toBe(2);
    });

    it('should handle header-only CSV', async () => {
      const csv = 'col1,col2,col3';
      r2Storage.downloadFile.mockResolvedValue(Buffer.from(csv));

      const result = await service.generatePreview('test.csv');

      expect(result.headers).toEqual(['col1', 'col2', 'col3']);
      expect(result.rows).toHaveLength(0);
      expect(result.totalRows).toBe(0);
      expect(result.previewRowCount).toBe(0);
    });

    it('should auto-detect semicolon delimiter', async () => {
      const csv = 'name;age;city\nAlice;30;NYC\nBob;25;LA';
      r2Storage.downloadFile.mockResolvedValue(Buffer.from(csv));

      const result = await service.generatePreview('test.csv');

      expect(result.delimiter).toBe(';');
      expect(result.headers).toEqual(['name', 'age', 'city']);
      expect(result.rows[0]).toEqual(['Alice', '30', 'NYC']);
    });

    it('should propagate R2 download errors', async () => {
      r2Storage.downloadFile.mockRejectedValue(new Error('R2 unavailable'));

      await expect(service.generatePreview('test.csv')).rejects.toThrow('R2 unavailable');
    });

    it('should reject on CSV parse errors (invalid content)', async () => {
      // Create content that will cause a parse error by using inconsistent quoting
      const badCsv = 'h1,h2\n"unclosed quote,val';
      r2Storage.downloadFile.mockResolvedValue(Buffer.from(badCsv));

      await expect(service.generatePreview('test.csv')).rejects.toThrow();
    });

    it('should handle CSV with empty lines (skip_empty_lines)', async () => {
      const csv = 'h1,h2\n\nval1,val2\n\nval3,val4';
      r2Storage.downloadFile.mockResolvedValue(Buffer.from(csv));

      const result = await service.generatePreview('test.csv');

      expect(result.headers).toEqual(['h1', 'h2']);
      expect(result.rows).toHaveLength(2);
      expect(result.totalRows).toBe(2);
    });

    it('should use default maxRows of 20', async () => {
      const rows = ['h1,h2'];
      for (let i = 0; i < 30; i++) rows.push(`v${i},v${i}`);
      r2Storage.downloadFile.mockResolvedValue(Buffer.from(rows.join('\n')));

      const result = await service.generatePreview('test.csv');

      expect(result.rows).toHaveLength(20);
      expect(result.totalRows).toBe(30);
    });
  });
});
