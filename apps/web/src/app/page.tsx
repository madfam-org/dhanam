import { redirect } from 'next/navigation';

/**
 * Legacy root route. On `dhan.am`, middleware redirects `/` → `/{locale}`.
 * This redirect covers local dev and any direct hits to `/` on the web app host.
 */
export default function RootPage() {
  redirect('/en');
}
