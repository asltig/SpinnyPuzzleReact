/**
 * types/adsInfo.ts
 * Shape of GET/POST /get_ads_info — a small server-controlled config/flag
 * endpoint, unrelated to the packages/levels catalog. Confirmed live
 * (2026-08-24): { status: 1, data: { id: "1", counter: "2", display: "0" } }
 * — static, does not vary with the `version` param, works via GET or POST.
 *
 * Exact meaning of `counter`/`display` isn't pinned down yet — kept as raw
 * pass-through fields (number-coerced) rather than guessing their intended
 * use. `display` reads like a 0/1 boolean flag; isAdsDisplayEnabled() in
 * adsInfoService.ts exposes that interpretation for convenience.
 */
export interface AdsInfo {
  id:      string;
  counter: number;
  display: number;
}
