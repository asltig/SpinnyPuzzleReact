/**
 * iapService.ts
 * In-app purchase handling via react-native-iap.
 * Replaces: IAPHelp + RageIAPHelp StoreKit wrappers.
 */
import {
  initConnection,
  getProducts,
  requestPurchase,
  getPurchaseHistory,
  finishTransaction,
  type Product,
  type Purchase,
} from 'react-native-iap';

// Product IDs match original IAP identifiers (update with real App Store IDs)
const REMOVE_ADS_PRODUCT_ID = 'com.magicdevs.spinnypuzzle.all';
export const HINTS_PRODUCT_ID = 'com.magic.10hints';

/**
 * Logical key for com.magicdevs.spinnypuzzle.all — the single product that
 * both removes ads (adsInfo display=0 mode) and unlocks the full game
 * (display=1 paywall mode). Same product, different framing depending on
 * mode — see monetizationService.ts.
 */
export const FULL_PACKAGE_KEY = 'remove_ads';

const PRODUCT_IDS: string[] = [
  REMOVE_ADS_PRODUCT_ID,
  HINTS_PRODUCT_ID,
];

class IAPService {
  private products: Product[] = [];

  /** Initialize StoreKit connection. Call once at app start. */
  async init(): Promise<void> {
    try {
      await initConnection();
      this.products = await getProducts({ skus: PRODUCT_IDS });
    } catch (e) {
      console.warn('[IAP] init failed:', e);
    }
  }

  getAvailableProducts(): Product[] {
    return this.products;
  }

  /** Look up a product by logical package name or exact product ID. */
  getProduct(packageName: string): Product | undefined {
    // Direct match first
    const direct = this.products.find((p) => p.productId === packageName);
    if (direct) return direct;
    // 'remove_ads' → com.magicdevs.spinnypuzzle.all
    if (packageName === 'remove_ads') {
      return this.products.find((p) => p.productId === REMOVE_ADS_PRODUCT_ID);
    }
    return undefined;
  }

  /**
   * Reverse of getProduct's logical-name mapping — used by restore flows,
   * which only have raw product IDs to work with. Returns null for an
   * unrecognized product ID.
   */
  productIdToPackageName(productId: string): string | null {
    if (productId === REMOVE_ADS_PRODUCT_ID) return 'remove_ads';
    return null;
  }

  /**
   * Reverse of getProduct's logical-name mapping — used by restore flows,
   * which only have raw product IDs to work with. Returns null for an
   * unrecognized product ID.
   */
  productIdToPackageName(productId: string): string | null {
    if (productId === REMOVE_ADS_PRODUCT_ID) return 'remove_ads';
    const match = PAID_PACKAGES.find(
      (pkg) => `com.spinnypuzzle.${pkg.toLowerCase()}` === productId,
    );
    return match ?? null;
  }

  /**
   * Purchase 10 hints (consumable product).
   * Returns true on success.
   */
  async purchaseHints(): Promise<boolean> {
    try {
      const purchase = await requestPurchase({ sku: HINTS_PRODUCT_ID });
      if (purchase) {
        await finishTransaction({ purchase: purchase as Purchase, isConsumable: true });
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[IAP] hints purchase failed:', e);
      return false;
    }
  }

  /**
   * Purchase a package by product ID.
   * Replaces: IAPHelp.purchaseProduct + RageIAPHelp flow.
   * Returns true on success.
   */
  async purchasePackage(productId: string): Promise<boolean> {
    try {
      const purchase = await requestPurchase({ sku: productId });
      if (purchase) {
        await finishTransaction({ purchase: purchase as Purchase, isConsumable: false });
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[IAP] purchase failed:', e);
      return false;
    }
  }

  /**
   * Restore previous purchases.
   * Replaces: restorePurchases in IAPHelp.
   * Returns array of restored product IDs.
   */
  async restorePurchases(): Promise<string[]> {
    try {
      const history = await getPurchaseHistory();
      return history.map((p) => p.productId);
    } catch (e) {
      console.warn('[IAP] restore failed:', e);
      return [];
    }
  }
}

export const iapService = new IAPService();
