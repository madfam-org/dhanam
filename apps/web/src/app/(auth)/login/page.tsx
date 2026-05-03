'use client';

import { useTranslation } from '@dhanam/shared';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Alert,
  AlertDescription,
  Button,
  Separator,
} from '@dhanam/ui';
import { useMutation } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, Component, type ReactNode } from 'react';

import { LocaleSwitcher } from '~/components/locale-switcher';
import { authApi } from '~/lib/api/auth';
import { ApiError } from '~/lib/api/client';
import { useAuth } from '~/lib/hooks/use-auth';

const SignIn = dynamic(() => import('@janua/react-sdk').then((mod) => mod.SignIn), {
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
            <Link href="https://auth.madfam.io">Sign in with Janua SSO</Link>
          </Button>
        )
      );
    }
    return this.props.children;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const { t } = useTranslation('auth');
  const [error, setError] = useState<string | null>(null);

  const guestLoginMutation = useMutation({
    mutationFn: authApi.loginAsGuest,
    onSuccess: (response) => {
      setAuth(response.user, response.tokens);
      router.push('/dashboard');
    },
    onError: (_error: ApiError) => {
      setError(t('demoAccessFailed'));
    },
  });

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex justify-end">
        <LocaleSwitcher />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('loginTitle')}</CardTitle>
          <CardDescription>{t('loginSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <JanuaErrorBoundary>
            <SignIn redirectUrl="/dashboard" />
          </JanuaErrorBoundary>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {t('orContinueWith') || 'Or'}
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setError(null);
              guestLoginMutation.mutate({});
            }}
            disabled={guestLoginMutation.isPending}
          >
            {guestLoginMutation.isPending ? t('accessingDemo') : t('tryDemo')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
