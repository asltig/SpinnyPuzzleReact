/**
 * WatchAdScreen.tsx
 * Placeholder — rewarded ads not currently active.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'WatchAd'>;

export default function WatchAdScreen({ navigation }: Props): React.JSX.Element {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Watch an Ad</Text>
      <Text style={styles.sub}>Coming soon</Text>
      <TouchableOpacity style={styles.cancel} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelText}>Go back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  title:      { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  sub:        { color: '#aaa', fontSize: 14, marginBottom: 32 },
  cancel:     { marginTop: 20 },
  cancelText: { color: '#888', fontSize: 14 },
});
