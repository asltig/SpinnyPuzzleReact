/**
 * useSettingsStore.ts
 * User preferences — sound, language, userID.
 * Replaces: NSUserDefaults + AppManager.loadSettings / saveSettings.
 *
 * MMKV-backed: every write immediately persists.
 * Reads are synchronous (same as NSUserDefaults).
 */
import { create } from 'zustand';

// Math.random()-based UUID v4 — avoids react-native-get-random-values dependency.
function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
import type { LanguageCode } from '../types/models';
import * as settingsStorage from '../storage/settingsStorage';
import { soundService } from '../services/audio/soundService';

// ─────────────────────────────────────────────
// Store shape
// ─────────────────────────────────────────────

interface SettingsState {
  /** Unique user identifier — generated once on first launch.
   *  Replaces AppManager.userID (NSUserDefaults 'userID' key). */
  userId: string;

  /** Display name e.g. 'English', 'Français'.
   *  Replaces AppManager.appLanguage. */
  language: string;

  /** BCP-47 code used for bundle localisation.
   *  Replaces AppManager.appLanguageCode. */
  languageCode: LanguageCode;

  /** Replaces SoundManager.isSoundON */
  isSoundOn: boolean;

  /** Replaces SoundManager.isMusicON */
  isMusicOn: boolean;

  // ─── Actions ──────────────────────────────────
  /** Call once at app start to hydrate from MMKV and generate userID if missing. */
  hydrate: () => void;

  setLanguage: (displayName: string, code: LanguageCode) => void;
  setSoundOn:  (v: boolean) => void;
  setMusicOn:  (v: boolean) => void;
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const useSettingsStore = create<SettingsState>((set) => ({
  userId:       '',
  language:     'English',
  languageCode: 'en',
  isSoundOn:    true,
  isMusicOn:    true,

  hydrate: () => {
    let userId = settingsStorage.getUserId();
    if (!userId) {
      userId = randomUUID();
      settingsStorage.setUserId(userId);
    }

    const isMusicOn = settingsStorage.getIsMusicOn();
    const isSoundOn = settingsStorage.getIsSoundOn();

    soundService.isMusicOn = isMusicOn;
    soundService.isSoundOn = isSoundOn;

    set({
      userId,
      language:     settingsStorage.getLanguageDisplay(),
      languageCode: settingsStorage.getLanguageCode(),
      isSoundOn,
      isMusicOn,
    });
  },

  setLanguage: (displayName, code) => {
    settingsStorage.setLanguage(displayName, code);
    set({ language: displayName, languageCode: code });
  },

  setSoundOn: (v) => {
    settingsStorage.setIsSoundOn(v);
    soundService.isSoundOn = v;
    set({ isSoundOn: v });
  },

  setMusicOn: (v) => {
    settingsStorage.setIsMusicOn(v);
    soundService.isMusicOn = v;
    set({ isMusicOn: v });
  },
}));