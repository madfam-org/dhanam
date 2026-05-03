'use client';

import { useTranslation } from '@dhanam/shared';
import { Button } from '@dhanam/ui';
import { X, Clock, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/lib/hooks/use-auth';

import { PersonaSwitcher } from './persona-switcher';

export function DemoModeBanner() {
  const { user } = useAuth();
  const router = useRouter();
  const analytics = useAnalytics();
  const { t } = useTranslation('common');
  const [isVisible, setIsVisible] = useState(true);
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Detect demo mode: check for @dhanam.demo email pattern
  const isDemo = user?.email?.endsWith('@dhanam.demo') ?? false;
  const isGuest = user?.email === 'guest@dhanam.demo';

  // Derive persona from email
  const persona = isDemo ? user?.email?.split('@')[0] : undefined;

  useEffect(() => {
    if (!isDemo) return;

    const updateTimeLeft = () => {
      const now = new Date().getTime();
      const sessionStart = localStorage.getItem('demo_session_start');

      if (!sessionStart) {
        localStorage.setItem('demo_session_start', now.toString());
      }

      const start = parseInt(sessionStart || now.toString(), 10);
      const endTime = start + 2 * 60 * 60 * 1000; // 2 hours
      const remaining = endTime - now;

      if (remaining <= 0) {
        setTimeLeft('expired');
        return;
      }

      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);

      setTimeLeft(hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`);
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [isDemo]);

  const handleSignUp = () => {
    analytics.track('demo_convert_clicked', {
      timeRemaining: timeLeft,
      persona,
      source: 'banner',
    });
    router.push('/register');
  };

  const handleDismiss = () => {
    setIsVisible(false);
    analytics.track('demo_banner_dismissed', {
      timeRemaining: timeLeft,
      persona,
    });
  };

  if (!isDemo || !isVisible) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
      <div className="container mx-auto px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Sparkles className="h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                {isGuest ? (
                  <>
                    {t('demoExploring')} <strong>{t('demoMode')}</strong>
                  </>
                ) : (
                  <>
                    {t('demoExploringAs')} <strong>{user?.name}</strong>
                  </>
                )}
              </p>
              <p className="text-xs opacity-90 hidden sm:block">{t('demoDescription')}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <PersonaSwitcher currentPersona={persona} />

            {timeLeft !== 'expired' && (
              <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-mono font-medium">{timeLeft}</span>
              </div>
            )}

            <Button
              size="sm"
              variant="secondary"
              onClick={handleSignUp}
              className="bg-white text-primary hover:bg-gray-100 font-semibold whitespace-nowrap"
            >
              {timeLeft === 'expired' ? t('signUpToContinue') : t('signUpFree')}
            </Button>

            <button
              onClick={handleDismiss}
              className="text-white/80 hover:text-white transition-colors"
              aria-label={t('dismissBanner')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
