'use client';

import { useTranslation } from '@dhanam/shared';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@dhanam/ui';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Component, type ReactNode } from 'react';

import { LocaleSwitcher } from '~/components/locale-switcher';

const SignUp = dynamic(() => import('@janua/react-sdk').then((mod) => mod.SignUp), {
  ssr: false,
  loading: () => <div className="h-10 animate-pulse bg-muted rounded" />,
});

/** Catches errors from Janua SDK components without crashing the page */
class JanuaErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <Button variant="default" className="w-full" asChild>
            <Link href="https://auth.madfam.io">Sign up with Janua SSO</Link>
          </Button>
        )
      );
    }
    return this.props.children;
  }
}

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const selectedPlan = searchParams.get('plan');
  const { t } = useTranslation('auth');

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex justify-end">
        <LocaleSwitcher />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('register.title') || 'Create an account'}</CardTitle>
          <CardDescription>
            {selectedPlan
              ? `Start your free trial of ${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}`
              : t('register.description') || 'Start managing your finances with Dhanam'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JanuaErrorBoundary>
            <SignUp redirectUrl="/onboarding" />
          </JanuaErrorBoundary>
        </CardContent>
        <CardFooter>
          <div className="text-sm text-muted-foreground text-center w-full">
            {t('register.hasAccount') || 'Already have an account?'}{' '}
            <Link href="/login" className="text-primary hover:underline">
              {t('register.signIn') || 'Sign in'}
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
