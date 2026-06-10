/**
 * packageNames.ts
 * Package name constants and unlock/download classification.
 * Original: #define TUTORIAL, DINOSAURS etc. + IS_NEED_DOWNLOAD macro in Common.h
 */

// ─────────────────────────────────────────────
// Package name strings
// ─────────────────────────────────────────────

export const PKG_TUTORIAL   = 'Tutorial';
export const PKG_DINOSAURS  = 'Dinosaurs';
export const PKG_JUNGLE     = 'Jungle';
export const PKG_VEHICLES   = 'Vehicles';
export const PKG_SEAWORLD   = 'Seaworld';
export const PKG_JIGSAW     = 'Jigsaw';
export const PKG_PATCHWORK  = 'Patchwork';
export const PKG_RIGHT_POS  = 'RightPosition';

// ─────────────────────────────────────────────
// Free vs paid classification
// ─────────────────────────────────────────────

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

/**
 * Packages that require image download from the server (and IAP to unlock).
 * Original: IS_NEED_DOWNLOAD — Dinosaurs, Jungle, Vehicles, Seaworld
 */
export const PAID_PACKAGES: readonly string[] = [
  PKG_DINOSAURS,
  PKG_JUNGLE,
  PKG_VEHICLES,
  PKG_SEAWORLD,
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** True if a package requires purchase.
 *  Original: IS_NEED_DOWNLOAD macro */
export function isPaidPackage(name: string): boolean {
  return (PAID_PACKAGES as string[]).includes(name);
}

/** True if a package needs image assets downloaded from the server.
 *  Original: IS_NEED_DOWNLOAD macro */
export function requiresDownload(name: string): boolean {
  return isPaidPackage(name);
}

/** True if a package is unlocked (either free, or user has purchased it).
 *  Replaces the AppManager.isLevelCompleted guard on paid packages. */
export function isPackageUnlocked(name: string, purchasedIds: readonly string[]): boolean {
  if (!isPaidPackage(name)) return true;
  return purchasedIds.includes(name);
}
