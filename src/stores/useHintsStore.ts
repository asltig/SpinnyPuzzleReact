/**
 * useHintsStore.ts
 * Hint count and app-review counter.
 * Replaces: DBManager.gameSettings.hintsCount + appReviewCounter (GameSettings CoreData).
 *
 * Persisted via MMKV (synchronous) so hint count survives app restart
 * without a WatermelonDB async read at launch.
 */
import { create } from 'zustand';
import { storage } from '../storage/mmkv';
import {
  HINTS_DEFAULT_COUNT,
  HINTS_ADDED_COUNT,
  HINTS_FEEDBACK_ADDED_COUNT,
  RATE_COUNTER,
} from '../constants/gameConstants';

// ─── MMKV keys ───────────────────────────────────────────────────────────────
const KEY_HINTS_COUNT    = 'hintsCount';
const KEY_REVIEW_COUNTER = 'appReviewCounter';

// ─────────────────────────────────────────────
// Store shape
// ─────────────────────────────────────────────

interface HintsState {
  /** Current available hint count. Replaces gameSettings.hintsCount. */
  hintsCount: number;

  /** Levels completed since last review prompt. Replaces gameSettings.appReviewCounter. */
  appReviewCounter: number;

  // ─── Actions ────────────────────────────────
  hydrate: () => void;

  /** Consume one hint. Returns false if count is already 0.
   *  Replaces the hintsCount -- logic scattered in SPGamePlayViewController. */
  useHint: () => boolean;

  /** Add hints earned from watching a rewarded ad.
   *  Replaces: HINTS_ADDED_COUNT logic in AppManager.openAddHintScreen. */
  addHintsFromAd: () => void;

  /** Add hints earned from submitting feedback. */
  addHintsFromFeedback: () => void;

  /** Add a custom number of hints (IAP or debug). */
  addHints: (n: number) => void;

  /** Increment after a level is completed. Returns true if rate-us should show.
   *  Replaces: DBManagerKit.gameSettings.appReviewCounter++ in completeLevel. */
  incrementReviewCounter: () => boolean;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function loadHintsCount(): number {
  const stored = storage.getNumber(KEY_HINTS_COUNT);
  return stored ?? HINTS_DEFAULT_COUNT;
}

function saveHintsCount(n: number): void {
  storage.set(KEY_HINTS_COUNT, n);
}

function loadReviewCounter(): number {
  return storage.getNumber(KEY_REVIEW_COUNTER) ?? 0;
}

function saveReviewCounter(n: number): void {
  storage.set(KEY_REVIEW_COUNTER, n);
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const useHintsStore = create<HintsState>((set, get) => ({
  hintsCount:       HINTS_DEFAULT_COUNT,
  appReviewCounter: 0,

  hydrate: () => {
    set({
      hintsCount:       loadHintsCount(),
      appReviewCounter: loadReviewCounter(),
    });
  },

  useHint: () => {
    const current = get().hintsCount;
    if (current <= 0) return false;
    const next = current - 1;
    saveHintsCount(next);
    set({ hintsCount: next });
    return true;
  },

  addHintsFromAd: () => {
    const next = get().hintsCount + HINTS_ADDED_COUNT;
    saveHintsCount(next);
    set({ hintsCount: next });
  },

  addHintsFromFeedback: () => {
    const next = get().hintsCount + HINTS_FEEDBACK_ADDED_COUNT;
    saveHintsCount(next);
    set({ hintsCount: next });
  },

  addHints: (n) => {
    const next = get().hintsCount + n;
    saveHintsCount(next);
    set({ hintsCount: next });
  },

  incrementReviewCounter: () => {
    const next = get().appReviewCounter + 1;
    saveReviewCounter(next);
    set({ appReviewCounter: next });
    // Signal to show rate-us prompt at the RATE_COUNTER threshold
    return next % RATE_COUNTER === 0;
  },
}));
