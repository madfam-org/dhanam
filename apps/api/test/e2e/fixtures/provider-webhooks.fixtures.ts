import * as crypto from 'crypto';

export const plaidWebhookFixtures = {
  transactionsInitialUpdate: (itemId: string, accountIds: string[]) => ({
    webhook_type: 'TRANSACTIONS',
    webhook_code: 'INITIAL_UPDATE',
    item_id: itemId,
    account_ids: accountIds,
    new_transactions: 15,
  }),

  transactionsDefaultUpdate: (itemId: string, accountIds: string[]) => ({
    webhook_type: 'TRANSACTIONS',
    webhook_code: 'DEFAULT_UPDATE',
    item_id: itemId,
    account_ids: accountIds,
    new_transactions: 5,
  }),

  balanceUpdate: (itemId: string, accountIds: string[]) => ({
    webhook_type: 'ITEM',
    webhook_code: 'PENDING_EXPIRATION',
    item_id: itemId,
    account_ids: accountIds,
  }),

  itemLoginRequired: (itemId: string) => ({
    webhook_type: 'ITEM',
    webhook_code: 'ERROR',
    item_id: itemId,
    error: {
      error_type: 'ITEM_ERROR',
      error_code: 'ITEM_LOGIN_REQUIRED',
      error_message:
        'The login details for this item have changed (credentials, MFA, or required user action).',
    },
  }),
};

export const belvoWebhookFixtures = {
  accountsCreated: (linkId: string) => ({
    event_type: 'ACCOUNTS_CREATED',
    link_id: linkId,
    request_id: `req_${crypto.randomUUID().slice(0, 8)}`,
    data: {
      accounts: ['acct_belvo_1', 'acct_belvo_2'],
    },
  }),

  transactionsCreated: (linkId: string, accountId: string) => ({
    event_type: 'TRANSACTIONS_CREATED',
    link_id: linkId,
    request_id: `req_${crypto.randomUUID().slice(0, 8)}`,
    data: {
      account_id: accountId,
      count: 25,
    },
  }),
};

/**
 * Generates an HMAC signature for webhook payload verification.
 * Uses the same algorithm as the real webhook verification utilities.
 */
export function generateWebhookHmac(
  payload: string,
  secret: string,
  algorithm: 'sha256' | 'sha512' = 'sha256'
): string {
  return crypto.createHmac(algorithm, secret).update(payload).digest('hex');
}
