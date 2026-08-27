/**
 * levelLoader.ts
 * Loads and queries level/package data from the bundled levels.json.
 *
 * ─── Purpose ─────────────────────────────────────────────────────────────────
 *   Step 3 (this step): JSON-only data source. Replaces hardcoded testData.ts.
 *   Step 4 (future):    Sync with server and write to WatermelonDB; this loader
 *                       will be replaced by WatermelonDB queries.
 *
 * ─── Why a loader and not a direct import? ───────────────────────────────────
 *   Centralises all field-name mapping (snake_case → camelCase) in one place.
 *   All callers use typed domain models (Level, Package, PackageWithLevels).
 *   Caching means the JSON is parsed once per app session.
 *
 * ─── Field-name mapping matches original server API ──────────────────────────
 *   background_color_dark  → backgroundColorDark
 *   circle_range_colors    → circleRangeColors (JSON-encoded string, original format)
 *   package_name           → packageName
 *   is_initial_data        → isInitialData
 *   … etc.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const RAW_DATA = require('../../data/levels.json') as RawData;

import type { Level, Package, PackageWithLevels } from '../../types/models';

// ─────────────────────────────────────────────
// Raw JSON shape (matches server snake_case API)
// ─────────────────────────────────────────────

interface RawPackage {
  name:                  string;
  background_color_dark: string;
  background_color_light: string;
  circle_color:          string;
  circle_range_colors:   string[];
  touched_layer_color:   string;
  is_free?:              boolean;
  /** Completion card description text color. Original: text_color in DBManager. */
  text_color?:           string;
  /** Per-package next button asset name. Original: next_button_image in DBManager. */
  next_button_image?:    string;
}

interface RawLevel {
  name:            string;
  package_name:    string;
  order:           number;
  is_initial_data?: boolean;
  /** Bundled image filename (e.g. "dog.png"), or null if no bundled color image. */
  color_image:     string | null;
  /** Bundled layer image filename (e.g. "dog_layer.png"), or null if no bundled layer image. */
  layer_image:     string | null;
  /** Fact text shown on the completion card. */
  descrip?:        string;
  /** Hex color for the name label on the completion card. */
  title_color?:    string;
}

interface RawData {
  packages: RawPackage[];
  levels:   RawLevel[];
}

// ─────────────────────────────────────────────
// Mappers — raw → domain
// ─────────────────────────────────────────────

function mapPackage(raw: RawPackage, index: number): Package {
  return {
    id:                   `pkg_${index}`,
    name:                 raw.name,
    backgroundColorDark:  raw.background_color_dark,
    backgroundColorLight: raw.background_color_light,
    circleColor:          raw.circle_color,
    // Stored as a JSON string to match the original circleRangeColors field format
    // (original: NSArray serialised via objectFromString / objectToString)
    circleRangeColors:    JSON.stringify(raw.circle_range_colors),
    touchedLayerColor:    raw.touched_layer_color,
    isPurchased:          raw.is_free ?? false,
    textColor:            raw.text_color        ?? '#F9D84E',
    nextButtonImage:      raw.next_button_image ?? 'btnNextFarm',
  };
}

function mapLevel(raw: RawLevel, packageId: string, index: number): Level {
  return {
    id:              `${packageId}_lvl${index}`,
    name:            raw.name,
    packageName:     raw.package_name,
    imgUrl:          '',
    imgPath:         raw.color_image ?? '',
    order:           raw.order,
    imageDownloaded: raw.color_image !== null,
    levelCompleted:  false,
    isInitialData:   raw.is_initial_data ?? false,
    colorImage:      raw.color_image,
    layerImage:      raw.layer_image,
    descrip:         raw.descrip    ?? '',
    titleColor:      raw.title_color ?? '#3d2b0a',
  };
}

// ─────────────────────────────────────────────
// Cache
// ─────────────────────────────────────────────

let _packagesWithLevels: PackageWithLevels[] | null = null;

function buildCache(): PackageWithLevels[] {
  const packages = RAW_DATA.packages.map(mapPackage);

  // Build a map for O(1) package lookup by name
  const packageMap = new Map<string, Package>(
    packages.map((p) => [p.name, p]),
  );

  // Track per-package level index for stable IDs
  const levelIndexByPackage = new Map<string, number>();

  const levels: Level[] = RAW_DATA.levels.map((raw) => {
    const pkg = packageMap.get(raw.package_name);
    const pkgId = pkg?.id ?? `pkg_unknown`;
    const idx = levelIndexByPackage.get(raw.package_name) ?? 0;
    levelIndexByPackage.set(raw.package_name, idx + 1);
    return mapLevel(raw, pkgId, idx);
  });

  // Group levels by package, sorted by order
  _packagesWithLevels = packages.map((pkg) => ({
    package: pkg,
    levels: levels
      .filter((l) => l.packageName === pkg.name)
      .sort((a, b) => a.order - b.order),
  }));

  return _packagesWithLevels;
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Return all packages with their levels, sorted as they appear in levels.json.
 * Result is cached after the first call.
 */
export function getAllPackagesWithLevels(): PackageWithLevels[] {
  return _packagesWithLevels ?? buildCache();
}

/**
 * Find a single package by name (case-sensitive, matches server key).
 * Returns null if the package is not in the data file.
 */
export function getPackageWithLevels(packageName: string): PackageWithLevels | null {
  return getAllPackagesWithLevels().find((p) => p.package.name === packageName) ?? null;
}

/**
 * Find a level by its package name and level name.
 * Used by LevelCompleteScreen to look up the next level from the loader,
 * bypassing the route params (which only hold the current level).
 */
export function getLevelByName(packageName: string, levelName: string): Level | null {
  const pkg = getPackageWithLevels(packageName);
  return pkg?.levels.find((l) => l.name === levelName) ?? null;
}

/**
 * Return the next level after `current` in the same package (by order).
 * Returns null if `current` is the last level in its package.
 *
 * Also returns the PackageWithLevels so callers can pass it straight to navigation.
 */
export function getNextLevel(
  current: Level,
): { level: Level; packageInfo: PackageWithLevels } | null {
  const pkg = getPackageWithLevels(current.packageName);
  if (!pkg) return null;

  const idx = pkg.levels.findIndex((l) => l.name === current.name);
  if (idx === -1 || idx + 1 >= pkg.levels.length) return null;

  return {
    level:       pkg.levels[idx + 1]!,
    packageInfo: pkg,
  };
}

/**
 * The 7 Spinny-game package names — mirrors the hardcoded list in
 * DBManager.fetchSpinnyPackages (Farm, Insects, Savana, Seaworld, Jungle,
 * Vehicles, Dinosaurs). Used to filter the full package list so each game
 * type's levels screen only shows its own packages.
 */
const SPINNY_PACKAGE_NAMES = [
  'Farm',
  'Insects',
  'Savana',
  'Seaworld',
  'Jungle',
  'Vehicles',
  'Dinosaurs',
] as const;

/**
 * Return only the 7 Spinny-game packages with their levels.
 * Replaces DBManager.fetchSpinnyPackages — same package-name whitelist.
 * Called by SpinnyLevelsScreen.
 */
export function getSpinnyPackagesWithLevels(): PackageWithLevels[] {
  return getAllPackagesWithLevels().filter((p) =>
    (SPINNY_PACKAGE_NAMES as readonly string[]).includes(p.package.name),
  );
}

/**
 * Return up to `count` levels after `current` in Spinny play order —
 * crossing into the next package once the current one runs out (e.g. the
 * last level of Farm is followed by Insects' first level). Used to prefetch
 * upcoming levels' audio while the player is on `current`; returns fewer
 * than `count` (or none) once past the very last Spinny level.
 */
export function getNextSpinnyLevels(current: Level, count: number): Level[] {
  const flat = getSpinnyPackagesWithLevels().flatMap((p) => p.levels);
  const idx = flat.findIndex(
    (l) => l.packageName === current.packageName && l.name === current.name,
  );
  if (idx === -1) return [];
  return flat.slice(idx + 1, idx + 1 + count);
}

/**
 * True when `level` is the very first level of the very first Spinny package
 * (Farm's first level, by SPINNY_PACKAGE_NAMES / order). Gates the one-time
 * ring-rotation tutorial shown in SpinnyGamePlayScreen.
 */
export function isFirstSpinnyLevel(level: Level): boolean {
  const firstLevel = getSpinnyPackagesWithLevels()[0]?.levels[0];
  return (
    !!firstLevel &&
    firstLevel.packageName === level.packageName &&
    firstLevel.name === level.name
  );
}

/**
 * Pick a random incomplete Spinny level across ALL 7 packages.
 * Mirrors ObjC DBManager.fetchRandomNotCompletedLevel exactly:
 *   - Collects all incomplete levels from Farm → Insects → Savana → Seaworld
 *     → Jungle → Vehicles → Dinosaurs (same package order).
 *   - Prefers levels that have a bundled color image (colorImage !== null), falling back
 *     to any incomplete level when none have images.
 *   - Returns null only if every level is already completed.
 *
 * @param completedKeys  The Set<string> from useProgressStore (packageName_levelName).
 */
export function getRandomNotCompletedSpinnyLevel(
  completedKeys: Set<string>,
): Level | null {
  const allIncomplete: Level[] = [];

  for (const pkg of getSpinnyPackagesWithLevels()) {
    for (const level of pkg.levels) {
      const key = `${level.packageName}_${level.name}`;
      if (!completedKeys.has(key)) {
        allIncomplete.push(level);
      }
    }
  }

  if (allIncomplete.length === 0) return null;

  // Prefer levels that have a bundled full-color image so the rings always
  // look correct (derived from the color_image field in levels.json).
  const hasBundledImage = (l: Level) => l.colorImage !== null;

  const withImage = allIncomplete.filter(hasBundledImage);
  const pool = withImage.length > 0 ? withImage : allIncomplete;

  return pool[Math.floor(Math.random() * pool.length)]!;
}

/**
 * Invalidate the cache (call after a sync that updates levels.json content).
 * Not needed in Step 3 since the JSON is static.
 */
export function invalidateLevelCache(): void {
  _packagesWithLevels = null;
}
