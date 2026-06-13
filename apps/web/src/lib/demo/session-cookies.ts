/** Shared cookie helpers for demo/guest sessions across dhan.am subdomains. */
export function getDhanamCookieDomainAttr(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.location.hostname.endsWith('.dhan.am') ? ' Domain=.dhan.am;' : '';
}

export function setDemoModeCookie(maxAgeSeconds = 7200): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `demo-mode=true; path=/;${getDhanamCookieDomainAttr()} max-age=${maxAgeSeconds}; SameSite=Lax`;
}

export function clearStaleAuthStorageCookie(): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `auth-storage=; path=/;${getDhanamCookieDomainAttr()} max-age=0; SameSite=Lax`;
}
