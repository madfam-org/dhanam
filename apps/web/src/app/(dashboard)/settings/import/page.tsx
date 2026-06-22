'use client';

import { useTranslation } from '@dhanam/shared';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@dhanam/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';

import { LunchMoneyImportWizard } from '@/components/import/lunchmoney-import-wizard';
import { migrationApi } from '@/lib/api/migration';
import { useSpaceStore } from '@/stores/space';

export default function ImportSettingsPage() {
  const { t } = useTranslation('platformImport');
  const spaceId = useSpaceStore((s) => s.currentSpace?.id);

  const { data: status, isLoading } = useQuery({
    queryKey: ['migration-status', spaceId],
    queryFn: () => migrationApi.getStatus(spaceId!),
    enabled: Boolean(spaceId),
  });

  if (!spaceId) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings" aria-label={t('hub.backToSettings')}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">{t('hub.title')}</h1>
          <p className="text-muted-foreground">{t('hub.description')}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : status?.lunchMoney ? (
        <LunchMoneyImportWizard spaceId={spaceId} />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">{t('hub.disabled')}</CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {(['ynab', 'monarch', 'csv'] as const).map((key) => (
          <Card key={key} className="opacity-70">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                {t(`platforms.${key}`)}
                <Badge variant="secondary">{t('hub.comingSoon')}</Badge>
              </CardTitle>
              <CardDescription className="flex items-center gap-1 text-xs">
                <Download className="h-3 w-3" />
                CSV / preset
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
