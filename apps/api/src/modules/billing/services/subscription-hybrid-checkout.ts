import { Logger } from '@nestjs/common';

import { AuditService } from '@core/audit/audit.service';

import {
  CheckoutRoutingContext,
  CheckoutRoutingPolicyService,
} from './checkout-routing-policy.service';
import { CheckoutResult, UpgradeOptions } from './subscription-lifecycle.service';

export function buildCheckoutRoutingContext(
  userId: string,
  countryCode: string,
  webUrl: string,
  options: UpgradeOptions
): CheckoutRoutingContext {
  const plan = options.plan || 'pro';
  return {
    userId,
    plan,
    product: options.product,
    countryCode: countryCode.toUpperCase(),
    successUrl: options.successUrl || `${webUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: options.cancelUrl || `${webUrl}/billing/cancel`,
    orgId: options.orgId,
    source: options.source,
    operatorId: options.operatorId,
    paymentMethod: options.paymentMethod as CheckoutRoutingContext['paymentMethod'],
    amountMinor: options.amountMinor,
    currency: options.currency?.toUpperCase(),
  };
}

export async function tryHybridSubscriptionCheckout(
  checkoutRouting: CheckoutRoutingPolicyService | undefined,
  audit: AuditService,
  logger: Logger,
  userId: string,
  countryCode: string,
  webUrl: string,
  options: UpgradeOptions
): Promise<CheckoutResult | null> {
  if (!checkoutRouting) {
    return null;
  }

  const context = buildCheckoutRoutingContext(userId, countryCode, webUrl, options);
  const hybrid = await checkoutRouting.tryHybridCheckout(context);
  if (!hybrid) {
    return null;
  }

  await audit.log({
    userId,
    action: 'BILLING_UPGRADE_INITIATED',
    severity: 'medium',
    metadata: {
      sessionId: hybrid.sessionId,
      provider: hybrid.provider,
      orgId: options.orgId,
      plan: options.plan,
      product: options.product,
      source: options.source,
      operatorId: options.operatorId,
      route: 'hybrid_router',
      currency: hybrid.currency,
    },
  });

  logger.log(
    `Checkout routed via hybrid router (${hybrid.provider}) for user ${userId}${options.orgId ? ` (org: ${options.orgId})` : ''}`
  );

  return {
    checkoutUrl: hybrid.checkoutUrl,
    provider: hybrid.provider,
    sessionId: hybrid.sessionId,
  };
}
