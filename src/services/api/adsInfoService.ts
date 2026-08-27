/**
 * adsInfoService.ts
 * Fetches the server's monetization-mode flag and stores it locally.
 * Endpoint confirmed live (2026-08-24): GET or POST /get_ads_info ->
 * { status: 1, data: { id, counter, display } }, all values stringified,
 * static regardless of the `version` param.
 *
 * `display` selects the whole app's monetization mode (see monetizationService.ts
 * for where this actually gets applied):
 *   display=0 -> 'ads'     — interstitial after every level completion, all
 *                            content playable; "Remove Ads" IAP available.
 *   display=1 -> 'paywall' — no ads at all; every game locks its second level
 *                            onward until the same IAP (framed as "Full
 *                            Package") is purchased.
 * `counter`'s meaning isn't pinned down yet — kept as a raw pass-through field.
 */
import { apiClient } from './apiClient';
import { getStoredAdsInfo, setStoredAdsInfo } from '../../storage/adsInfoStorage';
import type { AdsInfo } from '../../types/adsInfo';

const METHOD_GET_ADS_INFO = '/get_ads_info';

interface RawResponse {
  status?: number;
  data?: {
    id?:      string | number;
    counter?: string | number;
    display?: string | number;
  };
}

function mapAdsInfo(raw: RawResponse['data']): AdsInfo | null {
  if (!raw) return null;
  return {
    id:      String(raw.id ?? ''),
    counter: Number(raw.counter) || 0,
    display: Number(raw.display) || 0,
  };
}

/**
 * Fetch fresh ads info from the server and overwrite local storage.
 * On network failure, leaves whatever was already stored untouched and
 * returns it (possibly null if never synced before) — never throws.
 */
export async function syncAdsInfo(): Promise<AdsInfo | null> {
  try {
    const res = await apiClient.post<RawResponse>(METHOD_GET_ADS_INFO, {});
    const info = mapAdsInfo(res.data?.data);
    if (info) setStoredAdsInfo(info);
  } catch (e) {
    console.warn('[adsInfoService] fetch failed:', e);
  }
  return getStoredAdsInfo();
}

/** Synchronous read of whatever's currently cached (null if never synced). */
export function getCachedAdsInfo(): AdsInfo | null {
  return getStoredAdsInfo();
}

export type MonetizationMode = 'ads' | 'paywall';

/**
 * display=0 -> 'ads', display=1 -> 'paywall'. Defaults to 'ads' when nothing
 * has synced yet — the least disruptive option, since it means no level ever
 * gets locked before we actually know the server's intent.
 */
export function getMonetizationMode(): MonetizationMode {
  const info = getStoredAdsInfo();
  return info?.display === 1 ? 'paywall' : 'ads';
}
