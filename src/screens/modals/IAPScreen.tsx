import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList }     from '../../navigation/types';
import { iapService }                  from '../../services/iap/iapService';
import type { Product }                from 'react-native-iap';

type Props = NativeStackScreenProps<RootStackParamList, 'IAP'>;

const PURPLE = '#9a5cc9';

function CloseIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        fill="#7a8a99"
        d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12z"
      />
    </Svg>
  );
}

function LockIcon({ color = '#fff', size = 30 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M18,8h-1V6c0,-2.76,-2.24,-5,-5,-5S7,3.24,7,6v2H6c-1.1,0,-2,0.9,-2,2v10c0,1.1,0.9,2,2,2h12c1.1,0,2,-0.9,2,-2V10C20,8.9,19.1,8,18,8z M12,17c-1.1,0,-2,-0.9,-2,-2s0.9,-2,2,-2s2,0.9,2,2S13.1,17,12,17z M15.1,8H8.9V6c0,-1.71,1.39,-3.1,3.1,-3.1s3.1,1.39,3.1,3.1V8z"
      />
    </Svg>
  );
}

export default function IAPScreen({ navigation, route }: Props): React.JSX.Element {
  const { packageName } = route.params;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setProduct(iapService.getProduct(packageName) ?? null);
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

  const priceLabel = product ? product.localizedPrice : '$4.99';

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
      <View style={styles.card}>
        {/* Close button */}
        <TouchableOpacity style={styles.closeBtn} onPress={close} accessibilityLabel="Close">
          <CloseIcon />
        </TouchableOpacity>

        {/* Lock badge */}
        <View style={styles.badge}>
          <LockIcon color={PURPLE} size={30} />
        </View>

        {/* Title + subtitle */}
        <Text style={styles.title}>Remove Ads Forever</Text>
        <Text style={styles.subtitle}>
          No interruptions between games — just uninterrupted play time.
        </Text>

        {/* Price */}
        {loading ? (
          <ActivityIndicator size="large" color={PURPLE} style={{ marginBottom: 20 }} />
        ) : (
          <Text style={styles.priceText}>
            {priceLabel}{' '}
            <Text style={styles.priceUnit}>one-time</Text>
          </Text>
        )}

        {/* Action buttons */}
        <View style={styles.btnRow}>
          <TouchableOpacity onPress={close} style={styles.notNowBtn}>
            <Text style={styles.notNowText}>Maybe later</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleBuy}
            disabled={loading || !product}
            style={[styles.submitBtn, { backgroundColor: (!product || loading) ? '#c7ccd1' : PURPLE }]}
          >
            <Text style={styles.submitText}>Remove Ads</Text>
          </TouchableOpacity>
        </View>

        {/* Restore Purchases */}
        <TouchableOpacity onPress={handleRestore} disabled={loading} style={{ marginTop: 14 }}>
          <Text style={styles.restoreText}>Restore Purchases</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,20,40,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 320,
    backgroundColor: '#ffffff',
    borderRadius: 32,
    padding: 26,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 14,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#f2f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: '#f3e9fb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#8c5ac0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    fontSize: 21,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#8a97a3',
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
  },
  priceText: {
    fontWeight: '700',
    fontSize: 26,
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  priceUnit: {
    fontSize: 14,
    color: '#8a97a3',
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  notNowBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e3e8ec',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  notNowText: {
    color: '#5b6b78',
    fontWeight: '700',
    fontSize: 15,
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 4,
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  restoreText: {
    color: '#8a97a3',
    fontWeight: '600',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
