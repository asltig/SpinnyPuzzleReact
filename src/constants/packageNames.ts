/**
 * packageNames.ts
 * Package name constants.
 * Original: #define TUTORIAL, JIGSAW etc. in Common.h
 */

// ─────────────────────────────────────────────
// Package name strings
// ─────────────────────────────────────────────

export const PKG_TUTORIAL   = 'Tutorial';
export const PKG_JIGSAW     = 'Jigsaw';
export const PKG_PATCHWORK  = 'Patchwork';
export const PKG_RIGHT_POS  = 'RightPosition';

/**
 * Packages bundled with the app — no download or purchase needed.
 * Original: IS_NOT_FOR_DOWNLOAD — Tutorial, Jigsaw, Patchwork, RightPosition
 */
export const FREE_PACKAGES: readonly string[] = [
  PKG_TUTORIAL,
  PKG_JIGSAW,
  PKG_PATCHWORK,
  PKG_RIGHT_POS,
];

