/**
 * WatchAdScreen.tsx
 * Modal — user watches a rewarded ad to earn hints.
 * Replaces: WatchAdViewController (ObjC).
 * Full UI in Step 10 (ads integration).
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { adsService }  from '../../services/ads/adsService';
import { useHintsStore } from '../../stores/useHintsStore';

type Props = NativeStackScreenProps<RootStackParamList, 'WatchAd'>;

export default function WatchAdScreen({ navigation, route }: Props): React.JSX.Element {
  const { onRewarded } = route.params;
  const { addHintsFromAd } = useHintsStore();
  const [loading, setLoading] = React.useState(false);

  const handleWatch = useCallback(async () => {
    setLoading(true);
    const result = await adsService.showRewardedAd();
    setLoading(false);
    if (result.rewarded) {
      addHintsFromAd();
      onRewarded();
    }
    navigation.goBack();
  }, [adsService, addHintsFromAd, onRewarded, navigation]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Watch an Ad</Text>
      <Text style={styles.sub}>Earn 5 hints for free!</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#7c3aed" style={{ marginTop: 32 }} />
      ) : (
        <TouchableOpacity style={styles.btn} onPress={handleWatch}>
          <Text style={styles.btnText}>▶  Watch Now</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.cancel} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelText}>No thanks</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  title:      { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  sub:        { color: '#aaa', fontSize: 14, marginBottom: 32 },
  btn:        { backgroundColor: '#7c3aed', paddingHorizontal: 36, paddingVertical: 14,
                borderRadius: 12 },
  btnText:    { color: '#fff', fontSize: 16 },
  cancel:     { marginTop: 20 },
  cancelText: { color: '#888', fontSize: 14 },
});
