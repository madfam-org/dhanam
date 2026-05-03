'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@dhanam/ui';
import { Flame, Target, Leaf } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { fireStreakCelebration } from '~/lib/celebrations';
import { useAuth } from '~/lib/hooks/use-auth';

interface Badge {
  label: string;
  icon: React.ElementType;
  color: string;
  earned: boolean;
}

const MILESTONE_WEEKS = [4, 8, 12, 24, 52];

const personaData: Record<
  string,
  { weeks: number; rate: number; target: number; badges: Badge[] }
> = {
  'maria@dhanam.demo': {
    weeks: 12,
    rate: 29,
    target: 25,
    badges: [
      { label: 'Budget Master', icon: Target, color: 'text-blue-600', earned: true },
      { label: 'Savings Star', icon: Flame, color: 'text-amber-500', earned: true },
      { label: 'ESG Leader', icon: Leaf, color: 'text-green-600', earned: true },
    ],
  },
  'carlos@dhanam.demo': {
    weeks: 8,
    rate: 18,
    target: 20,
    badges: [
      { label: 'Budget Master', icon: Target, color: 'text-blue-600', earned: true },
      { label: 'Savings Star', icon: Flame, color: 'text-amber-500', earned: false },
      { label: 'ESG Leader', icon: Leaf, color: 'text-green-600', earned: false },
    ],
  },
  'patricia@dhanam.demo': {
    weeks: 24,
    rate: 35,
    target: 30,
    badges: [
      { label: 'Budget Master', icon: Target, color: 'text-blue-600', earned: true },
      { label: 'Savings Star', icon: Flame, color: 'text-amber-500', earned: true },
      { label: 'ESG Leader', icon: Leaf, color: 'text-green-600', earned: false },
    ],
  },
  'diego@dhanam.demo': {
    weeks: 6,
    rate: 22,
    target: 20,
    badges: [
      { label: 'Budget Master', icon: Target, color: 'text-blue-600', earned: false },
      { label: 'Savings Star', icon: Flame, color: 'text-amber-500', earned: true },
      { label: 'ESG Leader', icon: Leaf, color: 'text-green-600', earned: true },
    ],
  },
};

export function SavingsStreak() {
  const { user } = useAuth();
  const data = user?.email ? personaData[user.email] : null;
  const celebratedRef = useRef(false);

  useEffect(() => {
    if (!data || celebratedRef.current) return undefined;
    // Check if current streak hits a milestone — celebrate once per mount
    if (MILESTONE_WEEKS.includes(data.weeks)) {
      celebratedRef.current = true;
      const timer = setTimeout(() => {
        fireStreakCelebration(data.weeks);
        toast.success(`🔥 ${data.weeks}-week savings streak! Keep it going!`);
      }, 800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [data]);

  if (!data) return null;

  const pct = Math.min((data.rate / data.target) * 100, 100);
  const onTarget = data.rate >= data.target;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Flame className="h-4 w-4 text-amber-500" />
          Savings Streak & Achievements
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Streak */}
          <div className="text-center">
            <p className="text-2xl font-bold">{data.weeks}</p>
            <p className="text-xs text-muted-foreground">weeks of positive savings</p>
          </div>

          {/* Progress bar */}
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Savings rate</span>
              <span className="font-medium">
                {data.rate}% / {data.target}% target
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                  onTarget ? 'bg-green-500' : 'bg-amber-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {onTarget && (
              <p className="text-xs text-green-600 mt-1 font-medium">
                ✓ Above target — great work!
              </p>
            )}
          </div>

          {/* Badges with animation */}
          <div className="flex gap-2">
            {data.badges.map((badge) => {
              const Icon = badge.icon;
              return (
                <div
                  key={badge.label}
                  className={`flex flex-col items-center gap-0.5 transition-all duration-500 ${
                    badge.earned ? 'animate-in zoom-in-50' : 'opacity-30 grayscale'
                  }`}
                  title={badge.label}
                >
                  <div
                    className={`relative ${
                      badge.earned
                        ? 'after:absolute after:inset-0 after:rounded-full after:ring-2 after:ring-offset-1 after:ring-current after:opacity-30'
                        : ''
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${badge.color}`} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{badge.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
