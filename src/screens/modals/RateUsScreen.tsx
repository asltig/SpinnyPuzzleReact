import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList }     from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RateUs'>;

const ORANGE = '#e8874a';
const APP_STORE_URL = 'https://itunes.apple.com/app/id1375454324?action=write-review';

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

function StarIcon({ size = 40, color = '#59b96a' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M12,17.27L18.18,21l-1.64,-7.03L22,9.24l-7.19,-0.61L12,2L9.19,8.63L2,9.24l5.46,4.73L5.82,21z"
      />
    </Svg>
  );
}

export default function RateUsScreen({ navigation }: Props): React.JSX.Element {
  const close = () => navigation.goBack();

  // Any star rating opens the App Store review page — the number of stars
  // tapped doesn't change the outcome.
  const handleStarPress = () => {
    void Linking.openURL(APP_STORE_URL);
    close();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
        <View style={styles.card}>
          {/* Close button — absolutely positioned top-right */}
          <TouchableOpacity style={styles.closeBtn} onPress={close} accessibilityLabel="Close">
            <CloseIcon />
          </TouchableOpacity>

          {/* Star badge */}
          <View style={styles.badge}>
            <StarIcon size={32} color={ORANGE} />
          </View>

          {/* Title + subtitle */}
          <Text style={styles.title}>Enjoying the game?</Text>
          <Text style={styles.subtitle}>Tap a star to rate us on the App Store</Text>

          {/* Rating stars */}
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <TouchableOpacity key={n} onPress={handleStarPress} accessibilityLabel={`Rate ${n} stars`}>
                <StarIcon size={42} color="#dfe4e8" />
              </TouchableOpacity>
            ))}
          </View>

          {/* Action buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity onPress={close} style={styles.notNowBtn}>
              <Text style={styles.notNowText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
    backgroundColor: '#fdead9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#d27828',
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
  starRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 20,
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
});
