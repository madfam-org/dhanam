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
  Label,
  Alert,
  AlertDescription,
  Badge,
} from '@dhanam/ui';
import { useMutation } from '@tanstack/react-query';
import {
  Loader2,
  Shield,
  Coins,
  Eye,
  EyeOff,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { useAnalytics } from '@/hooks/useAnalytics';
import { bitsoApi } from '@/lib/api/bitso';

const SUPPORTED_CRYPTOCURRENCIES = [
  { symbol: 'BTC', name: 'Bitcoin', logo: '₿' },
  { symbol: 'ETH', name: 'Ethereum', logo: 'Ξ' },
  { symbol: 'XRP', name: 'Ripple', logo: '◉' },
  { symbol: 'LTC', name: 'Litecoin', logo: 'Ł' },
  { symbol: 'BCH', name: 'Bitcoin Cash', logo: '₿' },
  { symbol: 'MANA', name: 'Decentraland', logo: '🌐' },
  { symbol: 'BAT', name: 'Basic Attention Token', logo: '🦁' },
  { symbol: 'DAI', name: 'Dai Stablecoin', logo: '◈' },
];

interface BitsoConnectProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  onSuccess: () => void;
}

export function BitsoConnect({ open, onOpenChange, spaceId, onSuccess }: BitsoConnectProps) {
  const { t } = useTranslation('accounts');
  const analytics = useAnalytics();
  const [formData, setFormData] = useState({
    apiKey: '',
    apiSecret: '',
    autoSync: true,
  });
  const [showSecrets, setShowSecrets] = useState({
    apiKey: false,
    apiSecret: false,
  });
  const [step, setStep] = useState<'form' | 'instructions'>('instructions');

  const connectMutation = useMutation({
    mutationFn: () => bitsoApi.connectAccount(spaceId, formData),
    onSuccess: (data) => {
      analytics.trackConnectSuccess('bitso', data.accountsCount);
      toast.success(
        t(
          data.accountsCount !== 1
            ? 'providers.bitso.linkedSuccess_plural'
            : 'providers.bitso.linkedSuccess',
          { count: data.accountsCount }
        )
      );
      onSuccess();
      onOpenChange(false);
      setStep('instructions');
      setFormData({ apiKey: '', apiSecret: '', autoSync: true });
    },
    onError: (error: unknown) => {
      analytics.track('connect_failed', { provider: 'bitso', error: String(error) });
      const message =
        error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'data' in error.response &&
        error.response.data &&
        typeof error.response.data === 'object' &&
        'message' in error.response.data &&
        typeof error.response.data.message === 'string'
          ? error.response.data.message
          : t('providers.bitso.connectFailed');
      toast.error(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.apiKey || !formData.apiSecret) {
      toast.error(t('providers.bitso.missingCredentials'));
      return;
    }
    analytics.trackConnectInitiated('bitso');
    connectMutation.mutate();
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep('instructions');
    setFormData({ apiKey: '', apiSecret: '', autoSync: true });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-orange-600" />
            {t('providers.bitso.title')}
          </DialogTitle>
          <DialogDescription>{t('providers.bitso.description')}</DialogDescription>
        </DialogHeader>

        {step === 'instructions' ? (
          <div className="space-y-6">
            {/* Security Notice */}
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>{t('providers.bitso.securityNotice')}</strong>
                <br />
                {t('providers.bitso.securityDetail')}
              </AlertDescription>
            </Alert>

            {/* Instructions */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                {t('providers.bitso.howToGetCredentials')}
              </h4>

              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Badge variant="outline" className="mt-0.5">
                    1
                  </Badge>
                  <div>
                    <p className="font-medium">{t('providers.bitso.step1Title')}</p>
                    <p className="text-muted-foreground">
                      Go to{' '}
                      <a
                        href="https://bitso.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        bitso.com <ExternalLink className="h-3 w-3" />
                      </a>{' '}
                      {t('providers.bitso.step1Description')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Badge variant="outline" className="mt-0.5">
                    2
                  </Badge>
                  <div>
                    <p className="font-medium">{t('providers.bitso.step2Title')}</p>
                    <p className="text-muted-foreground">{t('providers.bitso.step2Description')}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Badge variant="outline" className="mt-0.5">
                    3
                  </Badge>
                  <div>
                    <p className="font-medium">{t('providers.bitso.step3Title')}</p>
                    <p className="text-muted-foreground">{t('providers.bitso.step3Description')}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Badge variant="outline" className="mt-0.5">
                    4
                  </Badge>
                  <div>
                    <p className="font-medium">{t('providers.bitso.step4Title')}</p>
                    <p className="text-muted-foreground">{t('providers.bitso.step4Description')}</p>
                  </div>
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{t('providers.bitso.permissionsWarning')}</AlertDescription>
              </Alert>
            </div>

            {/* Supported Cryptocurrencies */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Coins className="h-4 w-4" />
                {t('providers.bitso.supportedCryptos')}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {SUPPORTED_CRYPTOCURRENCIES.map((crypto) => (
                  <div
                    key={crypto.symbol}
                    className="flex items-center gap-2 p-2 rounded border bg-card text-sm"
                  >
                    <span className="text-lg">{crypto.logo}</span>
                    <div>
                      <p className="font-medium">{crypto.symbol}</p>
                      <p className="text-xs text-muted-foreground">{crypto.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setStep('form')} className="flex-1">
                {t('providers.bitso.haveCredentials')}
              </Button>
              <Button variant="outline" onClick={handleClose}>
                {t('providers.bitso.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">{t('providers.bitso.apiKeyLabel')}</Label>
                <div className="relative">
                  <Input
                    id="apiKey"
                    type={showSecrets.apiKey ? 'text' : 'password'}
                    value={formData.apiKey}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, apiKey: e.target.value })
                    }
                    placeholder={t('providers.bitso.apiKeyPlaceholder')}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowSecrets({ ...showSecrets, apiKey: !showSecrets.apiKey })}
                  >
                    {showSecrets.apiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiSecret">{t('providers.bitso.apiSecretLabel')}</Label>
                <div className="relative">
                  <Input
                    id="apiSecret"
                    type={showSecrets.apiSecret ? 'text' : 'password'}
                    value={formData.apiSecret}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, apiSecret: e.target.value })
                    }
                    placeholder={t('providers.bitso.apiSecretPlaceholder')}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() =>
                      setShowSecrets({ ...showSecrets, apiSecret: !showSecrets.apiSecret })
                    }
                  >
                    {showSecrets.apiSecret ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoSync"
                  checked={formData.autoSync}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, autoSync: e.target.checked })
                  }
                  className="rounded"
                />
                <Label htmlFor="autoSync" className="text-sm">
                  {t('providers.bitso.enableAutoSync')}
                </Label>
              </div>
            </div>

            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{t('providers.bitso.encryptionNotice')}</AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button type="submit" disabled={connectMutation.isPending} className="flex-1">
                {connectMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('providers.bitso.connecting')}
                  </>
                ) : (
                  t('providers.bitso.connectButton')
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => setStep('instructions')}>
                {t('providers.bitso.back')}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
