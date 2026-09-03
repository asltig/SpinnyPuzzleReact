/**
 * levelAudioService.ts
 * Resolves and caches per-level, per-language pronunciation audio for the
 * gameplay "Sound" button. Bundled level data (src/data/levels.json) has no
 * audio at all — it only exists in the server catalog (catalogSyncService),
 * matched to a bundled level by package + level name (case-insensitively —
 * see findCatalogLevel). Downloads are cached to disk via fileDownloader so
 * playback is instant instead of fetching over the network on every tap.
 *
 * Prefetch strategy: SpinnyGamePlayScreen calls ensureLevelAudio for the
 * level currently open (so it's ready as soon as possible) and
 * prefetchUpcomingAudio for the next few levels in the background, so their
 * audio is already cached by the time the player reaches them.
 */
import RNFS from 'react-native-fs';
import { downloadIfMissing, runWithConcurrency } from '../../utils/fileDownloader';
import { fullImgUrl } from '../api/apiClient';
import { findCatalogLevel } from '../api/catalogSyncService';
import { getNextSpinnyLevels } from '../data/levelLoader';
import type { CatalogLevel } from '../../types/catalog';
import type { Level, LanguageCode } from '../../types/models';

const SOUNDS_DIR = `${RNFS.LibraryDirectoryPath}/App_Files/sounds`;

/** How many upcoming levels to prefetch audio for while playing the current one. */
const PREFETCH_COUNT = 3;
/** Cap on simultaneous prefetch downloads — keeps this polite on the network. */
const PREFETCH_CONCURRENCY = 2;

function audioFieldForLanguage(level: CatalogLevel, language: LanguageCode): string | null {
  switch (language) {
    case 'fr': return level.audioFr ?? level.audio;
    case 'es': return level.audioEs ?? level.audio;
    case 'ru': return level.audioRu ?? level.audio;
    default:   return level.audio;
  }
}

function localPathFor(
  packageName: string,
  levelName:   string,
  language:    LanguageCode,
  remotePath:  string,
): string {
  const ext = remotePath.includes('.') ? remotePath.split('.').pop() : 'mp3';
  const safeName = levelName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return `${SOUNDS_DIR}/${packageName}_${safeName}_${language}.${ext}`;
}

/**
 * Local disk path for a level's pronunciation audio in the given language,
 * downloading it first if it isn't cached yet (instant if it already is).
 * Returns null if the catalog has no matching level, no audio for it, or
 * the download fails — callers should just skip playback in that case.
 */
export async function ensureLevelAudio(
  packageName: string,
  levelName:   string,
  language:    LanguageCode,
): Promise<string | null> {
  const catalogLevel = findCatalogLevel(packageName, levelName);
  if (!catalogLevel) return null;

  const remotePath = audioFieldForLanguage(catalogLevel, language);
  if (!remotePath) return null;

  const localPath = localPathFor(packageName, levelName, language, remotePath);
  try {
    await downloadIfMissing(fullImgUrl(remotePath), localPath);
    return localPath;
  } catch (e) {
    console.warn('[levelAudioService] download failed:', remotePath, e);
    return null;
  }
}

/**
 * Fire-and-forget background prefetch of the next PREFETCH_COUNT levels'
 * audio (in the given language), starting after `fromLevel` — crossing into
 * the next Spinny package once the current one runs out. Safe to call on
 * every gameplay screen mount; already-cached files resolve instantly and
 * cost nothing.
 */
export function prefetchUpcomingAudio(fromLevel: Level, language: LanguageCode): void {
  const upcoming = getNextSpinnyLevels(fromLevel, PREFETCH_COUNT);
  void runWithConcurrency(upcoming, PREFETCH_CONCURRENCY, (level) =>
    ensureLevelAudio(level.packageName, level.name, language),
  );
}
