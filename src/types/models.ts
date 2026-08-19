/**
 * models.ts
 * Core domain types for SpinnyPuzzle.
 * These mirror the original Objective-C Core Data entities and enums.
 */

// ─────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────

/**
 * The three active game modes.
 * Original: GameType enum in AppManager.h (Spinny=0, Jigsaw=1, Patchwork=2)
 */
export type GameType = 'spinny' | 'jigsaw' | 'patchwork';

/**
 * Difficulty level, controls piece count / snap tolerance.
 * Original: GameMode enum in GameManager.h
 *   GameModeEasy=2, GameModeMedium=3, GameModeHard=4
 */
export type GameMode = 'easy' | 'medium' | 'hard';

/**
 * Five-step first-run tutorial state machine.
 * Original: TutorialStep enum in Common.h
 */
export type TutorialStep =
  | 'none'
  | 'select_spinny'      // TutorialStepSelectGame1Step1 — highlight Spinny on menu
  | 'select_first_level' // TutorialStepSelectGame1Step2 — highlight first level
  | 'rotate_ring'        // TutorialStepSelectGame1Step3 — show finger gesture
  | 'tap_hint'           // TutorialStepSelectGame1Step4 — highlight hint button
  | 'completed';         // TutorialStepSelectGame1Step5

/**
 * App language codes.
 * Original: AppManager.appLanguages array = ['en', 'fr', 'es', 'ru']
 */
export type LanguageCode = 'en' | 'fr' | 'es' | 'ru';

// ─────────────────────────────────────────────
// Domain models (mirror Core Data entities)
// ─────────────────────────────────────────────

/**
 * A single puzzle level.
 * Original: Level CoreData entity + Level+Tools category.
 */
export interface Level {
  id: string;
  name: string;
  packageName: string;
  imgUrl: string;
  imgPath: string;
  layerImgPath?: string;
  order: number;
  imageDownloaded: boolean;
  levelCompleted: boolean;
  isInitialData: boolean;
  /** Bundled image filename (e.g. "dog.png"), or null if no bundled color image. */
  colorImage: string | null;
  /** Bundled layer image filename (e.g. "dog_layer.png"), or null if no bundled layer image. */
  layerImage: string | null;
  /** English fact shown on the completion card. Original: level.descrip from server. */
  descrip: string;
  /** Hex color for the animal name label on the completion card. Original: title_color. */
  titleColor: string;
  /** Path to the downloaded animal sound file (server-populated). Original: audio field. */
  audio?: string;
  audio_fr?: string;
  audio_es?: string;
  audio_ru?: string;
}

/**
 * A themed package (collection of levels).
 * Original: Package CoreData entity.
 */
export interface Package {
  id: string;
  name: string;
  backgroundColorDark: string;
  backgroundColorLight: string;
  circleColor: string;
  circleRangeColors: string;
  touchedLayerColor: string;
  isPurchased: boolean;
  /** Hex color of the description text on the completion card. Original: text_color in DBManager. */
  textColor: string;
  /** Asset name for the per-package "Next" button (e.g. "btnNextFarm"). */
  nextButtonImage: string;
}

/**
 * Persisted app-wide game settings.
 * Original: GameSettings CoreData entity.
 */
export interface GameSettingsRecord {
  id: string;
  hintsCount: number;
  appReviewCounter: number;
  /** Unix timestamp ms. Original: lastSyncDateForServer NSDate */
  lastSyncDate: number;
  levelsLoadedOk: boolean;
  packagesLoadedOk: boolean;
}

/**
 * A deduplicated analytics event record.
 * Original: GameLogs CoreData entity.
 */
export interface GameLog {
  id: string;
  eventName: string;
  count: number;
  /** Unix timestamp ms. Original: date NSDate */
  date: number;
}

// ─────────────────────────────────────────────
// Derived / UI types
// ─────────────────────────────────────────────

/** Package with its levels attached, used by LevelsScreen. */
export interface PackageWithLevels {
  package: Package;
  levels: Level[];
}

/** Minimal info passed when navigating into gameplay. */
export interface LevelNavigationParams {
  level: Level;
  packageInfo: PackageWithLevels;
}
