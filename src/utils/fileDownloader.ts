/**
 * fileDownloader.ts
 * Generic remote-file → local-disk cache, backed by react-native-fs.
 * Downloads are deduplicated by local path so concurrent callers requesting
 * the same file (e.g. a prefetch and a foreground playback racing) share one
 * in-flight download instead of fetching it twice.
 */
import RNFS from 'react-native-fs';

const inFlight = new Map<string, Promise<void>>();

/** Ensure a directory exists, creating it if needed. */
export async function ensureDir(dir: string): Promise<void> {
  const exists = await RNFS.exists(dir);
  if (!exists) await RNFS.mkdir(dir);
}

/**
 * Download `remoteUrl` to `localPath` if it isn't already on disk.
 * `localPath`'s parent directory is created automatically. Resolves once the
 * file is present locally (already cached or freshly downloaded); rejects
 * only on a genuine download failure (network error, non-2xx response).
 */
export async function downloadIfMissing(remoteUrl: string, localPath: string): Promise<void> {
  if (await RNFS.exists(localPath)) return;

  const existing = inFlight.get(localPath);
  if (existing) return existing;

  const task = (async () => {
    try {
      await ensureDir(localPath.substring(0, localPath.lastIndexOf('/')));
      const { promise } = RNFS.downloadFile({ fromUrl: remoteUrl, toFile: localPath });
      const { statusCode } = await promise;
      if (statusCode < 200 || statusCode >= 300) {
        await RNFS.unlink(localPath).catch(() => {});
        throw new Error(`Download failed (${statusCode}): ${remoteUrl}`);
      }
    } finally {
      inFlight.delete(localPath);
    }
  })();

  inFlight.set(localPath, task);
  return task;
}

export async function localFileExists(localPath: string): Promise<boolean> {
  return RNFS.exists(localPath);
}

/**
 * Run `task` over `items` with at most `limit` running concurrently.
 * Individual task failures are swallowed — used for best-effort prefetching
 * where one bad download shouldn't stop the rest.
 */
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<unknown>,
): Promise<void> {
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const item = items[next++]!;
      await task(item).catch(() => {});
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
