/**
 * Marketing-site demo CTA must start auth on app.dhan.am — localStorage and
 * API client state do not cross from dhan.am to app.dhan.am.
 */
export function buildAppDemoLaunchUrl(appUrl: string, persona = 'guest'): string {
  const base = appUrl.replace(/\/$/, '');
  const params = new URLSearchParams({ persona });
  return `${base}/demo?${params.toString()}`;
}

/** Full-page navigation to app demo entrypoint (mockable in jsdom tests). */
export function redirectToAppDemo(appUrl: string, persona = 'guest'): void {
  window.location.href = buildAppDemoLaunchUrl(appUrl, persona);
}
