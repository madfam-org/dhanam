'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAnalytics } from '@/hooks/useAnalytics';
import { authApi } from '~/lib/api/auth';
import { useAuth } from '~/lib/hooks/use-auth';
import { useSpaceStore } from '~/stores/space';

const PERSONAS = [
  {
    key: 'maria',
    emoji: '🧑‍💼',
    name: 'Maria González',
    archetype: 'Young Professional',
    features: ['Zero-based budgeting', 'Belvo bank sync', 'ESG crypto scoring'],
    color: 'border-blue-500',
    narrative:
      "María was juggling 5 financial apps and still couldn't find where her money went. Now AI learns her patterns, auto-categorizes every transaction, and one search finds anything across all her accounts.",
    guidedFeatures: [
      'AI categorization',
      'AI Search (⌘K)',
      'Zero-based budgeting',
      '60-day forecast',
    ],
  },
  {
    key: 'carlos',
    emoji: '🏪',
    name: 'Carlos Mendoza',
    archetype: 'Small Business Owner',
    features: ['Yours / Mine / Ours spaces', 'Business budgeting', 'Manual asset tracking'],
    color: 'border-green-500',
    narrative:
      "Carlos's business and personal finances were hopelessly tangled. With separate spaces, clear boundaries, and a complete picture of both worlds, he finally sees the full story.",
    guidedFeatures: [
      'Multi-space management',
      'Yours / Mine / Ours',
      'Business budgeting',
      'Manual assets',
    ],
  },
  {
    key: 'patricia',
    emoji: '💎',
    name: 'Patricia Ruiz',
    archetype: 'High Net Worth',
    features: ['Estate planning', 'Multi-currency accounts', 'Investment portfolios'],
    color: 'border-purple-500',
    narrative:
      "Patricia's advisor gave her static projections with no probability attached. Now she runs 10,000 Monte Carlo simulations, stress-tests against 12 historical scenarios, and sees real odds.",
    guidedFeatures: [
      'Monte Carlo simulations',
      'Stress scenarios',
      'Estate planning',
      'Document vault',
    ],
  },
  {
    key: 'diego',
    emoji: '🎮',
    name: 'Diego Navarro',
    archetype: 'Web3 / DeFi Native',
    features: ['Multi-chain DeFi', 'Gaming wallets & NFTs', 'DAO governance'],
    color: 'border-orange-500',
    narrative:
      "Diego's DeFi positions were invisible to his bank. Now he tracks 7 networks, sees ESG scores for every holding, and manages gaming assets alongside traditional finance.",
    guidedFeatures: ['7-network DeFi tracking', 'ESG scoring', 'Gaming portfolio', 'Collectibles'],
  },
  {
    key: 'guest',
    emoji: '👋',
    name: 'Quick Preview',
    archetype: 'Basic Personal Finance',
    features: ['Monthly budgeting', 'Multi-account overview', 'Crypto wallet tracking'],
    color: 'border-gray-400',
    narrative: '',
    guidedFeatures: [],
  },
];

export default function DemoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const analytics = useAnalytics();
  const { setAuth } = useAuth();
  const queryClient = useQueryClient();

  const [loadingPersona, setLoadingPersona] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analytics.trackPageView('Demo Page', '/demo');
    analytics.track('demo_started', {});

    // Pre-select persona from query param (from landing page cards)
    const personaParam = searchParams.get('persona');
    if (personaParam && PERSONAS.some((p) => p.key === personaParam)) {
      setActivePersona(personaParam);
      handlePersonaClick(personaParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Reason: Intentionally run once on mount to fire analytics and auto-select persona from query param
  }, []);

  const handlePersonaClick = async (personaKey: string) => {
    setLoadingPersona(personaKey);
    setError(null);
    analytics.track('demo_persona_selected', { persona: personaKey });

    try {
      const result = await authApi.loginAsPersona(personaKey);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loginAsPersona returns user with extra {isDemo, persona} fields not in UserProfile
      setAuth(result.user as any, result.tokens);

      // Clear stale space data to prevent mismatches with previous persona
      useSpaceStore.getState().setCurrentSpace(null);
      useSpaceStore.getState().setSpaces([]);

      // Wipe React Query cache — client-side nav preserves it, causing stale data
      queryClient.clear();

      // Set demo-mode cookie so middleware and layout detect demo mode
      document.cookie = 'demo-mode=true; path=/; max-age=7200; SameSite=Lax';

      // Client-side navigation preserves Zustand state (no rehydration race)
      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to login as persona:', err);
      setError('Failed to start demo. Please try again.');
      setLoadingPersona(null);
    }
  };

  const handleSignUp = () => {
    analytics.track('demo_signup_clicked', {});
    router.push('/register');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <div className="border-b bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-blue-600" />
            <span className="font-bold text-xl">Dhanam</span>
            <Badge variant="outline">Demo</Badge>
          </div>
          <Button onClick={handleSignUp} variant="outline" className="gap-2">
            Sign Up for Full Access
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-12">
        {/* Persona Narrative (if arriving from landing card) */}
        {activePersona &&
          (() => {
            const persona = PERSONAS.find((p) => p.key === activePersona);
            return persona?.narrative ? (
              <div className="max-w-2xl mx-auto text-center bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-2xl p-8 space-y-4">
                <div className="text-4xl">{persona.emoji}</div>
                <h2 className="text-2xl font-bold">{persona.name}&apos;s Story</h2>
                <p className="text-muted-foreground">{persona.narrative}</p>
                {persona.guidedFeatures.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center pt-2">
                    {persona.guidedFeatures.map((f) => (
                      <span
                        key={f}
                        className="inline-flex items-center rounded-full border bg-card px-3 py-1 text-xs font-medium"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : null;
          })()}

        {/* Persona Picker Section */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Experience Dhanam</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Pick a financial life to explore. Each persona showcases different features. Switch
            between them anytime from the dashboard.
          </p>
        </div>

        {error && (
          <div className="max-w-md mx-auto p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-center">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {PERSONAS.map((persona) => (
            <Card
              key={persona.key}
              className={`cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 ${persona.color} border-t-4`}
            >
              <CardHeader className="pb-3">
                <div className="text-3xl mb-2">{persona.emoji}</div>
                <CardTitle className="text-lg">{persona.name}</CardTitle>
                <CardDescription>{persona.archetype}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1">
                  {persona.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => handlePersonaClick(persona.key)}
                  disabled={loadingPersona !== null}
                  className="w-full"
                  variant={persona.key === 'guest' ? 'outline' : 'default'}
                >
                  {loadingPersona === persona.key ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : persona.key === 'guest' ? (
                    'Quick Start'
                  ) : (
                    `Explore as ${persona.name.split(' ')[0]}`
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
