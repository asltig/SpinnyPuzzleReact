/**
 * catalogSyncService.ts
 * Fetches the full server catalog (packages + levels, across all three
 * backend-connected game types — Spinny, Jigsaw, Patchwork) and stores it
 * locally. This is step 1 only: raw data in, structured local storage out.
 * Image/audio fields are kept as server-relative paths (e.g.
 * "uploads/levels/cow@3x.png") — resolving those to full URLs and actually
 * downloading/caching the files is a separate, later step.
 *
 * Endpoints (confirmed live 2026-08-24):
 *   POST /packages  { version } -> { data: RawPackage[], version }
 *   POST /levels    { version } -> { data: RawLevel[],   version }
 * Both form-encoded via apiClient. Package/level rows are filtered down to
 * the names in GAME_PACKAGE_NAMES — the server also returns unrelated/junk
 * packages (e.g. a "toDelete" package) that nothing in the app should see.
 *
 * Nothing reads from this store yet — SpinnyGamePlayScreen/levelLoader.ts
 * still serve gameplay from the bundled src/data/levels.json. Wiring the
 * game screens to read from here is a deliberate later step.
 */
import { apiClient } from './apiClient';
import { getApiVersion, setApiVersion } from '../../storage/settingsStorage';
import {
  getStoredPackages, setStoredPackages,
  getStoredLevels,   setStoredLevels,
  getLastSyncedAt,   setLastSyncedAt,
} from '../../storage/catalogStorage';
import { SERVER_SYNC_DAYS } from '../../constants/gameConstants';
import { GAME_PACKAGE_NAMES } from '../../types/catalog';
import type { CatalogPackage, CatalogLevel } from '../../types/catalog';
import type { GameType } from '../../types/models';

const METHOD_GET_PACKAGES = '/packages';
const METHOD_GET_LEVELS   = '/levels';

/** Every package name the app cares about, across all games — everything else is dropped. */
const KNOWN_PACKAGE_NAMES: ReadonlySet<string> = new Set(
  Object.values(GAME_PACKAGE_NAMES).flat(),
);

// ─── Raw → typed mapping ─────────────────────────────────────────────────────

function str(v: unknown): string {
  return v == null ? '' : String(v);
}
function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  return s.length > 0 ? s : null;
}
function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function mapPackage(raw: Record<string, unknown>): CatalogPackage {
  let circleRangeColors: string[] = [];
  const rc = raw['circle_range_colors'];
  if (Array.isArray(rc)) circleRangeColors = rc.map(String);

  return {
    id:                   str(raw['id']),
    name:                 str(raw['name']),
    backgroundColorDark:  str(raw['background_color_dark']),
    backgroundColorLight: str(raw['background_color_light']),
    circleColor:          str(raw['circle_color']),
    circleRangeColors,
    touchedLayerColor:    str(raw['touched_layer_color']),
    order:                num(raw['order']),
    levelsCount:          num(raw['levels']),
  };
}

function mapLevel(raw: Record<string, unknown>): CatalogLevel {
  return {
    id:              str(raw['id']),
    packageId:       str(raw['packageId']),
    packageName:     str(raw['packageName']),
    name:            str(raw['name']),
    nameFr:          strOrNull(raw['name_fr']),
    nameEs:          strOrNull(raw['name_es']),
    nameRu:          strOrNull(raw['name_ru']),
    description:     strOrNull(raw['description']),
    descriptionRu:   strOrNull(raw['description_ru']),
    titleColor:      strOrNull(raw['title_color']),
    image:           strOrNull(raw['image']),
    backgroundImage: strOrNull(raw['background_image']),
    customImage:     strOrNull(raw['custom_image']),
    audio:           strOrNull(raw['audio']),
    audioFr:         strOrNull(raw['audio_fr']),
    audioEs:         strOrNull(raw['audio_es']),
    audioRu:         strOrNull(raw['audio_ru']),
    order:           num(raw['order']),
  };
}

// ─── Fetch ────────────────────────────────────────────────────────────────

async function fetchPackages(): Promise<CatalogPackage[] | null> {
  try {
    const res = await apiClient.post<{ data: unknown[]; version?: string }>(
      METHOD_GET_PACKAGES,
      { version: getApiVersion() },
    );
    const rows = res.data?.data ?? [];
    return rows
      .map((r) => mapPackage(r as Record<string, unknown>))
      .filter((p) => KNOWN_PACKAGE_NAMES.has(p.name));
  } catch (e) {
    console.warn('[catalogSync] packages fetch failed:', e);
    return null;
  }
}

async function fetchLevels(): Promise<{ levels: CatalogLevel[]; version: string | undefined } | null> {
  try {
    const res = await apiClient.post<{ data: unknown[]; version?: string }>(
      METHOD_GET_LEVELS,
      { version: getApiVersion() },
    );
    const rows = res.data?.data ?? [];
    const levels = rows
      .map((r) => mapLevel(r as Record<string, unknown>))
      .filter((l) => KNOWN_PACKAGE_NAMES.has(l.packageName));
    return { levels, version: res.data?.version };
  } catch (e) {
    console.warn('[catalogSync] levels fetch failed:', e);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface CatalogSyncResult {
  packages: CatalogPackage[];
  levels:   CatalogLevel[];
}

/**
 * Fetch packages + levels from the server and overwrite local storage.
 * On network failure, leaves whatever was already stored untouched and
 * returns the (possibly stale, possibly empty) cached data — callers never
 * need to handle a thrown error.
 */
export async function syncCatalog(): Promise<CatalogSyncResult> {
  const [packages, levelsResult] = await Promise.all([fetchPackages(), fetchLevels()]);

  if (packages) setStoredPackages(packages);
  if (levelsResult) {
    setStoredLevels(levelsResult.levels);
    if (levelsResult.version) setApiVersion(levelsResult.version);
  }
  if (packages || levelsResult) setLastSyncedAt(Date.now());

  return { packages: getStoredPackages(), levels: getStoredLevels() };
}

/** Only syncs if SERVER_SYNC_DAYS have elapsed since the last successful sync. */
export async function syncCatalogIfNeeded(): Promise<CatalogSyncResult> {
  const lastSyncedAt = getLastSyncedAt();
  const staleMs = SERVER_SYNC_DAYS * 24 * 60 * 60 * 1000;
  if (lastSyncedAt != null && Date.now() - lastSyncedAt < staleMs) {
    return { packages: getStoredPackages(), levels: getStoredLevels() };
  }
  return syncCatalog();
}

// ─── Local reads (synchronous — served from whatever's currently cached) ───

export function getCachedPackages(): CatalogPackage[] {
  return getStoredPackages();
}

export function getCachedLevels(): CatalogLevel[] {
  return getStoredLevels();
}

export function getCachedPackagesForGame(game: GameType): CatalogPackage[] {
  const names = new Set(GAME_PACKAGE_NAMES[game]);
  return getStoredPackages().filter((p) => names.has(p.name));
}

export function getCachedLevelsForPackage(packageName: string): CatalogLevel[] {
  return getStoredLevels().filter((l) => l.packageName === packageName);
}

export function getCachedLevelsForGame(game: GameType): CatalogLevel[] {
  const names = new Set(GAME_PACKAGE_NAMES[game]);
  return getStoredLevels().filter((l) => names.has(l.packageName));
}

/**
 * Look up a single catalog level by package + level name. Level-name
 * matching is case-insensitive — the bundled local dataset uses lowercase
 * names ("cow") while the server uses uppercase ("COW"). Package name must
 * match exactly (it's consistent between both sources).
 */
export function findCatalogLevel(packageName: string, levelName: string): CatalogLevel | null {
  const needle = levelName.toLowerCase();
  return (
    getStoredLevels().find(
      (l) => l.packageName === packageName && l.name.toLowerCase() === needle,
    ) ?? null
  );
}
