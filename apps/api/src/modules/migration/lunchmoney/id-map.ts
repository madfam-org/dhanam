/**
 * Maintains a mapping between LunchMoney IDs and Dhanam UUIDs
 * for idempotent migration across all entity types.
 */
export class IdMap {
  private maps: Map<string, Map<string, string>> = new Map();

  private key(lmId: number | string): string {
    return String(lmId);
  }

  set(entityType: string, lmId: number | string, dhanamId: string): void {
    if (!this.maps.has(entityType)) {
      this.maps.set(entityType, new Map());
    }
    this.maps.get(entityType)!.set(this.key(lmId), dhanamId);
  }

  get(entityType: string, lmId: number | string): string | undefined {
    return this.maps.get(entityType)?.get(this.key(lmId));
  }

  has(entityType: string, lmId: number | string): boolean {
    return this.maps.get(entityType)?.has(this.key(lmId)) ?? false;
  }

  getAll(entityType: string): Map<string, string> {
    return this.maps.get(entityType) || new Map();
  }

  count(entityType: string): number {
    return this.maps.get(entityType)?.size ?? 0;
  }

  summary(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [type, map] of this.maps) {
      result[type] = map.size;
    }
    return result;
  }
}
