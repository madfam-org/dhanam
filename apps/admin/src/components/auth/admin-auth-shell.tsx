import { Shield } from 'lucide-react';
import type { ReactNode } from 'react';

type AdminAuthShellProps = {
  children: ReactNode;
  /** Shown while client-only auth UI hydrates */
  loading?: boolean;
};

export function AdminAuthShell({ children, loading = false }: AdminAuthShellProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to sign in
      </a>
      <div className="w-full max-w-md p-6 sm:p-8">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Shield className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dhanam Admin</h1>
          <p className="mt-2 text-sm text-muted-foreground">Operator console</p>
        </header>
        <main id="main" aria-labelledby="admin-login-heading">
          {loading ? (
            <div
              className="rounded-lg border border-border bg-card p-8 shadow-sm"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <p className="text-center text-sm text-muted-foreground">Loading sign-in…</p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
