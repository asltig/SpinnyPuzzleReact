/**
 * monetizationService.ts
 * Applies the server's monetization mode (adsInfoService) across every
 * game. One IAP product (FULL_PACKAGE_KEY, "com.magicdevs.spinnypuzzle.all")
 * serves both roles depending on mode:
 *
 *   'ads'     (display=0) — all levels playable; show an interstitial after
 *             every level completion unless the player owns the product
 *             ("Remove Ads" framing).
 *   'paywall' (display=1) — no ads at all; every game's second level onward
 *             is locked until the player owns the product ("Full Package"
 *             framing).
 */
import { getMonetizationMode } from '../api/adsInfoService';
import { adsService } from '../ads/adsService';
import { useProgressStore } from '../../stores/useProgressStore';
import { FULL_PACKAGE_KEY } from '../iap/iapService';

export { FULL_PACKAGE_KEY };

export function hasFullPackage(): boolean {
  return useProgressStore.getState().isPackagePurchased(FULL_PACKAGE_KEY);
}

/**
 * True when `levelIndex` (0-based position within its game — NOT within a
 * package; e.g. Spinny's levelIndex counts across all packages in play
 * order) should be locked behind the paywall. The first level of every game
 * (levelIndex 0) is always playable.
 */
export function isLevelLockedByPaywall(levelIndex: number): boolean {
  if (levelIndex <= 0) return false;
  if (getMonetizationMode() !== 'paywall') return false;
  return !hasFullPackage();
}

/**
 * Call after any level completes, in any game. Shows an interstitial ad if
 * the current mode is 'ads' and the player hasn't purchased the product;
 * no-ops in 'paywall' mode (no ads there, ever) or once purchased.
 */
export async function maybeShowInterstitial(): Promise<void> {
  if (getMonetizationMode() !== 'ads') return;
  if (hasFullPackage()) return;
  await adsService.showAfterLevel();
}

/**
 * Call as soon as a gameplay screen opens, in any game. Starts loading an
 * interstitial ahead of time (same 'ads' mode / not-purchased gate as
 * maybeShowInterstitial) so it's already sitting ready by the time the
 * player finishes the level, instead of eating load latency right when
 * maybeShowInterstitial() is called.
 */
export function preloadInterstitial(): void {
  if (getMonetizationMode() !== 'ads') return;
  if (hasFullPackage()) return;
  adsService.preloadInterstitial();
}
