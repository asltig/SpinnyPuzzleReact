/**
 * levelImageService.ts
 * Resolves and caches Spinny level artwork (the ring-board animal image)
 * for every level beyond the first 3 bundled ones (Farm's dog/cow/horse —
 * see isInitialData). Every other level's image only exists in the server
 * catalog (catalogSyncService), matched to a level by package + level name
 * (case-insensitively — see findCatalogLevel). Downloads are cached to disk
 * via fileDownloader so gameplay doesn't re-fetch on every visit.
 *
 * Prefetch strategy mirrors levelAudioService exactly: SpinnyGamePlayScreen
 * calls ensureLevelImage for the level currently open (so it's ready ASAP)
 * and prefetchUpcomingImages for the next few levels in the background, so
 * their images are already cached by the time the player reaches them.
 */
import RNFS from 'react-native-fs';
import { downloadIfMissing, runWithConcurrency } from '../../utils/fileDownloader';
import { fullImgUrl } from '../api/apiClient';
import { findCatalogLevel } from '../api/catalogSyncService';
import { getNextSpinnyLevels } from '../data/levelLoader';
import type { Level } from '../../types/models';

const IMAGES_DIR = `${RNFS.LibraryDirectoryPath}/App_Files/images`;

/** How many upcoming levels to prefetch images for while playing the current one. */
const PREFETCH_COUNT = 3;
/** Cap on simultaneous prefetch downloads — keeps this polite on the network. */
const PREFETCH_CONCURRENCY = 2;

export interface LevelImagePaths {
  color: string | null;
  layer: string | null;
}

function localPathFor(
  packageName: string,
  levelName:   string,
  remotePath:  string,
  slot:        'color' | 'layer',
): string {
  const ext = remotePath.includes('.') ? remotePath.split('.').pop() : 'png';
  const safeName = levelName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return `${IMAGES_DIR}/${packageName}_${safeName}_${slot}.${ext}`;
}

async function downloadSlot(
  packageName: string,
  levelName:   string,
  remotePath:  string | null,
  slot:        'color' | 'layer',
): Promise<string | null> {
  if (!remotePath) return null;
  const localPath = localPathFor(packageName, levelName, remotePath, slot);
  try {
    await downloadIfMissing(fullImgUrl(remotePath), localPath);
    return localPath;
  } catch (e) {
    console.warn('[levelImageService] download failed:', remotePath, e);
    return null;
  }
}

/**
 * Local disk paths for a level's color + layer artwork, downloading
 * whichever aren't cached yet (instant if already cached). Either field is
 * null if the catalog has no matching level, no image for that slot, or the
 * download fails — callers should show the "needs internet" state when
 * BOTH come back null.
 */
export async function ensureLevelImage(packageName: string, levelName: string): Promise<LevelImagePaths> {
  const catalogLevel = findCatalogLevel(packageName, levelName);
  if (!catalogLevel) return { color: null, layer: null };

  const [color, layer] = await Promise.all([
    downloadSlot(packageName, levelName, catalogLevel.image, 'color'),
    downloadSlot(packageName, levelName, catalogLevel.backgroundImage, 'layer'),
  ]);
  return { color, layer };
}

/**
 * Fire-and-forget background prefetch of the next PREFETCH_COUNT levels'
 * images, starting after `fromLevel` — crossing into the next Spinny
 * package once the current one runs out. Skips levels that are already
 * bundled locally (isInitialData) — nothing to download for those. Safe to
 * call on every gameplay screen mount; already-cached files resolve
 * instantly and cost nothing.
 */
export function prefetchUpcomingImages(fromLevel: Level): void {
  const upcoming = getNextSpinnyLevels(fromLevel, PREFETCH_COUNT).filter((l) => !l.isInitialData);
  void runWithConcurrency(upcoming, PREFETCH_CONCURRENCY, (level) =>
    ensureLevelImage(level.packageName, level.name),
  );
}
