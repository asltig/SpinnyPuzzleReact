/**
 * FullPackagePaywallModal.tsx
 * Shown when the player taps a level locked by paywall monetization mode
 * (adsInfo display=1 — see monetizationService.ts). Visual design ported
 * from the LevelsMap.jsx concept screen's "Unlock the Full Game" popup.
 *
 * Self-contained: drives the purchase/restore flow itself via iapService and
 * persists the result to useProgressStore, so callers only need to render it
 * conditionally and react to onPurchased/onClose.
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { iapService } from '../services/iap/iapService';
import { FULL_PACKAGE_KEY } from '../services/monetization/monetizationService';
import { useProgressStore } from '../stores/useProgressStore';

const PURPLE      = '#a06adf';
const PURPLE_DARK = '#7b45bd';

interface Props {
  visible:      boolean;
  onClose:      () => void;
  /** Called once the purchase (or a matching restore) succeeds, right before onClose. */
  onPurchased?: () => void;
}

function CloseIcon(): React.JSX.Element {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Path fill="#8a97a3" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12z" />
    </Svg>
  );
}

function LockIcon(): React.JSX.Element {
  return (
    <Svg width={30} height={30} viewBox="0 0 24 24">
      <Path
        fill={PURPLE}
        d="M18,8h-1V6c0,-2.76,-2.24,-5,-5,-5S7,3.24,7,6v2H6c-1.1,0,-2,0.9,-2,2v10 c0,1.1,0.9,2,2,2h12c1.1,0,2,-0.9,2,-2V10C20,8.9,19.1,8,18,8z M12,17c-1.1,0,-2,-0.9,-2,-2s0.9,-2,2,-2s2,0.9,2,2S13.1,17,12,17z M15.1,8H8.9V6c0,-1.71,1.39,-3.1,3.1,-3.1 s3.1,1.39,3.1,3.1V8z"
      />
    </Svg>
  );
}

export function FullPackagePaywallModal({ visible, onClose, onPurchased }: Props): React.JSX.Element | null {
  const addPurchasedPackage = useProgressStore((s) => s.addPurchasedPackage);
  const [buying, setBuying] = useState(false);
  const [restoreState, setRestoreState] = useState<'idle' | 'busy' | 'none'>('idle');

  const handleBuy = useCallback(async () => {
    const product = iapService.getProduct(FULL_PACKAGE_KEY);
    if (!product) return;
    setBuying(true);
    const ok = await iapService.purchasePackage(product.productId);
    setBuying(false);
    if (ok) {
      addPurchasedPackage(FULL_PACKAGE_KEY);
      onPurchased?.();
      onClose();
    }
  }, [addPurchasedPackage, onPurchased, onClose]);

  const handleRestore = useCallback(async () => {
    if (restoreState === 'busy') return;
    setRestoreState('busy');
    const restoredIds = await iapService.restorePurchases();
    const restored = restoredIds.some(
      (id) => iapService.productIdToPackageName(id) === FULL_PACKAGE_KEY,
    );
    if (restored) {
      addPurchasedPackage(FULL_PACKAGE_KEY);
      setRestoreState('idle');
      onPurchased?.();
      onClose();
    } else {
      setRestoreState('none');
    }
  }, [restoreState, addPurchasedPackage, onPurchased, onClose]);

  if (!visible) return null;

  const product = iapService.getProduct(FULL_PACKAGE_KEY);
  const priceLabel = product?.localizedPrice ?? '$4.99';
  const restoreLabel =
    restoreState === 'busy' ? 'Restoring…' : restoreState === 'none' ? 'No purchase found' : 'Restore Purchases';

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      <View style={styles.card}>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Close" style={styles.close}>
          <CloseIcon />
        </TouchableOpacity>

        <View style={styles.iconWrap}>
          <LockIcon />
        </View>

        <Text style={styles.title}>Unlock the Full Game</Text>
        <Text style={styles.subtitle}>Get every world and all levels, forever. One payment, no ads.</Text>

        <Text style={styles.price}>
          {priceLabel} <Text style={styles.priceUnit}>one-time</Text>
        </Text>

        <View style={styles.btnRow}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={styles.laterBtn}>
            <Text style={styles.laterText}>Maybe later</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleBuy} disabled={buying} activeOpacity={0.85} style={styles.unlockBtn}>
            {buying ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.unlockText}>Unlock</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={handleRestore}
          disabled={restoreState === 'busy'}
          activeOpacity={0.85}
          style={styles.restoreBtn}
        >
          <Text style={styles.restoreText}>{restoreLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,14,22,0.6)',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:           30,
  },
  card: {
    width:             320,
    backgroundColor:   '#ffffff',
    borderRadius:      32,
    paddingTop:        26,
    paddingHorizontal: 26,
    paddingBottom:     22,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 24 },
    shadowOpacity:     0.35,
    shadowRadius:      48,
    elevation:         12,
  },
  close: {
    position:        'absolute',
    top:             14,
    right:           14,
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: '#f2f4f6',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          2,
  },
  iconWrap: {
    width:            64,
    height:           64,
    borderRadius:     32,
    backgroundColor:  '#f3e9fb',
    alignItems:       'center',
    justifyContent:   'center',
    alignSelf:        'center',
    marginBottom:     14,
    shadowColor:      'rgba(140,90,190,0.35)',
    shadowOffset:     { width: 0, height: 6 },
    shadowOpacity:    1,
    shadowRadius:     14,
    elevation:        6,
  },
  title:    { textAlign: 'center', fontWeight: '700', fontSize: 21, color: '#2c3e50', marginBottom: 6 },
  subtitle: { textAlign: 'center', fontSize: 14, color: '#8a97a3', fontWeight: '500', lineHeight: 20, marginBottom: 18 },
  price:      { textAlign: 'center', fontWeight: '700', fontSize: 26, color: '#2c3e50', marginBottom: 20 },
  priceUnit:  { fontSize: 14, color: '#8a97a3', fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 10 },
  laterBtn: {
    flex:            1,
    paddingVertical: 14,
    borderRadius:    16,
    borderWidth:     2,
    borderColor:     '#e3e8ec',
    backgroundColor: '#ffffff',
    alignItems:      'center',
    justifyContent:  'center',
  },
  laterText: { color: '#5b6b78', fontWeight: '700', fontSize: 15 },
  unlockBtn: {
    flex:            1,
    paddingVertical: 14,
    borderRadius:    16,
    backgroundColor: PURPLE,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     PURPLE_DARK,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   1,
    shadowRadius:    0,
    elevation:       4,
  },
  unlockText:  { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  restoreBtn:  { width: '100%', marginTop: 14, paddingVertical: 6, alignItems: 'center' },
  restoreText: { color: '#8a97a3', fontWeight: '600', fontSize: 13, textDecorationLine: 'underline' },
});
