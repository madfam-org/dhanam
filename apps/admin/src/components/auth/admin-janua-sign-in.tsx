'use client';

import { SignIn } from '@janua/react-sdk';
import { useEffect, useRef } from 'react';

import { adminJanuaAuthUrls } from '@/lib/janua-auth-urls';

type AdminJanuaSignInProps = {
  redirectTo: string;
  onSuccess?: () => void;
};

function patchAuthLinks(root: HTMLElement) {
  for (const link of root.querySelectorAll('a')) {
    const label = link.textContent?.trim() ?? '';
    if (label === 'Forgot password?') {
      link.href = adminJanuaAuthUrls.forgotPasswordUrl;
    } else if (label === 'Terms of Service') {
      link.href = adminJanuaAuthUrls.termsUrl;
    } else if (label === 'Privacy Policy') {
      link.href = adminJanuaAuthUrls.privacyUrl;
    }
  }
}

function patchSocialButtons(root: HTMLElement) {
  for (const button of root.querySelectorAll('button')) {
    const label = button.textContent?.trim() ?? '';
    if (label === 'Continue with GitHub') {
      button.classList.add('admin-oauth-github');
    } else if (label === 'Continue with Google') {
      button.classList.add('admin-oauth-google');
    }
  }
}

function patchJanuaSignIn(root: HTMLElement) {
  patchAuthLinks(root);
  patchSocialButtons(root);
}

/** Janua SignIn with admin-scoped link targets (react-sdk omits URL props). */
export function AdminJanuaSignIn({ redirectTo, onSuccess }: AdminJanuaSignInProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    patchJanuaSignIn(root);

    const observer = new MutationObserver(() => patchJanuaSignIn(root));
    observer.observe(root, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="admin-janua-sign-in">
      <SignIn
        redirectTo={redirectTo}
        enableSSO
        socialProviders={{ google: true, github: true }}
        showRememberMe
        onSuccess={onSuccess}
      />
    </div>
  );
}
