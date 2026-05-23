'use client';

import { Card, Button, Input, Label, Skeleton } from '@dhanam/ui';
import { Database, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { adminApi, type MadfamImportPlatformSettings } from '@/lib/api/admin';

const EMPTY: MadfamImportPlatformSettings = {
  businessRfc: '',
  spaceNameBusiness: '',
  spaceNamePartner: '',
  spaceNamePersonal: '',
  accountSuffixPartner: '-afac',
  accountSuffixPersonal: '-personal',
};

export default function MadfamImportSettingsPage() {
  const [form, setForm] = useState<MadfamImportPlatformSettings>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const settings = await adminApi.getMadfamImportPlatformConfig();
      setForm({
        businessRfc: settings.businessRfc ?? '',
        spaceNameBusiness: settings.spaceNameBusiness ?? '',
        spaceNamePartner: settings.spaceNamePartner ?? '',
        spaceNamePersonal: settings.spaceNamePersonal ?? '',
        accountSuffixPartner: settings.accountSuffixPartner ?? '-afac',
        accountSuffixPersonal: settings.accountSuffixPersonal ?? '-personal',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await adminApi.updateMadfamImportPlatformConfig({
        businessRfc: (form.businessRfc ?? '').trim() || null,
        spaceNameBusiness: (form.spaceNameBusiness ?? '').trim() || null,
        spaceNamePartner: (form.spaceNamePartner ?? '').trim() || null,
        spaceNamePersonal: (form.spaceNamePersonal ?? '').trim() || null,
        accountSuffixPartner: (form.accountSuffixPartner ?? '').trim() || null,
        accountSuffixPersonal: (form.accountSuffixPersonal ?? '').trim() || null,
      });
      setForm({
        businessRfc: updated.businessRfc ?? '',
        spaceNameBusiness: updated.spaceNameBusiness ?? '',
        spaceNamePartner: updated.spaceNamePartner ?? '',
        spaceNamePersonal: updated.spaceNamePersonal ?? '',
        accountSuffixPartner: updated.accountSuffixPartner ?? '-afac',
        accountSuffixPersonal: updated.accountSuffixPersonal ?? '-personal',
      });
      setMessage('Settings saved. Import scripts use these when PLATFORM_CONFIG_SOURCE=db.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <MadfamImportSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">MADFAM CSV Import</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Operator routing for CSV import (RFC, space names, account suffixes). Values are stored in
          platform_config — never commit real RFCs to git.
        </p>
      </div>

      <Card className="p-6 space-y-6">
        <div className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
          <Database className="h-5 w-5 shrink-0 mt-0.5" />
          <p>
            Set{' '}
            <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
              PLATFORM_CONFIG_SOURCE=db
            </code>{' '}
            on import jobs to hydrate env from this panel. Env vars always override DB values.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            id="businessRfc"
            label="Business RFC"
            value={form.businessRfc ?? ''}
            onChange={(v) => setForm({ ...form, businessRfc: v })}
            placeholder="From Vault"
          />
          <Field
            id="spaceNameBusiness"
            label="Business space name"
            value={form.spaceNameBusiness ?? ''}
            onChange={(v) => setForm({ ...form, spaceNameBusiness: v })}
          />
          <Field
            id="spaceNamePartner"
            label="Partner space name"
            value={form.spaceNamePartner ?? ''}
            onChange={(v) => setForm({ ...form, spaceNamePartner: v })}
          />
          <Field
            id="spaceNamePersonal"
            label="Personal space name"
            value={form.spaceNamePersonal ?? ''}
            onChange={(v) => setForm({ ...form, spaceNamePersonal: v })}
          />
          <Field
            id="accountSuffixPartner"
            label="Partner account suffix"
            value={form.accountSuffixPartner ?? ''}
            onChange={(v) => setForm({ ...form, accountSuffixPartner: v })}
            placeholder="-afac"
          />
          <Field
            id="accountSuffixPersonal"
            label="Personal account suffix"
            value={form.accountSuffixPersonal ?? ''}
            onChange={(v) => setForm({ ...form, accountSuffixPersonal: v })}
            placeholder="-personal"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm text-green-600 dark:text-green-400" role="status">
            {message}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={isSaving}>
            Reload
          </Button>
          <Button onClick={() => void handleSave()} disabled={isSaving} className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2"
      />
    </div>
  );
}

function MadfamImportSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <Card className="p-6 space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}
