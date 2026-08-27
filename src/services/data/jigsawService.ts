/**
 * jigsawService.ts
 * Mirrors ObjC: DBManager.fetchDownloadedLevelsWithLocalDataForPackageName:@"Jigsaw"
 *               + AppManager.sendFetchLevelsRequestForVersionWithCompletion:
 *
 * Data pipeline:
 *  1. Always return 8 bundled levels (j1–j8) as the seed — matches
 *     DBManager.createJigsawInitialData (isInitialData=YES, order=negative).
 *  2. On each app launch, sync the shared catalog (catalogSyncService — same
 *     POST /levels used by Spinny/Patchwork) and cache Jigsaw-package items
 *     from it in this module's own MMKV key.
 *  3. Merge: bundled first (sorted by order asc, i.e. -8…-1), then server
 *     levels (order ≥ 0 asc) — exact behaviour of the CoreData query.
 *
 * Image paths:
 *  • Bundled levels (isInitialData=true): imgPath = "j1"…"j8" → require()
 *  • Server levels  (isInitialData=false): imgPath = URL → must be downloaded
 */

import { storage } from '../../storage/mmkv';
import { syncCatalog, getCachedLevelsForPackage } from '../api/catalogSyncService';

// ─── MMKV key ────────────────────────────────────────────────────────────────
const KEY_JIGSAW_SERVER_LEVELS = 'jigsaw.serverLevels';

// ─── Public level shape ──────────────────────────────────────────────────────
export interface JigsawLevel {
  /** "j1"…"j8" for bundled; server-supplied slug for downloaded levels */
  name:          string;
  /** Negative for bundled (-1…-8), positive for server levels */
  order:         number;
  /** True for j1-j8 bundled; false = needs image downloaded from server */
  isInitialData: boolean;
  /** For downloaded levels: the full image URL (matches ObjC imgPath = info[@"image"]) */
  imgPath:       string;
  /** Level index in the final sorted list (0-based) */
  index:         number;
}

// ─── Bundled seed (createJigsawInitialData) ───────────────────────────────────
const BUNDLED: Omit<JigsawLevel, 'index'>[] = Array.from({ length: 8 }, (_, i) => ({
  name:          `j${i + 1}`,
  order:         -(i + 1),   // ObjC: jigsawLevel.order = -(i+1)
  isInitialData: true,
  imgPath:       `j${i + 1}`,
}));

// ─── MMKV cache helpers ───────────────────────────────────────────────────────
function loadServerLevels(): Omit<JigsawLevel, 'index'>[] {
  const raw = storage.getString(KEY_JIGSAW_SERVER_LEVELS);
  if (!raw) return [];
  try { return JSON.parse(raw) as Omit<JigsawLevel, 'index'>[]; }
  catch { return []; }
}

function saveServerLevels(levels: Omit<JigsawLevel, 'index'>[]): void {
  storage.set(KEY_JIGSAW_SERVER_LEVELS, JSON.stringify(levels));
}

// ─── Merge + sort — mirrors CoreData fetchRequest sort by "order" asc ─────────
function merge(server: Omit<JigsawLevel, 'index'>[]): JigsawLevel[] {
  // Deduplicate by name — bundled levels take priority (added first).
  // Server cache can contain duplicate entries if the API returned them twice.
  const seen = new Map<string, Omit<JigsawLevel, 'index'>>();
  for (const l of [...BUNDLED, ...server]) {
    if (!seen.has(l.name)) seen.set(l.name, l);
  }
  const all = Array.from(seen.values());
  all.sort((a, b) => a.order - b.order);
  return all.map((l, i) => ({ ...l, index: i }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Return immediately available levels (bundled + cached server). */
export function getJigsawLevels(): JigsawLevel[] {
  return merge(loadServerLevels());
}

/**
 * Fetch fresh Jigsaw levels from the server and update MMKV cache.
 * Sources from the shared catalog sync (catalogSyncService) — same
 * POST /levels response used by Spinny/Patchwork, filtered to packageName
 * "Jigsaw". Confirmed live 2026-06-04: 312 Jigsaw levels returned.
 * Image paths are relative: "uploads/levels/shutterstock_xxx.jpg"
 */
export async function syncJigsawLevels(): Promise<JigsawLevel[]> {
  await syncCatalog(); // no-throw: leaves prior cache in place on failure
  const jigsawRaw = getCachedLevelsForPackage('Jigsaw');
  if (jigsawRaw.length > 0) {
    const serverLevels: Omit<JigsawLevel, 'index'>[] = jigsawRaw.map((l) => ({
      name:          l.name,
      order:         l.order,
      isInitialData: false,
      imgPath:       l.image ?? '',  // relative path from server
    }));
    saveServerLevels(serverLevels);
  }
  return getJigsawLevels();
}
