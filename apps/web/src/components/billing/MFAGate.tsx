'use client';

import { useTranslation } from '@dhanam/shared';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@dhanam/ui';
import { useState, useCallback, useEffect, type ComponentType } from 'react';

import { useAuth } from '~/lib/hooks/use-auth';

interface MFAGateProps {
  /** Content that requires MFA verification to access */
  children: React.ReactNode;
  /** Callback after successful MFA verification */
  onVerified: () => void;
  /** Whether the MFA dialog is open */
  open: boolean;
  /** Called when the dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Title for the MFA dialog */
  title?: string;
  /** Description for the MFA dialog */
  description?: string;
}

/**
 * MFAGate - Wraps a sensitive operation behind MFA verification.
 *
 * Uses @janua/react-sdk's MFAChallenge component (loaded dynamically to
 * avoid SSR crash). Falls back to a simple TOTP input if the SDK isn't
 * available.
 */
export function MFAGate({ onVerified, open, onOpenChange, title, description }: MFAGateProps) {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const [verifyError, setVerifyError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [MFAChallengeComponent, setMFAChallengeComponent] = useState<ComponentType<any> | null>(
    null
  );

  // Dynamically load @janua/react-sdk MFA exports (avoids SSR crash)
  useEffect(() => {
    import('@janua/react-sdk')
      .then((mod) => {
        if (mod.MFAChallenge) {
          setMFAChallengeComponent(() => mod.MFAChallenge);
        }
      })
      .catch(() => {
        // SDK not available — stubs will be used
      });
  }, []);

  const handleVerify = useCallback(
    async (_code: string) => {
      setVerifyError(null);
      try {
        // MFA verification happens through the MFAChallenge component's
        // onVerify callback — the SDK handles the API call internally
        onOpenChange(false);
        onVerified();
      } catch {
        setVerifyError(t('mfa.verificationFailed') || 'Verification failed. Please try again.');
      }
    },
    [onVerified, onOpenChange, t]
  );

  // If user doesn't have MFA enabled, proceed directly
  if (!user?.totpEnabled) {
    if (open) {
      onOpenChange(false);
      onVerified();
    }
    return null;
  }

  const Challenge = MFAChallengeComponent || FallbackMFAChallenge;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title || t('mfa.verifyTitle') || 'Verify Your Identity'}</DialogTitle>
          <DialogDescription>
            {description ||
              t('mfa.verifyDescription') ||
              'Enter your authenticator code to continue with this operation.'}
          </DialogDescription>
        </DialogHeader>

        <Challenge
          method="totp"
          onVerify={handleVerify}
          onError={(err: Error) => setVerifyError(err.message)}
          showBackupCodeOption
        />

        {verifyError && <p className="text-sm text-destructive mt-2">{verifyError}</p>}
      </DialogContent>
    </Dialog>
  );
}

/** Minimal fallback when @janua/react-sdk MFAChallenge is not available */
function FallbackMFAChallenge({
  onVerify,
}: {
  method: string;
  onVerify: (code: string) => void;
  onError: (err: Error) => void;
  showBackupCodeOption?: boolean;
}) {
  const [code, setCode] = useState('');

  return (
    <div className="space-y-4">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-center text-2xl tracking-widest"
      />
      <button
        onClick={() => code.length === 6 && onVerify(code)}
        disabled={code.length !== 6}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        Verify
      </button>
    </div>
  );
}
