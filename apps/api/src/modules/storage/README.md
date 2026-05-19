# Storage Module

> Document storage via Cloudflare R2 with presigned URL support for secure file uploads and downloads.

## Purpose

The Storage module provides a global document storage service using Cloudflare R2 (S3-compatible object storage). It handles file uploads, downloads, and management for asset attachments throughout the application, with presigned URLs enabling direct browser-to-storage transfers.

## Key Entities

| Entity               | Description                        |
| -------------------- | ---------------------------------- |
| `UploadedDocument`   | Stored document metadata           |
| `PresignedUrlResult` | Upload URL with expiry information |

### Uploaded Document Structure

```typescript
interface UploadedDocument {
  key: string; // Storage path
  url: string; // Public URL (if configured)
  filename: string; // Original filename
  fileType: string; // MIME type
  fileSize: number; // Size in bytes
  category: string; // Document category
  uploadedAt: string; // ISO timestamp
}
```

### Presigned URL Result

```typescript
interface PresignedUrlResult {
  uploadUrl: string; // Presigned PUT URL
  key: string; // Storage key for confirmation
  expiresAt: string; // URL expiry timestamp
}
```

## Service Methods

The `R2StorageService` is a global service available throughout the application.

| Method                      | Description                       |
| --------------------------- | --------------------------------- |
| `isAvailable()`             | Check if R2 storage is configured |
| `getPresignedUploadUrl()`   | Generate URL for browser upload   |
| `getPresignedDownloadUrl()` | Generate URL for browser download |
| `uploadFile()`              | Server-side direct upload         |
| `deleteFile()`              | Remove file from storage          |
| `fileExists()`              | Check if file exists              |
| `getPublicUrl()`            | Get public URL for file           |

### Method Signatures

```typescript
// Generate upload URL for browser
async getPresignedUploadUrl(
  spaceId: string,
  assetId: string,
  filename: string,
  contentType: string,
  category?: string
): Promise<PresignedUrlResult>

// Generate download URL
async getPresignedDownloadUrl(
  key: string,
  expiresIn?: number  // Seconds, default 3600
): Promise<string>

// Direct server upload
async uploadFile(
  spaceId: string,
  assetId: string,
  buffer: Buffer,
  filename: string,
  contentType: string,
  category?: string
): Promise<UploadedDocument>

// Delete file
async deleteFile(key: string): Promise<void>

// Check existence
async fileExists(key: string): Promise<boolean>
```

## Storage Structure

Files are organized by space and asset:

```
{bucket}/
  spaces/
    {spaceId}/
      assets/
        {assetId}/
          {category}/
            {uuid}.{extension}
```

### Example Key

```
spaces/abc123/assets/def456/deed/550e8400-e29b-41d4-a716-446655440000.pdf
```

## Usage Examples

### Browser Upload Flow

```typescript
// 1. Request presigned URL from API
const { uploadUrl, key } = await fetch(
  '/manual-assets/:id/documents/upload-url?' +
    new URLSearchParams({
      filename: 'deed.pdf',
      contentType: 'application/pdf',
      category: 'deed',
    })
).then((r) => r.json());

// 2. Upload directly to R2
await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: {
    'Content-Type': 'application/pdf',
  },
});

// 3. Confirm upload with API
await fetch('/manual-assets/:id/documents/confirm', {
  method: 'POST',
  body: JSON.stringify({
    key,
    filename: 'deed.pdf',
    fileType: 'application/pdf',
    fileSize: file.size,
    category: 'deed',
  }),
});
```

### Server-Side Upload

```typescript
const document = await r2StorageService.uploadFile(
  spaceId,
  assetId,
  fileBuffer,
  'document.pdf',
  'application/pdf',
  'general'
);
// Returns: { key, url, filename, fileType, fileSize, category, uploadedAt }
```

### Download URL Generation

```typescript
const downloadUrl = await r2StorageService.getPresignedDownloadUrl(
  documentKey,
  3600 // 1 hour expiry
);
// Client fetches from downloadUrl directly
```

## Configuration

### Environment Variables

| Variable               | Description                  | Required                         |
| ---------------------- | ---------------------------- | -------------------------------- |
| `R2_ACCOUNT_ID`        | Cloudflare account ID        | Yes                              |
| `R2_ACCESS_KEY_ID`     | R2 API access key ID         | Yes                              |
| `R2_SECRET_ACCESS_KEY` | R2 API secret key            | Yes                              |
| `R2_BUCKET_NAME`       | Storage bucket name          | No (default: `dhanam-documents`) |
| `R2_PUBLIC_URL`        | Public URL prefix for bucket | No                               |

### Service Initialization

```typescript
// Storage availability depends on configuration
if (accountId && accessKeyId && secretAccessKey) {
  // R2 client initialized
  this.logger.log('R2 Storage initialized');
} else {
  // Storage disabled
  this.logger.warn('R2 Storage not configured - document uploads will be disabled');
}
```

### Presigned URL Configuration

```typescript
const PRESIGNED_CONFIG = {
  uploadExpiry: 3600, // 1 hour for uploads
  downloadExpiry: 3600, // 1 hour for downloads
};
```

## Module Registration

The Storage module is registered as `@Global()` for application-wide availability:

```typescript
@Global()
@Module({
  imports: [ConfigModule],
  providers: [R2StorageService],
  exports: [R2StorageService],
})
export class StorageModule {}
```

## Related Modules

| Module                          | Relationship                                |
| ------------------------------- | ------------------------------------------- |
| `manual-assets`                 | Primary consumer for asset document storage |
| `manual-assets/DocumentService` | High-level document management              |

## File Metadata

Uploaded files include metadata stored with the object:

```typescript
Metadata: {
  'original-filename': filename,
  'space-id': spaceId,
  'asset-id': assetId,
  'category': category,
}
```

## Testing

```bash
# Run storage tests
pnpm test -- r2

# Run with coverage
pnpm test:cov -- r2
```

### Test Files

- `r2.service.spec.ts` - R2 storage service tests

### Key Test Scenarios

1. Service availability check
2. Presigned upload URL generation
3. Presigned download URL generation
4. Direct file upload
5. File deletion
6. File existence check
7. Public URL generation
8. Unconfigured storage handling

## Security Considerations

- **Presigned URLs**: Time-limited (1 hour default) to prevent abuse
- **Key structure**: Includes spaceId and assetId for authorization tracking
- **No direct access**: All operations through presigned URLs or server-side
- **Content-Type validation**: MIME type specified in presigned URL
- **Metadata tracking**: Original filename and context stored with file

## Error Handling

| Scenario          | Behavior                                           |
| ----------------- | -------------------------------------------------- |
| R2 not configured | `isAvailable()` returns false, methods throw error |
| Invalid key       | S3 client throws NotFound error                    |
| Upload failed     | Client receives error from R2 directly             |
| Expired URL       | R2 rejects with 403 Forbidden                      |

## Cloudflare R2 Features Used

- **S3-compatible API**: Uses AWS SDK v3 for S3
- **Presigned URLs**: Browser-direct uploads and downloads
- **Object metadata**: Custom headers stored with files
- **Regional auto**: Automatic region selection

---

**Module**: `storage`
**Last Updated**: January 2025
