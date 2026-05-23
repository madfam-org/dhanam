/**
 * Best-effort extraction of a CFDI UUID from a Karafiel webhook consumer response.
 * Karafiel may return snake_case or camelCase depending on serializer version.
 */
export function parseKarafielCfdiUuid(responseBody: string): string | null {
  if (!responseBody?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(responseBody) as Record<string, unknown>;
    const candidates = [
      parsed.cfdi_uuid,
      parsed.cfdiUuid,
      parsed.uuid,
      (parsed.data as Record<string, unknown> | undefined)?.cfdi_uuid,
      (parsed.data as Record<string, unknown> | undefined)?.cfdiUuid,
      (parsed.cfdi as Record<string, unknown> | undefined)?.uuid,
    ];

    for (const value of candidates) {
      if (typeof value === 'string' && value.length >= 8) {
        return value;
      }
    }
  } catch {
    return null;
  }

  return null;
}
