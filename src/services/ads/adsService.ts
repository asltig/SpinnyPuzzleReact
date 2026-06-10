/**
 * adsService.ts
 * Interstitial and rewarded video ads.
 * Replaces: MDAdsManager singleton (Google AdMob primary).
 */
import {
  InterstitialAd,
  RewardedAd,
  AdEventType,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

// Ad unit IDs — fall back to test IDs when real IDs are not configured.
// process.env vars are undefined at runtime unless injected via a Babel plugin;
// passing undefined to createForAdRequest throws, so we always guarantee a string.
const INTERSTITIAL_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : (process.env.ADMOB_INTERSTITIAL_ID || TestIds.INTERSTITIAL);
const REWARDED_ID = __DEV__
  ? TestIds.REWARDED
  : (process.env.ADMOB_REWARDED_ID || TestIds.REWARDED);

class AdsService {
  private interstitial: InterstitialAd;
  private rewarded:     RewardedAd;
  private interstitialLoaded = false;
  private rewardedLoaded     = false;

  constructor() {
    this.interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_ID);
    this.rewarded     = RewardedAd.createForAdRequest(REWARDED_ID);
  }

  /** Call at app start — replaces MDAdsManager.loadAds */
  loadAds(): void {
    this.interstitial.addAdEventListener(AdEventType.LOADED, () => {
      this.interstitialLoaded = true;
    });
    this.rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
      this.rewardedLoaded = true;
    });
    this.interstitial.load();
    this.rewarded.load();
  }

  /**
   * Show an interstitial ad if loaded.
   * Replaces: MDAdsManager.displayMDInterstitial:Completion:
   */
  async showInterstitial(): Promise<void> {
    if (!this.interstitialLoaded) return;
    try {
      await this.interstitial.show();
      this.interstitialLoaded = false;
      this.interstitial.load();
    } catch {
      this.interstitialLoaded = false;
    }
  }

  /**
   * Show a rewarded ad. Resolves with `{ rewarded: true }` if the user earns the reward.
   * Replaces: MDAdsManager.requestAndShowRewardedVideoWithSuccess:failure:
   */
  async showRewardedAd(): Promise<{ rewarded: boolean }> {
    if (!this.rewardedLoaded) return { rewarded: false };

    return new Promise((resolve) => {
      const rewardListener = this.rewarded.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        () => {
          rewardListener();
          closeListener();
          this.rewarded.load();   // reload
          resolve({ rewarded: true });
        },
      );
      const closeListener = this.rewarded.addAdEventListener(
        AdEventType.CLOSED,
        () => {
          rewardListener();
          closeListener();
          this.rewarded.load();
          resolve({ rewarded: false });
        },
      );
      this.rewarded.show();
      this.rewardedLoaded = false;
    });
  }
}

export const adsService = new AdsService();
