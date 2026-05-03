'use client';

import { Card, Input, Button } from '@dhanam/ui';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { adminApi } from '~/lib/api/admin';

export function CacheControls() {
  const [pattern, setPattern] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ flushedCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFlush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern.trim()) return;
    if (!window.confirm(`Flush all cache keys matching "${pattern}"?`)) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await adminApi.flushCache(pattern, true);
      setResult(res);
      setPattern('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to flush cache');
    } finally {
      setLoading(false);
    }
  };

  const presets = [
    { label: 'System Stats', pattern: 'admin:system_stats' },
    { label: 'All Admin Cache', pattern: 'admin:*' },
    { label: 'Session Cache', pattern: 'session:*' },
    { label: 'Feature Flags', pattern: 'admin:feature_flags' },
  ];

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cache Management</h3>

      <form onSubmit={handleFlush} className="flex space-x-3 mb-4">
        <Input
          type="text"
          placeholder="Redis key pattern (e.g. admin:*)"
          value={pattern}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPattern(e.target.value)}
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={loading || !pattern.trim()}
          className="flex items-center space-x-2"
        >
          <Trash2 className="h-4 w-4" />
          <span>{loading ? 'Flushing...' : 'Flush'}</span>
        </Button>
      </form>

      <div className="flex flex-wrap gap-2 mb-4">
        {presets.map((preset) => (
          <button
            key={preset.pattern}
            type="button"
            onClick={() => setPattern(preset.pattern)}
            className="px-3 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {result && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded text-sm text-green-700 dark:text-green-400">
          Flushed {result.flushedCount} key{result.flushedCount !== 1 ? 's' : ''} successfully.
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
    </Card>
  );
}
