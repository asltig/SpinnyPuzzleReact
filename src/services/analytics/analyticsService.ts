/**
 * analyticsService.ts
 * Centralised Firebase Analytics layer.
 *
 * Design principles:
 *  • Typed helpers — no raw string literals scattered across screens.
 *  • Fire-and-forget — all calls are async but callers never await.
 *  • Never throws — every path is try/caught so analytics can never crash gameplay.
 *  • No WatermelonDB deduplication — Firebase aggregates events server-side.
 *  • Session-scoped attempt counter — increments each time a level is started
 *    within the current app session, resets on app restart.
 *
 * NOTE: Firebase auto-collects app_open, session_start, and first_open.
 * Do NOT send custom events for those — they would appear as separate events
 * and inflate counts.
 *
 * COPPA / children's app — actions required OUTSIDE this file:
 *  iOS  : Add NSUserTrackingUsageDescription to Info.plist (or omit IDFA collection).
 *         In Firebase console → Analytics → Data collection → disable
 *         "Allow advertising ID collection" if targeting children.
 *  Android : In AndroidManifest.xml inside <application>:
 *         <meta-data android:name="google_analytics_default_allow_ad_personalization_signals"
 *                    android:value="false" />
 *  Both : Review the app's age-rating / COPPA declarations in App Store Connect
 *         and Google Play Console.
 */

import { getApp } from '@react-native-firebase/app';
import { getAnalytics, logEvent as _firebaseLogEvent } from '@react-native-firebase/analytics';

// Cached instance — created lazily on first use after Firebase initialises.
let _analyticsInstance: ReturnType<typeof getAnalytics> | null = null;
function _getAnalytics(): ReturnType<typeof getAnalytics> {
  if (!_analyticsInstance) {
    _analyticsInstance = getAnalytics(getApp());
  }
  return _analyticsInstance;
}

// ── Event name constants ──────────────────────────────────────────────────────
// Firebase limit: 1–40 chars, starts with letter, alphanumeric + underscores only.
export const AE = {
  GAME_SELECTED:      'game_selected',
  WORLD_SELECTED:     'world_selected',
  LEVEL_STARTED:      'level_started',
  LEVEL_COMPLETED:    'level_completed',
  LEVEL_ABANDONED:    'level_abandoned',
  LEVEL_RESTARTED:    'level_restarted',
  NEXT_LEVEL_CLICKED: 'next_level_clicked',
  HINT_USED:          'hint_used',
} as const;

// ── Session-scoped attempt counter ────────────────────────────────────────────
// Key: `${game}__${level}`. Resets when the JS bundle is re-loaded (i.e. app restart).
const _attempts = new Map<string, number>();

function _nextAttempt(game: string, level: string): number {
  const key = `${game}__${level}`;
  const n = (_attempts.get(key) ?? 0) + 1;
  _attempts.set(key, n);
  return n;
}

// ── Core log helper ───────────────────────────────────────────────────────────
async function _log(
  event: string,
  params?: Record<string, string | number>,
): Promise<void> {
  try {
    await _firebaseLogEvent(_getAnalytics(), event, params ?? {});
  } catch (e) {
    if (__DEV__) console.warn('[analytics]', event, e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public typed event functions
// ─────────────────────────────────────────────────────────────────────────────

/** Fired when the player taps a game tile on the home screen. */
export function logGameSelected(game: string): void {
  void _log(AE.GAME_SELECTED, { game });
}

/**
 * Fired when the player selects a world / package in Spinny's level map.
 * Also fires for other games using their game name as the world.
 */
export function logWorldSelected(game: string, world: string): void {
  void _log(AE.WORLD_SELECTED, { game, world });
}

/**
 * Fired when gameplay begins (screen mounts and the player is active).
 * Returns the attempt_number for this level in the current session —
 * store it in a ref and pass it to logLevelCompleted / logLevelAbandoned.
 */
export function logLevelStarted(params: {
  game:  string;
  world: string;
  level: string;
}): number {
  const attempt = _nextAttempt(params.game, params.level);
  void _log(AE.LEVEL_STARTED, {
    game:           params.game,
    world:          params.world,
    level:          params.level,
    attempt_number: attempt,
  });
  return attempt;
}

/** Fired exactly once when the player successfully finishes a level. */
export function logLevelCompleted(params: {
  game:            string;
  world:           string;
  level:           string;
  attempt_number:  number;
  completion_time: number;   // seconds
  stars:           number;   // 1–3
  hints_used:      number;
  moves:           number;
}): void {
  void _log(AE.LEVEL_COMPLETED, { ...params });
}

/**
 * Fired when the player voluntarily leaves a level they have not yet completed
 * (e.g. pressing the Back button mid-game).
 * Do NOT fire this on normal level completion → next-level flow.
 */
export function logLevelAbandoned(params: {
  game:           string;
  world:          string;
  level:          string;
  attempt_number: number;
  time_spent:     number;    // seconds spent before leaving
}): void {
  void _log(AE.LEVEL_ABANDONED, { ...params });
}

/** Fired when the player retries / restarts the current level. */
export function logLevelRestarted(params: {
  game:  string;
  world: string;
  level: string;
}): void {
  void _log(AE.LEVEL_RESTARTED, {
    game:  params.game,
    world: params.world,
    level: params.level,
  });
}

/** Fired when the player taps "Next Level" after a successful completion. */
export function logNextLevelClicked(params: {
  game:  string;
  world: string;
  level: string;
}): void {
  void _log(AE.NEXT_LEVEL_CLICKED, {
    game:  params.game,
    world: params.world,
    level: params.level,
  });
}

/** Fired each time the player uses a hint during a level. */
export function logHintUsed(params: {
  game:        string;
  world:       string;
  level:       string;
  hint_number: number;   // 1-based count of hints used in this attempt
}): void {
  void _log(AE.HINT_USED, { ...params });
}
