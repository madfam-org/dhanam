'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@dhanam/ui';
import { Zap, X } from 'lucide-react';
import { useAuth } from '~/lib/hooks/use-auth';

const DISMISS_KEY = 'subscription-banner-dismissed';
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Persistent subscription banner for unpaid SaaS users.
 *
 * Shown when user has `community` tier and is NOT a demo user.
 * Community tier on SaaS means the user hasn't subscribed yet — they can
 * browse demo data but can't connect accounts or save real data.
 *
 * Dismissible for 24 hours via localStorage.
 */
export function SubscriptionBanner() {
  const { user } = useAuth();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(true); // Default hidden to avoid flash

  useEffect(() => {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (raw) {
      const dismissedAt = parseInt(raw, 10);
      if (Date.now() - dismissedAt < DISMISS_DURATION_MS) {
        setDismissed(true);
        return;
      }
    }
    setDismissed(false);
  }, []);

  // Don't show for paid users, demo users, or when dismissed
  if (!user) return null;
  if (user.subscriptionTier !== 'community') return null;
  if (user.email?.endsWith('@dhanam.demo')) return null;
  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  return (
    <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2.5">
      <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
        <p className="text-sm font-medium">
          You&apos;re on a preview. Subscribe to connect accounts and save your data.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            className="bg-white text-primary hover:bg-white/90"
            onClick={() => router.push('/billing/upgrade')}
          >
            <Zap className="mr-1 h-3.5 w-3.5" />
            Choose a Plan
          </Button>
          <button
            onClick={handleDismiss}
            className="text-white/80 hover:text-white p-1"
            aria-label="Dismiss for 24 hours"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
