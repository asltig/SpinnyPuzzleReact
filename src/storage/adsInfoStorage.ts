/**
 * adsInfoStorage.ts
 * Local persistence for the server's ads/feature-flag config
 * (adsInfoService — GET/POST /get_ads_info). Plain JSON in MMKV, same
 * pattern as catalogStorage.ts.
 */
import { storage } from './mmkv';
import type { AdsInfo } from '../types/adsInfo';

const KEY_ADS_INFO = 'adsInfo.data';

export function getStoredAdsInfo(): AdsInfo | null {
  const raw = storage.getString(KEY_ADS_INFO);
  if (!raw) return null;
  try { return JSON.parse(raw) as AdsInfo; }
  catch { return null; }
}

export function setStoredAdsInfo(info: AdsInfo): void {
  storage.set(KEY_ADS_INFO, JSON.stringify(info));
}
