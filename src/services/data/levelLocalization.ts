/**
 * levelLocalization.ts
 * Resolves a Spinny level's display name/description in the current app
 * language. Bundled level data (src/data/levels.json) is English-only —
 * translations exist solely in the server catalog (catalogSyncService),
 * matched to a bundled level by package + level name (case-insensitively).
 *
 * Falls back to the bundled English text whenever the catalog hasn't synced
 * yet, has no matching level, or has no translation for that field/language
 * (the server has no description_fr/description_es at all — only
 * description_ru exists, so fr/es descriptions always fall back to English).
 */
import { findCatalogLevel } from '../api/catalogSyncService';
import type { Level, LanguageCode } from '../../types/models';

export function getLocalizedLevelName(level: Level, language: LanguageCode): string {
  if (language === 'en') return level.name;

  const catalogLevel = findCatalogLevel(level.packageName, level.name);
  if (!catalogLevel) return level.name;

  switch (language) {
    case 'fr': return catalogLevel.nameFr ?? level.name;
    case 'es': return catalogLevel.nameEs ?? level.name;
    case 'ru': return catalogLevel.nameRu ?? level.name;
    default:   return level.name;
  }
}

export function getLocalizedLevelDescription(level: Level, language: LanguageCode): string {
  if (language !== 'ru') return level.descrip; // server has no description_fr/description_es

  const catalogLevel = findCatalogLevel(level.packageName, level.name);
  return catalogLevel?.descriptionRu ?? level.descrip;
}
