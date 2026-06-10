/**
 * settingsStorage.ts
 * Typed MMKV accessors for app settings.
 * Replaces NSUserDefaults calls in AppManager.loadSettings / saveSettings.
 *
 * All reads are synchronous — same behavior as [NSUserDefaults standardUserDefaults].
 */
import { storage } from './mmkv';
import type { LanguageCode } from '../types/models';

// ─── Keys (match original NSUserDefaults key strings) ────────────────────────
const KEY_USER_ID       = 'userID';
const KEY_LANGUAGE      = 'appLanguage';
const KEY_LANGUAGE_CODE = 'appLanguageCode';
const KEY_IS_FIRST_LAUNCH = 'isFirst_ver1.0';
const KEY_TUTORIAL_STATE  = 'TutorialState';
const KEY_TUTORIAL_LEVEL  = 'tutorialLevelIndex';
const KEY_VERSION         = 'version';
const KEY_IS_MUSIC_ON   = 'isMusicON';
const KEY_IS_SOUND_ON   = 'isSoundON';

// ─── User ID ─────────────────────────────────────────────────────────────────

export function getUserId(): string | undefined {
  return storage.getString(KEY_USER_ID);
}

export function setUserId(id: string): void {
  storage.set(KEY_USER_ID, id);
}

// ─── Language ─────────────────────────────────────────────────────────────────

export function getLanguageCode(): LanguageCode {
  return (storage.getString(KEY_LANGUAGE_CODE) as LanguageCode | undefined) ?? 'en';
}

export function getLanguageDisplay(): string {
  return storage.getString(KEY_LANGUAGE) ?? 'English';
}

export function setLanguage(displayName: string, code: LanguageCode): void {
  storage.set(KEY_LANGUAGE, displayName);
  storage.set(KEY_LANGUAGE_CODE, code);
}

// ─── First-launch flag ────────────────────────────────────────────────────────

export function isFirstLaunch(): boolean {
  return !storage.getBoolean(KEY_IS_FIRST_LAUNCH);
}

export function markFirstLaunchDone(): void {
  storage.set(KEY_IS_FIRST_LAUNCH, true);
}

// ─── Tutorial ─────────────────────────────────────────────────────────────────

/** Tutorial step as a numeric code (matches original NSUserDefaults TutorialState int) */
export function getTutorialState(): number {
  return storage.getNumber(KEY_TUTORIAL_STATE) ?? 0;
}

export function setTutorialState(step: number): void {
  storage.set(KEY_TUTORIAL_STATE, step);
}

export function getTutorialLevelIndex(): number {
  return storage.getNumber(KEY_TUTORIAL_LEVEL) ?? 0;
}

export function setTutorialLevelIndex(index: number): void {
  storage.set(KEY_TUTORIAL_LEVEL, index);
}

// ─── API version ──────────────────────────────────────────────────────────────

export function getApiVersion(): string {
  return storage.getString(KEY_VERSION) ?? '1.0';
}

export function setApiVersion(version: string): void {
  storage.set(KEY_VERSION, version);
}

// ─── Sound / Music prefs (matches original isMusicON / isSoundON NSUserDefaults) ───

export function getIsMusicOn(): boolean {
  const stored = storage.getBoolean(KEY_IS_MUSIC_ON);
  return stored === undefined ? true : stored;
}

export function setIsMusicOn(v: boolean): void {
  storage.set(KEY_IS_MUSIC_ON, v);
}

export function getIsSoundOn(): boolean {
  const stored = storage.getBoolean(KEY_IS_SOUND_ON);
  return stored === undefined ? true : stored;
}

export function setIsSoundOn(v: boolean): void {
  storage.set(KEY_IS_SOUND_ON, v);
}
