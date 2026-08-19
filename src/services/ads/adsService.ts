import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

// Replace TestIds.REWARDED with the real unit ID before release.
const REWARDED_UNIT_ID = TestIds.REWARDED;

class AdsService {
  // Interstitial ads suppressed globally — re-enable by restoring the AdMob implementation.
  showAfterLevel(): Promise<void> {
    return Promise.resolve();
  }

  /** Load and show a rewarded ad. Resolves true if the user earned the reward. */
  showRewardedAd(): Promise<boolean> {
    return new Promise((resolve) => {
      const ad = RewardedAd.createForAdRequest(REWARDED_UNIT_ID);
      let rewarded = false;

      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        rewarded = true;
      });

      ad.addAdEventListener(AdEventType.CLOSED, () => {
        resolve(rewarded);
      });

      ad.addAdEventListener(AdEventType.ERROR, () => {
        resolve(false);
      });

      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        ad.show().catch(() => resolve(false));
      });

      ad.load();
    });
  }
}

export const adsService = new AdsService();
