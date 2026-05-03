'use client';

import { useTranslation } from '@dhanam/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Alert,
  AlertDescription,
} from '@dhanam/ui';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Shield, Building2, MapPin, Globe } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { useAnalytics } from '~/hooks/useAnalytics';
import { belvoApi } from '~/lib/api/belvo';

const BELVO_INSTITUTIONS = [
  {
    name: 'BBVA México',
    code: 'bbva_mx',
    logo: '🏦',
    description: 'Bancomer - Largest bank in Mexico',
  },
  {
    name: 'Banamex',
    code: 'banamex',
    logo: '🏛️',
    description: 'Citibanamex - Major Mexican bank',
  },
  {
    name: 'Banorte',
    code: 'banorte',
    logo: '🏢',
    description: 'Banco del Bajío group bank',
  },
  {
    name: 'Santander México',
    code: 'santander_mx',
    logo: '🔴',
    description: 'Spanish multinational bank',
  },
  {
    name: 'HSBC México',
    code: 'hsbc_mx',
    logo: '🔺',
    description: 'International banking presence',
  },
  {
    name: 'Scotiabank México',
    code: 'scotiabank_mx',
    logo: '🟥',
    description: 'Canadian multinational bank',
  },
];

interface BelvoConnectProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  onSuccess: () => void;
}

export function BelvoConnect({ open, onOpenChange, spaceId, onSuccess }: BelvoConnectProps) {
  const { t } = useTranslation('accounts');
  const analytics = useAnalytics();
  const [institution, setInstitution] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const linkAccountMutation = useMutation({
    mutationFn: (data: { institution: string; username: string; password: string }) =>
      belvoApi.linkAccount(spaceId, data),
    onSuccess: (data) => {
      analytics.trackConnectSuccess('belvo', data.accountsCount);
      const selectedBank = BELVO_INSTITUTIONS.find((bank) => bank.code === institution);
      toast.success(
        t(
          data.accountsCount > 1
            ? 'providers.belvo.linkedSuccess_plural'
            : 'providers.belvo.linkedSuccess',
          { count: data.accountsCount, bank: selectedBank?.name || institution }
        )
      );
      onSuccess();
      onOpenChange(false);
      setInstitution('');
      setUsername('');
      setPassword('');
    },
    onError: (error: unknown) => {
      analytics.track('connect_failed', { provider: 'belvo', error: String(error) });
      const errorCode =
        error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
          ? error.code
          : '';
      const message =
        errorCode === 'INVALID_CREDENTIALS'
          ? t('providers.belvo.invalidCredentials')
          : errorCode === 'INSTITUTION_ERROR'
            ? t('providers.belvo.institutionError')
            : errorCode === 'MFA_REQUIRED'
              ? t('providers.belvo.mfaRequired')
              : t('providers.belvo.linkFailed');
      toast.error(message);
    },
  });

  const handleConnect = () => {
    if (institution && username && password) {
      analytics.trackConnectInitiated('belvo');
      linkAccountMutation.mutate({ institution, username, password });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-green-600" />
            {t('providers.belvo.title')}
          </DialogTitle>
          <DialogDescription>{t('providers.belvo.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Security Notice */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-600" />
                {t('providers.belvo.securityTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• {t('providers.belvo.securityEncryption')}</li>
                <li>• {t('providers.belvo.securityReadOnly')}</li>
                <li>• {t('providers.belvo.securityRegulated')}</li>
                <li>• {t('providers.belvo.securityKms')}</li>
              </ul>
            </CardContent>
          </Card>

          {/* Supported Institutions */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {t('providers.belvo.supportedBanks')}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {BELVO_INSTITUTIONS.map((bank) => (
                <div
                  key={bank.code}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    institution === bank.code
                      ? 'bg-primary/10 border-primary'
                      : 'bg-card hover:bg-accent'
                  }`}
                  onClick={() => setInstitution(bank.code)}
                  onKeyDown={(e) => e.key === 'Enter' && setInstitution(bank.code)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${bank.name} bank`}
                >
                  <span className="text-2xl">{bank.logo}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{bank.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{bank.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t('providers.belvo.moreInstitutions')}
            </p>
          </div>

          {/* Connection Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">
                {t('providers.belvo.usernameLabel')}
              </label>
              <Input
                id="username"
                placeholder={t('providers.belvo.usernamePlaceholder')}
                value={username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                {t('providers.belvo.passwordLabel')}
              </label>
              <Input
                id="password"
                type="password"
                placeholder={t('providers.belvo.passwordPlaceholder')}
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                className="w-full"
              />
            </div>

            <Alert>
              <Globe className="h-4 w-4" />
              <AlertDescription>{t('providers.belvo.readOnlyNotice')}</AlertDescription>
            </Alert>

            <Button
              onClick={handleConnect}
              disabled={!institution || !username || !password || linkAccountMutation.isPending}
              className="w-full"
              size="lg"
            >
              {linkAccountMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('providers.belvo.connecting')}
                </>
              ) : (
                t('providers.belvo.connectButton')
              )}
            </Button>

            {/* Demo Credentials for Development */}
            {process.env.NODE_ENV === 'development' && (
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-blue-800">Demo Credentials</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xs text-blue-700 space-y-1">
                    <p>
                      <strong>Institution:</strong> sandbox_mx
                    </p>
                    <p>
                      <strong>Username:</strong> test_user
                    </p>
                    <p>
                      <strong>Password:</strong> test_password
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <p className="text-xs text-center text-muted-foreground">
              {t('providers.belvo.privacyConsent')}{' '}
              <a
                href="https://belvo.com/privacy/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
