/**
 * IAPScreen.tsx  —  matches IMG_1382.PNG
 *
 * Title:    "REMOVE ADS"
 * Content:  "Remove ads for only" subtitle · large green price pill button · Restore link
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList }     from '../../navigation/types';
import { iapService }                  from '../../services/iap/iapService';
import type { Product }                from 'react-native-iap';
import ModalCard, { FS, INNER_W }      from '../../components/ModalCard';

type Props = NativeStackScreenProps<RootStackParamList, 'IAP'>;

export default function IAPScreen({ navigation, route }: Props): React.JSX.Element {
  const { packageName } = route.params;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const products = iapService.getAvailableProducts();
    const match = products.find((p) =>
      p.productId.toLowerCase().includes(packageName.toLowerCase()),
    );
    setProduct(match ?? null);
  }, [packageName]);

  const close = () => navigation.goBack();

  const handleBuy = useCallback(async () => {
    if (!product) return;
    setLoading(true);
    const ok = await iapService.purchasePackage(product.productId);
    setLoading(false);
    if (ok) close();
  }, [product]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRestore = useCallback(async () => {
    setLoading(true);
    await iapService.restorePurchases();
    setLoading(false);
    close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ModalCard title="REMOVE ADS" onClose={close}>

      <Text style={styles.subtitle}>Remove ads for only</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#5aba3c" style={{ marginVertical: FS(20) }} />
      ) : (
        <>
          {/* Price pill button */}
          <TouchableOpacity
            style={[styles.priceBtn, !product && styles.btnDisabled]}
            onPress={handleBuy}
            activeOpacity={0.8}
            disabled={!product}
          >
            <Text style={styles.priceText}>
              {product ? product.localizedPrice : '…'}
            </Text>
          </TouchableOpacity>

          {/* Restore Purchases plain text link */}
          <TouchableOpacity onPress={handleRestore} style={styles.restoreHit}>
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </TouchableOpacity>
        </>
      )}

    </ModalCard>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontFamily:   'FredokaOne-Regular',
    fontSize:     FS(13),
    color:        '#777',
    textAlign:    'center',
    marginBottom: FS(16),
  },

  priceBtn: {
    width:           INNER_W * 0.72,
    height:          FS(46),
    borderRadius:    FS(26),
    backgroundColor: '#5aba3c',
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#2d6e1a',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.5,
    shadowRadius:    0,
    elevation:       5,
    marginBottom:    FS(14),
  },
  btnDisabled: { opacity: 0.4 },
  priceText: {
    fontFamily: 'FredokaOne-Regular',
    fontSize:   FS(22),
    color:      '#fff',
  },

  restoreHit: { paddingVertical: FS(6) },
  restoreText: {
    fontFamily: 'FredokaOne-Regular',
    fontSize:   FS(12),
    color:      '#888',
    textAlign:  'center',
  },
});