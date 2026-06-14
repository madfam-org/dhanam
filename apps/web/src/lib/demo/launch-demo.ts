/**
 * Marketing-site demo CTA must start auth on app.dhan.am — localStorage and
 * API client state do not cross from dhan.am to app.dhan.am.
 *
 * When `persona` is omitted, the URL points at the demo persona picker so the
 * visitor chooses their own path. When a specific persona is provided (e.g. a
 * landing persona card), the picker auto-launches that persona.
 */
export function buildAppDemoLaunchUrl(appUrl: string, persona?: string): string {
  const base = appUrl.replace(/\/$/, '');
  if (!persona) {
    return `${base}/demo`;
  }
  const params = new URLSearchParams({ persona });
  return `${base}/demo?${params.toString()}`;
}

/** Full-page navigation to app demo entrypoint (mockable in jsdom tests). */
export function redirectToAppDemo(appUrl: string, persona?: string): void {
  window.location.href = buildAppDemoLaunchUrl(appUrl, persona);
}
