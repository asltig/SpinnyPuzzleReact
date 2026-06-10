/**
 * progressStorage.ts
 * MMKV-backed persistence for level completion and resume state.
 *
 * ─── Two responsibilities ─────────────────────────────────────────────────────
 *   1. Completed-level set — O(1) read during gameplay.
 *      Key format mirrors original ObjC: "packageName_levelName"
 *      Original: AppManager.saveCompletedLevel / isLevelCompleted
 *                + Level.levelCompleted CoreData boolean
 *
 *   2. Last-played-level record — used to offer "Continue" in the level picker.
 *      Original: NSUserDefaults "lastLevel" / "lastPackage" keys in AppManager.
 *
 * ─── No WatermelonDB dependency ───────────────────────────────────────────────
 *   Step 3 (this step): MMKV only. WatermelonDB writes will be layered on top
 *   in Step 4 without changing this file's API.
 */
import { storage } from './mmkv';

// ─── MMKV keys ────────────────────────────────────────────────────────────────
const KEY_COMPLETED_KEYS = 'progress.completedLevelKeys';   // JSON array of strings
const KEY_LAST_PACKAGE   = 'progress.lastPackageName';
const KEY_LAST_LEVEL     = 'progress.lastLevelName';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Completed-level set
// ═══════════════════════════════════════════════════════════════════════════════

/** Build the canonical key for a level.
 *  Original: [NSString stringWithFormat:@"%@_%@", packageName, levelName] */
export function levelKey(packageName: string, levelName: string): string {
  return `${packageName}_${levelName}`;
}

function loadCompletedSet(): Set<string> {
  const raw = storage.getString(KEY_COMPLETED_KEYS);
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? new Set(arr as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveCompletedSet(set: Set<string>): void {
  storage.set(KEY_COMPLETED_KEYS, JSON.stringify([...set]));
}

/** Mark a level as completed. Idempotent. */
export function markLevelCompleted(key: string): void {
  const set = loadCompletedSet();
  set.add(key);
  saveCompletedSet(set);
}

/** O(1) completion check. */
export function isLevelCompleted(key: string): boolean {
  return loadCompletedSet().has(key);
}

/** Return all completed keys as a plain array (for hydrating the in-memory store). */
export function getAllCompletedKeys(): string[] {
  return [...loadCompletedSet()];
}

/** Bulk-overwrite completed keys (used after a WatermelonDB sync in Step 4). */
export function seedCompletedKeys(keys: string[]): void {
  saveCompletedSet(new Set(keys));
}

/** Wipe all completed progress (debug / reset). */
export function clearProgress(): void {
  storage.delete(KEY_COMPLETED_KEYS);
  clearLastPlayedLevel();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Last-played-level (resume state)
// ═══════════════════════════════════════════════════════════════════════════════

export interface LastPlayedLevel {
  packageName: string;
  levelName:   string;
}

/**
 * Persist the level the user most recently started.
 * Called at the beginning of each play session (SpinnyGamePlayScreen mount).
 * Original: AppManager.saveSettings with lastLevel / lastPackage keys.
 */
export function setLastPlayedLevel(packageName: string, levelName: string): void {
  storage.set(KEY_LAST_PACKAGE, packageName);
  storage.set(KEY_LAST_LEVEL,   levelName);
}

/**
 * Retrieve the last-played level for the "Continue" feature.
 * Returns null if the user has never played.
 */
export function getLastPlayedLevel(): LastPlayedLevel | null {
  const packageName = storage.getString(KEY_LAST_PACKAGE);
  const levelName   = storage.getString(KEY_LAST_LEVEL);
  if (!packageName || !levelName) return null;
  return { packageName, levelName };
}

/** Clear resume state (on full reset or after the package is deleted). */
export function clearLastPlayedLevel(): void {
  storage.delete(KEY_LAST_PACKAGE);
  storage.delete(KEY_LAST_LEVEL);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Star counts per level (0–3)
//    Original: JigsawController.completeLevel → levelStars (time-based)
// ═══════════════════════════════════════════════════════════════════════════════

const KEY_STARS_PREFIX = 'progress.stars.';

/** Read earned star count for a level (0–3). Defaults to 0. */
export function getLevelStars(packageName: string, levelName: string): number {
  return storage.getNumber(`${KEY_STARS_PREFIX}${packageName}_${levelName}`) ?? 0;
}

/** Persist star count for a level. Only upgrades (never downgrades). */
export function setLevelStars(packageName: string, levelName: string, stars: number): void {
  const existing = getLevelStars(packageName, levelName);
  if (stars > existing) {
    storage.set(`${KEY_STARS_PREFIX}${packageName}_${levelName}`, stars);
  }
}
