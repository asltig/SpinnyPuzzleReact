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
import { PAID_PACKAGES } from '../../constants/packageNames';

// Product IDs match original IAP identifiers (update with real App Store IDs)
const PRODUCT_IDS: string[] = PAID_PACKAGES.map(
  (pkg) => `com.spinnypuzzle.${pkg.toLowerCase()}`,
);

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
