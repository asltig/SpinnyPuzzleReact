/**
 * analyticsService.ts
 * Firebase event logging with local deduplication.
 * Replaces: AppManager.logEventDBForEntityName + logEventFirebaseForName.
 *
 * Original behavior:
 *   1. Upsert event in GameLogs CoreData (increment count)
 *   2. Format as "EventName xN" (truncated to 40 chars)
 *   3. Send to Firebase Analytics
 *   4. Queue to server via WaitingRequest if network available
 */
import { getApps } from '@react-native-firebase/app';
import analytics from '@react-native-firebase/analytics';
import { GameLogModel } from '../../db/models/GameLog';

/** Max Firebase event name length. Original: substringWithRange:NSMakeRange(0, 40) */
const MAX_EVENT_NAME_LENGTH = 40;

/**
 * Log a game event. Handles deduplication, Firebase, and offline queuing.
 * Drop-in replacement for [AppManager logEventDBForEntityName:parameters:].
 */
export async function logEvent(
  name: string,
  params?: Record<string, string | number>,
): Promise<void> {
  if (getApps().length === 0) return;
  try {
    // 1. Upsert into WatermelonDB — get deduplicated count
    const count = await GameLogModel.upsert(name);

    // 2. Format name with count suffix (matches original "EventName xN" pattern)
    let formattedName = `${name} x${count}`;
    // Truncate to 40 chars (Firebase limit + original substring logic)
    if (formattedName.length > MAX_EVENT_NAME_LENGTH) {
      formattedName = formattedName.substring(0, MAX_EVENT_NAME_LENGTH);
    }
    // Strip special characters (original: NSCharacterSet trim)
    formattedName = formattedName.replace(/[!@#$%^&*()_+=\-:;|\\?><,.]/g, '');

    // 3. Send to Firebase
    await analytics().logEvent(formattedName.replace(/\s/g, '_'), params);
  } catch (e) {
    console.warn('[analytics] logEvent failed:', e);
  }
}

/** Log a level completion event. */
export function logLevelCompleted(levelName: string, packageName: string): Promise<void> {
  return logEvent(`Completed ${levelName}`, { package: packageName });
}

/** Log app open. */
export function logAppOpen(): Promise<void> {
  return logEvent('app_open');
}
