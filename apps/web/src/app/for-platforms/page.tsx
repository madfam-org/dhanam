import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Globe2,
  Webhook,
  Shield,
  Code2,
  Receipt,
  Building2,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'For platforms — One billing API. Stripe + SPEI + OXXO + Conekta. | Dhanam',
  description:
    'The central billing platform for the MADFAM ecosystem. Stripe MX SPEI bank-transfer settlement, Conekta routing for Mexican cards/OXXO/SPEI via Janua, signed webhook fan-out to consumer products. Stop wiring 4 payment providers per tenant.',
  openGraph: {
    title: 'Dhanam for platforms — one billing API, every Mexican payment rail',
    description:
      'Funnel your SaaS payments through one Stripe + Conekta integration. HMAC-signed webhooks to your consumer code.',
    type: 'website',
  },
};

const PAINS = [
  {
    pain: 'Wiring Stripe + Conekta + SPEI + OXXO into every SaaS you launch.',
    fix: 'One Dhanam integration covers all four. Funnel every payment through us, get HMAC-signed events back.',
  },
  {
    pain: 'Mexican customers want SPEI bank transfers — your billing stack only does cards.',
    fix: 'Native Stripe MX SPEI PaymentIntents with CLABE-based settlement. No third-party redirect, no hosted page.',
  },
  {
    pain: 'Conekta SDKs in three different services drifting apart.',
    fix: "Conekta lives in Janua's billing relay. You never touch the SDK; you receive normalized events.",
  },
  {
    pain: 'Building reconciliation between Stripe events, your SaaS DB, and your CFDI system.',
    fix: 'Dhanam holds the BillingEvent ledger. Karafiel auto-stamps CFDIs on every Mexican order. Your SaaS just listens.',
  },
];

const CAPABILITIES = [
  {
    icon: CreditCard,
    title: 'Stripe MX SPEI',
    body: 'Native MXN bank-transfer PaymentIntents with idempotency keys. Settles to your CLABE, not a third party.',
  },
  {
    icon: Globe2,
    title: '30+ currencies + Banxico FX',
    body: "Spot, DOF, settled rates. RFC 0011 — every consumer in the ecosystem uses Dhanam's FX surface, not openexchangerates direct.",
  },
  {
    icon: Webhook,
    title: 'HMAC-signed webhook fan-out',
    body: 'PRODUCT_WEBHOOK_URLS env var: register your endpoint, receive normalized payment.succeeded / failed / refunded events. SHA-256 signed, idempotent.',
  },
  {
    icon: Receipt,
    title: 'CFDI handoff via Karafiel',
    body: 'Mexican orders auto-stamp legal CFDI 4.0 invoices via Karafiel. Per-tenant e.firma upload (Wave E, shipping).',
  },
  {
    icon: Building2,
    title: 'Subscription lifecycle, not just one-shot',
    body: 'Trial → active → past-due → cancelled. Pause, save-offer, retention discount, customer portal — all via Janua billing relay.',
  },
  {
    icon: Code2,
    title: 'Predictable contract',
    body: 'OpenAPI spec. Stable webhook envelope. Every event documented. Every secret rotation tracked.',
  },
];

const ECOSYSTEM = [
  { who: 'Cotiza Studio', uses: 'Per-milestone services-mode invoices via DhanamMilestoneService' },
  { who: 'Karafiel', uses: 'Receives payment.succeeded events → auto-issues CFDI 4.0' },
  {
    who: 'Tezca',
    uses: 'Receives subscription.activated/upgraded webhooks → updates API key tier',
  },
  { who: 'PhyneCRM', uses: 'Receives engagement-tagged payment events for client timeline' },
];

export default function ForPlatformsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="container mx-auto px-6 py-20 lg:py-24 max-w-5xl">
        <p className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-primary mb-6 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5">
          <Shield className="w-3 h-3" />
          For SaaS platforms + ecosystems
        </p>
        <h1 className="text-4xl lg:text-6xl font-bold tracking-tight mb-4">
          One billing API.
          <span className="block text-primary mt-2">Every Mexican payment rail.</span>
        </h1>
        <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl mb-8">
          Stripe + Stripe MX SPEI + Conekta cards + OXXO + Banxico FX, all funneled through one
          signed-webhook integration. Stop wiring four providers into every SaaS you ship. Dhanam is
          the central billing surface for the MADFAM ecosystem — and yours, if you want it.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="mailto:hola@dhan.am?subject=Platform+billing+integration"
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            Schedule a 30-min call
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="https://api.dhan.am/docs"
            className="inline-flex items-center justify-center gap-2 border border-border px-6 py-3 rounded-lg font-semibold hover:bg-muted transition-colors"
          >
            See the OpenAPI spec
          </Link>
        </div>
      </section>

      <section className="py-16 bg-muted/30 border-y border-border/40">
        <div className="container mx-auto px-6 max-w-5xl">
          <h2 className="text-2xl lg:text-3xl font-bold mb-10 text-center">
            The pains we kill for platform builders
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {PAINS.map((p, i) => (
              <article key={i} className="rounded-lg border border-border/60 bg-card p-6">
                <p className="text-sm font-mono uppercase tracking-wider text-destructive/80 mb-2">
                  Pain
                </p>
                <p className="font-medium mb-4">{p.pain}</p>
                <p className="text-sm font-mono uppercase tracking-wider text-primary/80 mb-2">
                  Fix
                </p>
                <p className="text-sm text-muted-foreground">{p.fix}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-6 max-w-5xl">
          <h2 className="text-2xl lg:text-3xl font-bold mb-10 text-center">
            What ships in the platform tier
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {CAPABILITIES.map(({ icon: Icon, title, body }) => (
              <article key={title} className="rounded-lg border border-border/60 bg-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold">{title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-muted/20 border-y border-border/40">
        <div className="container mx-auto px-6 max-w-4xl">
          <h2 className="text-2xl lg:text-3xl font-bold mb-3 text-center">
            Already powering the MADFAM ecosystem
          </h2>
          <p className="text-center text-muted-foreground mb-10">
            Same contract. Same webhook envelope. Same SDK. Battle-tested in production across 4
            platforms today.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ECOSYSTEM.map(({ who, uses }) => (
              <div
                key={who}
                className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-4"
              >
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">{who}</p>
                  <p className="text-xs text-muted-foreground">{uses}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-6 text-center max-w-3xl">
          <h2 className="text-3xl font-bold mb-4">30 minutes, real numbers.</h2>
          <p className="text-lg text-muted-foreground mb-6">
            Most platform integrations come in via a single 30-minute call to scope your Stripe
            account, Conekta credentials, MES dispatch, and CFDI flow. We send sample numbers from a
            comparable platform before the call.
          </p>
          <Link
            href="mailto:hola@dhan.am?subject=Platform+billing+integration"
            className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
          >
            Schedule the call →
          </Link>
        </div>
      </section>
    </main>
  );
}
