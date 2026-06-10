/**
 * imageUtils.ts
 * Image path resolution and cache-key helpers.
 * Original: FileManager + AppManager.imageUrl / getPuzzleImage
 */
import RNFS from 'react-native-fs';

/** Root directory for all downloaded game assets.
 *  Mirrors: kLibDirectory / kDefaultFolderName in FileManager.h */
export const ASSETS_DIR = `${RNFS.LibraryDirectoryPath}/App_Files`;

/** Subdirectory for downloaded level images. */
export const IMAGES_DIR = `${ASSETS_DIR}/images`;

/** Subdirectory for downloaded sounds. */
export const SOUNDS_DIR = `${ASSETS_DIR}/sounds`;

/**
 * Build the full local file path for a downloaded level image.
 * Original: FileManager.getFilePath: + FileManager.createFilePath:
 */
export function localImagePath(fileName: string): string {
  return `${IMAGES_DIR}/${fileName}`;
}

/**
 * Build the full local file path for a sound file.
 */
export function localSoundPath(fileName: string): string {
  return `${SOUNDS_DIR}/${fileName}`;
}

/**
 * Check whether a downloaded image file exists on disk.
 * Async wrapper around RNFS.exists.
 */
export async function imageExistsLocally(fileName: string): Promise<boolean> {
  return RNFS.exists(localImagePath(fileName));
}

/**
 * Given a level's imgPath (local filename) or imgUrl (remote), return the
 * URI to pass to <Image source={{ uri }}>.
 * Prefers local file over remote URL.
 */
export function resolveImageUri(imgPath: string, imgUrl: string): string {
  if (imgPath) return `file://${localImagePath(imgPath)}`;
  return imgUrl;
}

/**
 * Generate a stable cache key for an image, matching the original's localID scheme.
 * Original: FileManager.fetchFileLocalIDForInfo:
 */
export function imageCacheKey(levelName: string, packageName: string): string {
  return `${packageName}_${levelName}`;
}

/**
 * Ensure the assets directories exist (called once on app start).
 */
export async function ensureAssetDirs(): Promise<void> {
  for (const dir of [ASSETS_DIR, IMAGES_DIR, SOUNDS_DIR]) {
    const exists = await RNFS.exists(dir);
    if (!exists) {
      await RNFS.mkdir(dir);
    }
  }
}
