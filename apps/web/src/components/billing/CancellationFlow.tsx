'use client';

import { Button } from '@dhanam/ui';
import { usePostHog } from 'posthog-js/react';
import { useState } from 'react';

const REASONS = [
  { value: 'too_expensive', label: 'Es demasiado caro para mi presupuesto', emoji: '💰' },
  { value: 'missing_features', label: 'No tiene funciones que necesito', emoji: '🔧' },
  { value: 'switched_service', label: 'Cambie a otra herramienta', emoji: '🔄' },
  { value: 'unused', label: 'No lo estoy usando lo suficiente', emoji: '📉' },
  { value: 'technical_issues', label: 'Tuve problemas tecnicos', emoji: '⚙️' },
  { value: 'other', label: 'Otra razon', emoji: '💬' },
] as const;

interface SaveOffer {
  type: 'discount' | 'pause' | 'roadmap' | 'support' | 'loss_aversion';
  intentId: string;
  discountPercent?: number;
  discountMonths?: number;
  suggestedPauseMonths?: number[];
  message?: string;
  features?: string[];
  supportUrl?: string;
}

interface CancellationFlowProps {
  open: boolean;
  onClose: () => void;
  onCancelled: () => void;
  tier: string;
}

type Step = 'reason' | 'save_offer' | 'confirm';

export function CancellationFlow({ open, onClose, onCancelled, tier }: CancellationFlowProps) {
  const posthog = usePostHog();
  const [step, setStep] = useState<Step>('reason');
  const [reason, setReason] = useState<string>('');
  const [reasonText, setReasonText] = useState('');
  const [saveOffer, setSaveOffer] = useState<SaveOffer | null>(null);
  const [loading, setLoading] = useState(false);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmitReason = async () => {
    if (!reason) return;
    setLoading(true);
    try {
      const res = await fetch('/api/billing/cancel-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, reasonText: reasonText || undefined }),
      });
      const data = await res.json();
      setSaveOffer(data.saveOffer);
      setStep('save_offer');
      posthog?.capture('cancel_intent_shown', { reason, tier });
    } catch {
      // Fallback: skip to confirm
      setStep('confirm');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOffer = async () => {
    if (!saveOffer) return;
    setLoading(true);
    try {
      if (saveOffer.type === 'discount') {
        await fetch('/api/billing/save-offer/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intentId: saveOffer.intentId }),
        });
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (months: number) => {
    if (!saveOffer) return;
    setLoading(true);
    try {
      await fetch('/api/billing/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentId: saveOffer.intentId, months }),
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!saveOffer) return;
    setLoading(true);
    try {
      const res = await fetch('/api/billing/cancel-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentId: saveOffer.intentId }),
      });
      const data = await res.json();
      setPeriodEnd(data.periodEnd);
      onCancelled();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        {/* ── Step 1: Reason ── */}
        {step === 'reason' && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Nos encantaria entender
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Que no esta funcionando para ti? Tu respuesta nos ayuda a mejorar.
            </p>

            <div className="mt-5 space-y-2">
              {REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${
                    reason === r.value
                      ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/30'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="cancel-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={(e) => setReason(e.target.value)}
                    className="sr-only"
                  />
                  <span className="text-lg">{r.emoji}</span>
                  <span className="text-sm text-slate-700 dark:text-slate-300">{r.label}</span>
                </label>
              ))}
            </div>

            {reason === 'other' && (
              <textarea
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder="Cuentanos mas..."
                maxLength={500}
                className="mt-3 w-full rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                rows={3}
              />
            )}

            <div className="mt-6 flex gap-3">
              <Button variant="ghost" onClick={onClose} className="flex-1">
                Mejor me quedo
              </Button>
              <Button onClick={handleSubmitReason} disabled={!reason || loading} className="flex-1">
                {loading ? 'Procesando...' : 'Continuar'}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Save Offer ── */}
        {step === 'save_offer' && saveOffer && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {saveOffer.type === 'discount' && 'Tenemos algo para ti'}
              {saveOffer.type === 'pause' && 'Toma un descanso'}
              {saveOffer.type === 'roadmap' && 'Algo nuevo viene en camino'}
              {saveOffer.type === 'support' && 'Queremos ayudarte'}
              {saveOffer.type === 'loss_aversion' && 'Antes de irte'}
            </h2>

            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{saveOffer.message}</p>

            {saveOffer.type === 'loss_aversion' && saveOffer.features && (
              <ul className="mt-3 space-y-1">
                {saveOffer.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
                  >
                    <span className="text-red-400">✕</span> {f}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 space-y-2">
              {saveOffer.type === 'discount' && (
                <Button onClick={handleAcceptOffer} disabled={loading} className="w-full">
                  {loading ? 'Aplicando...' : `Obtener ${saveOffer.discountPercent}% de descuento`}
                </Button>
              )}

              {saveOffer.type === 'pause' && saveOffer.suggestedPauseMonths && (
                <div className="flex gap-2">
                  {saveOffer.suggestedPauseMonths.map((m) => (
                    <Button
                      key={m}
                      variant="secondary"
                      onClick={() => handlePause(m)}
                      disabled={loading}
                      className="flex-1"
                    >
                      {m} {m === 1 ? 'mes' : 'meses'}
                    </Button>
                  ))}
                </div>
              )}

              {saveOffer.type === 'support' && saveOffer.supportUrl && (
                <a
                  href={saveOffer.supportUrl}
                  className="block w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-indigo-500"
                >
                  Contactar soporte
                </a>
              )}

              {(saveOffer.type === 'roadmap' || saveOffer.type === 'loss_aversion') && (
                <Button onClick={onClose} className="w-full">
                  Me quedo un poco mas
                </Button>
              )}

              <button
                onClick={() => setStep('confirm')}
                className="mt-2 w-full text-center text-sm text-slate-400 hover:text-slate-500 dark:hover:text-slate-300"
              >
                Continuar con la cancelacion
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Confirm ── */}
        {step === 'confirm' && (
          <div>
            {periodEnd ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <span className="text-2xl">👋</span>
                </div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Tu plan se mantiene activo
                </h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Hasta el{' '}
                  <strong>
                    {new Date(periodEnd).toLocaleDateString('es-MX', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </strong>
                  . No se realizaran mas cobros.
                </p>
                <Button onClick={onClose} className="mt-6">
                  Entendido
                </Button>
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Confirmar cancelacion
                </h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Tu plan permanecera activo hasta el final del periodo actual. No se realizaran mas
                  cobros despues de esa fecha.
                </p>
                <div className="mt-6 flex gap-3">
                  <Button variant="ghost" onClick={() => setStep('save_offer')} className="flex-1">
                    Volver
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleConfirmCancel}
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? 'Cancelando...' : 'Confirmar cancelacion'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
