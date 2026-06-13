'use client';

import { FormEvent, useState } from 'react';

import { adminApi, type RoutePreviewResult } from '@/lib/api/admin';

const initialRouteForm = {
  userId: '',
  product: 'dhanam',
  plan: 'pro',
  countryCode: 'MX',
};

export function usePosRoute() {
  const [routeForm, setRouteForm] = useState(initialRouteForm);
  const [routePreview, setRoutePreview] = useState<RoutePreviewResult | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [overrideProvider, setOverrideProvider] = useState('paddle');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideTtlHours, setOverrideTtlHours] = useState('24');
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [overrideMessage, setOverrideMessage] = useState<string | null>(null);

  const refreshRoutePreview = async () =>
    adminApi.previewCheckoutRoute({
      userId: routeForm.userId.trim(),
      plan: routeForm.plan,
      product: routeForm.product,
      countryCode: routeForm.countryCode.trim().toUpperCase() || undefined,
    });

  const previewRoute = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRouteError(null);
    setRoutePreview(null);

    if (!routeForm.userId.trim()) {
      setRouteError('User ID is required.');
      return;
    }

    setRouteLoading(true);
    try {
      setRoutePreview(await refreshRoutePreview());
    } catch {
      setRouteError('Unable to preview checkout route.');
    } finally {
      setRouteLoading(false);
    }
  };

  const setRouteOverride = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOverrideError(null);
    setOverrideMessage(null);

    if (!routeForm.userId.trim()) {
      setOverrideError('User ID is required.');
      return;
    }
    if (!overrideReason.trim()) {
      setOverrideError('Audit reason is required.');
      return;
    }

    const ttlHours = Number.parseInt(overrideTtlHours, 10);
    if (!Number.isInteger(ttlHours) || ttlHours <= 0) {
      setOverrideError('TTL must be a positive number of hours.');
      return;
    }

    setOverrideLoading(true);
    try {
      await adminApi.setCheckoutRouteOverride({
        userId: routeForm.userId.trim(),
        product: routeForm.product,
        provider: overrideProvider as RoutePreviewResult['provider'],
        reason: overrideReason.trim(),
        ttlHours,
      });
      setOverrideMessage(`Override set: ${routeForm.product} → ${overrideProvider}`);
      setRoutePreview(await refreshRoutePreview());
    } catch {
      setOverrideError('Unable to set checkout route override.');
    } finally {
      setOverrideLoading(false);
    }
  };

  const clearRouteOverride = async () => {
    setOverrideError(null);
    setOverrideMessage(null);

    if (!routeForm.userId.trim()) {
      setOverrideError('User ID is required.');
      return;
    }

    setOverrideLoading(true);
    try {
      await adminApi.clearCheckoutRouteOverride({
        userId: routeForm.userId.trim(),
        product: routeForm.product,
        reason: overrideReason.trim() || 'operator cleared override from POS',
      });
      setOverrideMessage('Route override cleared.');
      setRoutePreview(await refreshRoutePreview());
    } catch {
      setOverrideError('Unable to clear checkout route override.');
    } finally {
      setOverrideLoading(false);
    }
  };

  return {
    routeForm,
    setRouteForm,
    routePreview,
    routeError,
    routeLoading,
    overrideProvider,
    setOverrideProvider,
    overrideReason,
    setOverrideReason,
    overrideTtlHours,
    setOverrideTtlHours,
    overrideLoading,
    overrideError,
    overrideMessage,
    previewRoute,
    setRouteOverride,
    clearRouteOverride,
  };
}
