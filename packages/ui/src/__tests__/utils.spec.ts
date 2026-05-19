import { cn } from '../lib/utils';

describe('cn utility', () => {
  describe('basic class merging', () => {
    it('should merge multiple class strings', () => {
      const result = cn('class1', 'class2', 'class3');
      expect(result).toBe('class1 class2 class3');
    });

    it('should handle single class', () => {
      const result = cn('single-class');
      expect(result).toBe('single-class');
    });

    it('should handle empty input', () => {
      const result = cn();
      expect(result).toBe('');
    });

    it('should handle undefined and null values', () => {
      const result = cn('class1', undefined, null, 'class2');
      expect(result).toBe('class1 class2');
    });

    it('should handle false values', () => {
      const result = cn('class1', false, 'class2');
      expect(result).toBe('class1 class2');
    });
  });

  describe('conditional classes', () => {
    it('should handle boolean conditions', () => {
      const isActive = true;
      const result = cn('base', isActive && 'active');
      expect(result).toBe('base active');
    });

    it('should skip false conditions', () => {
      const isActive = false;
      const result = cn('base', isActive && 'active');
      expect(result).toBe('base');
    });

    it('should handle object syntax', () => {
      const result = cn({
        'class-a': true,
        'class-b': false,
        'class-c': true,
      });
      expect(result).toBe('class-a class-c');
    });
  });

  describe('tailwind merge functionality', () => {
    it('should merge conflicting padding classes', () => {
      const result = cn('p-4', 'p-6');
      expect(result).toBe('p-6');
    });

    it('should merge conflicting margin classes', () => {
      const result = cn('m-2', 'm-4');
      expect(result).toBe('m-4');
    });

    it('should merge conflicting text color classes', () => {
      const result = cn('text-red-500', 'text-blue-500');
      expect(result).toBe('text-blue-500');
    });

    it('should merge conflicting background classes', () => {
      const result = cn('bg-white', 'bg-gray-100');
      expect(result).toBe('bg-gray-100');
    });

    it('should keep non-conflicting classes', () => {
      const result = cn('p-4', 'm-2', 'text-red-500');
      expect(result).toBe('p-4 m-2 text-red-500');
    });

    it('should handle complex tailwind class merging', () => {
      const result = cn(
        'flex items-center justify-center',
        'p-4 m-2',
        'bg-white hover:bg-gray-100',
        'p-6'
      );
      expect(result).toContain('flex');
      expect(result).toContain('items-center');
      expect(result).toContain('p-6');
      expect(result).not.toContain('p-4');
    });

    it('should handle responsive prefixes correctly', () => {
      const result = cn('md:p-4', 'md:p-6');
      expect(result).toBe('md:p-6');
    });

    it('should preserve different responsive prefixes', () => {
      const result = cn('sm:p-2', 'md:p-4', 'lg:p-6');
      expect(result).toBe('sm:p-2 md:p-4 lg:p-6');
    });

    it('should handle hover states correctly', () => {
      const result = cn('hover:bg-gray-100', 'hover:bg-gray-200');
      expect(result).toBe('hover:bg-gray-200');
    });
  });

  describe('array inputs', () => {
    it('should handle array of classes', () => {
      const result = cn(['class1', 'class2', 'class3']);
      expect(result).toBe('class1 class2 class3');
    });

    it('should handle mixed array and string inputs', () => {
      const result = cn('string-class', ['array-class-1', 'array-class-2']);
      expect(result).toBe('string-class array-class-1 array-class-2');
    });
  });

  describe('real-world scenarios', () => {
    it('should handle button variant classes', () => {
      const baseClasses = 'px-4 py-2 rounded font-medium';
      const variantClasses = 'bg-primary text-primary-foreground';
      const sizeClasses = 'text-sm';

      const result = cn(baseClasses, variantClasses, sizeClasses);
      expect(result).toContain('px-4');
      expect(result).toContain('py-2');
      expect(result).toContain('bg-primary');
    });

    it('should handle component prop overrides', () => {
      const defaultClasses = 'p-4 bg-white text-black';
      const userClasses = 'p-6 bg-gray-100';

      const result = cn(defaultClasses, userClasses);
      expect(result).toContain('p-6');
      expect(result).toContain('bg-gray-100');
      expect(result).not.toContain('p-4');
      expect(result).not.toContain('bg-white');
    });

    it('should handle conditional disabled states', () => {
      const isDisabled = true;
      const result = cn('button-base', isDisabled && 'opacity-50 cursor-not-allowed');
      expect(result).toBe('button-base opacity-50 cursor-not-allowed');
    });
  });
});
