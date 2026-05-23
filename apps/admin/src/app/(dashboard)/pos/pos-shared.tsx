'use client';

import { Label } from '@dhanam/ui';
import type { ReactNode } from 'react';

export const PRODUCTS = ['dhanam', 'karafiel', 'tezca', 'enclii', 'janua', 'routecraft'];
export const PLANS = [
  'essentials',
  'essentials_yearly',
  'pro',
  'pro_yearly',
  'premium',
  'premium_yearly',
];

export function Field({
  label,
  id,
  children,
  className,
}: {
  label: string;
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export function SelectField({
  label,
  id,
  value,
  options,
  onChange,
}: {
  label: string;
  id: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} id={id}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function ErrorBanner({ message, className }: { message: string; className?: string }) {
  return (
    <div
      className={`rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300 ${className || ''}`}
    >
      {message}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-gray-300 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
      {message}
    </div>
  );
}

export function ResultList({
  items,
  className,
}: {
  items: Array<[string, string]>;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md border border-gray-200 p-4 text-sm dark:border-gray-700 ${className || ''}`}
    >
      <div className="grid gap-2">
        {items.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <span className="text-gray-500 dark:text-gray-400">{label}</span>
            <span className="truncate font-medium text-gray-900 dark:text-white">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function formatAmount(amountMinor: number | null, currency: string | null) {
  if (amountMinor === null || !currency) {
    return 'unknown';
  }
  return `${(amountMinor / 100).toFixed(2)} ${currency.toUpperCase()}`;
}
