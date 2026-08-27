import {
  RewardedAd,
  RewardedAdEventType,
  InterstitialAd,
  AdEventType,
} from 'react-native-google-mobile-ads';

const REWARDED_UNIT_ID     = 'ca-app-pub-1196012165512611/1930417785';
const INTERSTITIAL_UNIT_ID = 'ca-app-pub-1196012165512611/3656626793';

/**
 * Max time to wait for an interstitial to load+show before giving up and
 * letting the caller continue. showAfterLevel() is awaited inline in level
 * transitions (goNext etc.) across every game — it must never hang play
 * indefinitely on a slow/absent ad fill.
 */
const INTERSTITIAL_TIMEOUT_MS = 8000;

class AdsService {
  // Single interstitial kept preloaded ahead of time (see preloadInterstitial),
  // so showAfterLevel() can display it instantly instead of eating the load
  // latency at the moment a level completes.
  private interstitial: InterstitialAd | null = null;
  private interstitialLoaded = false;
  private showRequested = false;
  private pendingResolve: (() => void) | null = null;

  /**
   * Start loading an interstitial ahead of time. Call this as soon as a
   * gameplay screen opens, so it's ready by the time the player finishes
   * the level. Idempotent — no-ops while a load is already in flight or one
   * is already sitting loaded and unused.
   */
  preloadInterstitial(): void {
    if (this.interstitial) return;

    const ad = InterstitialAd.createForAdRequest(INTERSTITIAL_UNIT_ID);
    this.interstitial = ad;
    this.interstitialLoaded = false;

    ad.addAdEventListener(AdEventType.LOADED, () => {
      this.interstitialLoaded = true;
      if (this.showRequested) {
        this.showRequested = false;
        ad.show().catch(() => this.resolvePending());
      }
    });

    ad.addAdEventListener(AdEventType.ERROR, () => {
      this.interstitial = null;
      this.interstitialLoaded = false;
      if (this.showRequested) {
        this.showRequested = false;
        this.resolvePending();
      }
    });

    ad.addAdEventListener(AdEventType.CLOSED, () => {
      this.interstitial = null;
      this.interstitialLoaded = false;
      this.resolvePending();
      // Immediately start loading the next one for the next level.
      this.preloadInterstitial();
    });

    ad.load();
  }

  private resolvePending(): void {
    this.pendingResolve?.();
    this.pendingResolve = null;
  }

  /**
   * Show the preloaded interstitial. Resolves once dismissed (or on
   * failure/timeout/no-fill) — callers await this before continuing to the
   * next level, so it never rejects and never hangs past the timeout. If
   * nothing was preloaded yet (preloadInterstitial() wasn't called, or is
   * still loading), starts a load now and shows as soon as it's ready.
   */
  showAfterLevel(): Promise<void> {
    return new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        this.showRequested = false;
        this.pendingResolve = null;
        resolve();
      }, INTERSTITIAL_TIMEOUT_MS);

      this.pendingResolve = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      };

      if (this.interstitial && this.interstitialLoaded) {
        this.interstitial.show().catch(() => this.resolvePending());
      } else {
        this.showRequested = true;
        this.preloadInterstitial(); // no-op if a load is already in flight
      }
    });
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
