'use client';

import type { LandingLocale } from '@dhanam/shared';
import { useEffect, useRef } from 'react';

import type { useAnalytics } from '@/hooks/useAnalytics';

type Analytics = ReturnType<typeof useAnalytics>;

const SCROLL_MILESTONES = [25, 50, 75, 100] as const;

/**
 * PostHog scroll depth + section visibility for the marketing landing.
 * @see docs/LANDING_REMEDIATION.md §12
 */
export function useLandingAnalytics(locale: LandingLocale, analytics: Analytics): void {
  const firedScroll = useRef(new Set<number>());
  const firedSections = useRef(new Set<string>());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;

      const percent = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
      for (const milestone of SCROLL_MILESTONES) {
        if (percent >= milestone && !firedScroll.current.has(milestone)) {
          firedScroll.current.add(milestone);
          analytics.track('scroll_depth', { percent: milestone, locale });
        }
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const sections = document.querySelectorAll<HTMLElement>('[data-landing-section]');
    const observer =
      sections.length > 0
        ? new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const section = entry.target.getAttribute('data-landing-section');
                if (!section || firedSections.current.has(section)) continue;
                firedSections.current.add(section);
                analytics.track('landing_section_viewed', { section, locale });
              }
            },
            { threshold: 0.35, rootMargin: '0px 0px -10% 0px' }
          )
        : null;

    sections.forEach((el) => observer?.observe(el));

    return () => {
      window.removeEventListener('scroll', onScroll);
      observer?.disconnect();
    };
  }, [analytics, locale]);
}
