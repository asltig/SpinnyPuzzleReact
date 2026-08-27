/**
 * catalogStorage.ts
 * Local persistence for the server catalog (packages + levels, all games).
 * Plain structured JSON in MMKV — matches how jigsawService/patchworkService
 * already cache server data, no separate DB engine.
 */
import { storage } from './mmkv';
import type { CatalogPackage, CatalogLevel } from '../types/catalog';

const KEY_PACKAGES       = 'catalog.packages';
const KEY_LEVELS         = 'catalog.levels';
const KEY_LAST_SYNCED_AT = 'catalog.lastSyncedAt';

// ─── Packages ──────────────────────────────────────────────────────────────

export function getStoredPackages(): CatalogPackage[] {
  const raw = storage.getString(KEY_PACKAGES);
  if (!raw) return [];
  try { return JSON.parse(raw) as CatalogPackage[]; }
  catch { return []; }
}

export function setStoredPackages(packages: CatalogPackage[]): void {
  storage.set(KEY_PACKAGES, JSON.stringify(packages));
}

// ─── Levels ────────────────────────────────────────────────────────────────

export function getStoredLevels(): CatalogLevel[] {
  const raw = storage.getString(KEY_LEVELS);
  if (!raw) return [];
  try { return JSON.parse(raw) as CatalogLevel[]; }
  catch { return []; }
}

export function setStoredLevels(levels: CatalogLevel[]): void {
  storage.set(KEY_LEVELS, JSON.stringify(levels));
}

// ─── Sync bookkeeping ──────────────────────────────────────────────────────

export function getLastSyncedAt(): number | undefined {
  return storage.getNumber(KEY_LAST_SYNCED_AT);
}

export function setLastSyncedAt(timestampMs: number): void {
  storage.set(KEY_LAST_SYNCED_AT, timestampMs);
}
