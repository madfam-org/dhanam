# Key Rotation Procedure

## Overview

Dhanam uses AES-256-GCM encryption with versioned ciphertext format (`v1:iv:tag:ciphertext`).
Key rotation re-encrypts all sensitive data from the old key to a new key.

## Prerequisites

- Database backup completed
- Maintenance window scheduled
- New ENCRYPTION_KEY generated: `openssl rand -hex 32`

## Rotation Steps

### 1. Generate New Key

```bash
NEW_KEY=$(openssl rand -hex 32)
echo "New key: $NEW_KEY"
```

### 2. Set Environment Variables

```bash
export OLD_ENCRYPTION_KEY=$ENCRYPTION_KEY
export NEW_ENCRYPTION_KEY=$NEW_KEY
```

### 3. Run Rotation Script

```bash
# This re-encrypts: provider tokens, TOTP secrets, encrypted credentials
pnpm ts-node scripts/rotate-encryption-key.ts
```

### 4. Update Production Config

Update `ENCRYPTION_KEY` in your secrets manager / Enclii config to the new key.

### 5. Deploy

Deploy the updated configuration. The CryptoService handles both old and new format transparently.

### 6. Verify

- Test login flow
- Test provider connections
- Test TOTP verification
- Verify audit logs show successful decryption

## Rollback

If rotation fails:

1. Restore database from backup
2. Revert ENCRYPTION_KEY to old value
3. Redeploy

## Schedule

- Rotate encryption keys every 90 days
- Rotate after any suspected key compromise
- Document rotation in audit log
