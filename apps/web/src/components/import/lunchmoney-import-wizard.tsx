'use client';

import { useTranslation } from '@dhanam/shared';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Badge,
} from '@dhanam/ui';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Loader2, Shield, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  migrationApi,
  type LunchMoneyPreflightResult,
  type PlatformImportJob,
} from '@/lib/api/migration';

type WizardStep = 'token' | 'preview' | 'progress' | 'finish';

interface LunchMoneyImportWizardProps {
  spaceId: string;
}

export function LunchMoneyImportWizard({ spaceId }: LunchMoneyImportWizardProps) {
  const { t } = useTranslation('platformImport');
  const [step, setStep] = useState<WizardStep>('token');
  const [apiToken, setApiToken] = useState('');
  const [startDate, setStartDate] = useState('2020-01-01');
  const [preflight, setPreflight] = useState<LunchMoneyPreflightResult | null>(null);
  const [activeJob, setActiveJob] = useState<PlatformImportJob | null>(null);

  const preflightMutation = useMutation({
    mutationFn: () => migrationApi.preflightLunchMoney(spaceId, { apiToken, startDate }),
    onSuccess: (data) => {
      setPreflight(data);
      setStep('preview');
    },
    onError: () => toast.error(t('lunchmoney.errors.preflight')),
  });

  const startMutation = useMutation({
    mutationFn: () => migrationApi.startLunchMoneyImport(spaceId, { apiToken, startDate }),
    onSuccess: (job) => {
      setActiveJob(job);
      setStep('progress');
      setApiToken('');
    },
    onError: () => toast.error(t('lunchmoney.errors.start')),
  });

  const pollJob = useCallback(async () => {
    if (!activeJob?.id) return;
    try {
      const job = await migrationApi.getJob(spaceId, activeJob.id);
      setActiveJob(job);
      if (job.status === 'completed') {
        setStep('finish');
      }
      if (job.status === 'failed') {
        toast.error(job.errorMessage || t('lunchmoney.errors.failed'));
      }
    } catch {
      /* ignore transient poll errors */
    }
  }, [activeJob?.id, spaceId, t]);

  useEffect(() => {
    if (step !== 'progress' || !activeJob?.id) return;
    if (activeJob.status === 'completed' || activeJob.status === 'failed') return;

    const interval = setInterval(() => void pollJob(), 2500);
    void pollJob();
    return () => clearInterval(interval);
  }, [step, activeJob?.id, activeJob?.status, pollJob]);

  const stepIndex = step === 'token' ? 0 : step === 'preview' ? 1 : step === 'progress' ? 2 : 3;

  return (
    <Card className="overflow-hidden border-amber-200/60 bg-gradient-to-br from-amber-50/80 via-background to-emerald-50/40 dark:border-amber-900/40 dark:from-amber-950/20 dark:to-emerald-950/10">
      <CardHeader className="border-b border-amber-200/40 dark:border-amber-900/30">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="font-serif text-2xl tracking-tight">
              {t('lunchmoney.title')}
            </CardTitle>
            <CardDescription className="mt-1">{t('lunchmoney.subtitle')}</CardDescription>
          </div>
          <Badge
            variant="outline"
            className="shrink-0 border-amber-500/40 text-amber-800 dark:text-amber-200"
          >
            <Sparkles className="mr-1 h-3 w-3" />
            API
          </Badge>
        </div>
        <div className="mt-4 flex gap-2">
          {(['token', 'preview', 'progress', 'finish'] as WizardStep[]).map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= stepIndex ? 'bg-amber-500' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {step === 'token' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lm-token">{t('lunchmoney.tokenLabel')}</Label>
              <Input
                id="lm-token"
                type="password"
                autoComplete="off"
                placeholder={t('lunchmoney.tokenPlaceholder')}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                className="font-mono"
              />
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t('lunchmoney.tokenHelp')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lm-start">{t('lunchmoney.startDateLabel')}</Label>
              <Input
                id="lm-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t('lunchmoney.startDateHelp')}</p>
            </div>
            <Button
              className="w-full sm:w-auto"
              disabled={apiToken.length < 8 || preflightMutation.isPending}
              onClick={() => preflightMutation.mutate()}
            >
              {preflightMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t('lunchmoney.preview')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 'preview' && preflight && (
          <div className="space-y-5">
            <div className="rounded-xl border border-amber-200/50 bg-background/80 p-4 dark:border-amber-900/30">
              <p className="font-medium">{preflight.budgetName}</p>
              <p className="text-sm text-muted-foreground">
                {preflight.dateRange.startDate} → {preflight.dateRange.endDate} ·{' '}
                {preflight.primaryCurrency}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                {(
                  [
                    ['categories', preflight.counts.categories],
                    ['tags', preflight.counts.tags],
                    ['accounts', preflight.counts.accounts],
                    ['transactions', preflight.counts.transactions],
                    ['recurring', preflight.counts.recurringItems],
                    ['plaid', preflight.counts.plaidAccounts],
                  ] as const
                ).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-muted-foreground">{t(`lunchmoney.counts.${key}`)}</dt>
                    <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">{t('lunchmoney.limitations')}</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {preflight.limitations.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-amber-600">·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep('token')}>
                {t('hub.backToSettings')}
              </Button>
              <Button disabled={startMutation.isPending} onClick={() => startMutation.mutate()}>
                {startMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('lunchmoney.startImport')}
              </Button>
            </div>
          </div>
        )}

        {step === 'progress' && activeJob && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-amber-600" />
            <div>
              <p className="font-medium">{t('lunchmoney.importing')}</p>
              <p className="text-sm text-muted-foreground">
                {t(`lunchmoney.status.${activeJob.status}`)}
              </p>
            </div>
          </div>
        )}

        {step === 'finish' && (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              <div>
                <p className="text-lg font-semibold">{t('lunchmoney.doneTitle')}</p>
                <p className="text-sm text-muted-foreground">{t('lunchmoney.doneBody')}</p>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200/50 bg-emerald-50/50 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20">
              <p className="font-medium">{t('lunchmoney.reconnectTitle')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('lunchmoney.reconnectBody')}</p>
              <Button asChild className="mt-4" variant="secondary">
                <Link href="/accounts">{t('lunchmoney.reconnectCta')}</Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
