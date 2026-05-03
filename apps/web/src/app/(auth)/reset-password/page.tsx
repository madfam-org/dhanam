'use client';

import { useTranslation } from '@dhanam/shared';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Alert,
  AlertDescription,
  Button,
} from '@dhanam/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { LocaleSwitcher } from '~/components/locale-switcher';

const JANUA_URL = process.env.NEXT_PUBLIC_JANUA_API_URL || 'https://auth.madfam.io';

export default function ResetPasswordPage() {
  const { t } = useTranslation('auth');
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const januaResetUrl = `${JANUA_URL}/reset-password`;

  if (!token) {
    // No token — redirect to Janua SSO reset confirmation
    return (
      <div className="flex flex-col space-y-4">
        <div className="flex justify-end">
          <LocaleSwitcher />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t('resetPassword')}</CardTitle>
            <CardDescription>{t('resetLinkExpired')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>{t('resetLinkExpired')}</AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <Button asChild className="w-full">
              <Link href="/forgot-password">{t('requestNewLink')}</Link>
            </Button>
            <div className="text-sm text-muted-foreground text-center w-full">
              <Link href="/login" className="text-primary hover:underline">
                {t('login')}
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Has token — redirect to Janua for password reset confirmation
  if (typeof window !== 'undefined') {
    window.location.href = `${januaResetUrl}?token=${encodeURIComponent(token)}`;
  }

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex justify-end">
        <LocaleSwitcher />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('resetPassword')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('checkYourEmail')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
