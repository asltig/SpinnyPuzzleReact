/**
 * types/catalog.ts
 * Typed shape of the server catalog — everything POST /packages and POST
 * /levels return, for all three backend-connected game types (Spinny,
 * Jigsaw, Patchwork). Field names are normalised to camelCase; raw server
 * paths (image/audio) are kept as server-relative strings, unresolved —
 * turning them into full URLs and downloading the files is a later step.
 *
 * Confirmed against the live API response shape (2026-08-24):
 *   POST /packages -> { data: RawCatalogPackage[], version }
 *   POST /levels   -> { data: RawCatalogLevel[],   version }
 */
import type { GameType } from './models';

export interface CatalogPackage {
  id:                   string;
  name:                 string;
  backgroundColorDark:  string;
  backgroundColorLight: string;
  circleColor:          string;
  /** One hex color per ring — empty for non-Spinny packages. */
  circleRangeColors:    string[];
  touchedLayerColor:    string;
  order:                number;
  /** Level count as reported by the server (informational only). */
  levelsCount:          number;
}

export interface CatalogLevel {
  id:              string;
  packageId:       string;
  packageName:     string;
  name:            string;
  nameFr:          string | null;
  nameEs:          string | null;
  nameRu:          string | null;
  /**
   * Free-text fact/description for Spinny & Jigsaw. For Patchwork
   * (packageName "RightPosition") this field is repurposed by the server as
   * a JSON string of piece placements — patchworkService.ts is responsible
   * for parsing it, this module stores it verbatim either way.
   */
  description:     string | null;
  /** Only exists in Russian — the server has no description_fr/description_es. */
  descriptionRu:   string | null;
  titleColor:      string | null;
  /** Server-relative path, e.g. "uploads/levels/cow@3x.png". Not a full URL. */
  image:           string | null;
  backgroundImage: string | null;
  customImage:     string | null;
  audio:           string | null;
  audioFr:         string | null;
  audioEs:         string | null;
  audioRu:         string | null;
  order:           number;
}

/** Which game a package belongs to, keyed by its exact server `name`. */
export const GAME_PACKAGE_NAMES: Record<GameType, readonly string[]> = {
  spinny:    ['Farm', 'Insects', 'Savana', 'Seaworld', 'Jungle', 'Vehicles', 'Dinosaurs'],
  jigsaw:    ['Jigsaw'],
  patchwork: ['RightPosition'],
};
