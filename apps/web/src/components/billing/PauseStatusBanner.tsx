'use client';

import { Button } from '@dhanam/ui';
import { PauseCircle } from 'lucide-react';

interface PauseStatusBannerProps {
  pausedUntil: string | null;
  onResume: () => void;
  loading?: boolean;
}

export function PauseStatusBanner({ pausedUntil, onResume, loading }: PauseStatusBannerProps) {
  if (!pausedUntil) return null;

  const resumeDate = new Date(pausedUntil);
  const formatted = resumeDate.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <PauseCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Tu suscripcion esta pausada
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Se reactiva el {formatted}. No se realizan cobros mientras tanto.
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onResume} disabled={loading}>
          {loading ? 'Reactivando...' : 'Reactivar ahora'}
        </Button>
      </div>
    </div>
  );
}
