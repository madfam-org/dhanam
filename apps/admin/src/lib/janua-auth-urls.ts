/** Canonical consumer-app URLs for Janua auth footer / recovery links on admin. */
const appBase = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.dhan.am').replace(/\/$/, '');

export const adminJanuaAuthUrls = {
  forgotPasswordUrl: `${appBase}/forgot-password`,
  termsUrl: `${appBase}/terms`,
  privacyUrl: `${appBase}/privacy`,
} as const;
