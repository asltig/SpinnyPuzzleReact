/**
 * adsService.ts
 * Interstitial ad — disabled while remove_ads is active for all users.
 */

class AdsService {
  // Ads suppressed globally — re-enable by restoring the AdMob implementation.
  showAfterLevel(): Promise<void> {
    return Promise.resolve();
  }
}

export const adsService = new AdsService();
