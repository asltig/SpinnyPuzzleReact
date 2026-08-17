import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList }     from '../../navigation/types';
import type { LanguageCode }           from '../../types/models';
import { useSettingsStore }            from '../../stores/useSettingsStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Language'>;

const TEAL = '#5cc2df';

const LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: 'en', label: 'English'  },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español'  },
  { code: 'ru', label: 'Русский'  },
];

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

function GlobeIcon() {
  return (
    <Svg width={30} height={30} viewBox="0 0 24 24">
      <Path
        fill={TEAL}
        d="M11.99,2C6.47,2,2,6.48,2,12s4.47,10,9.99,10C17.52,22,22,17.52,22,12S17.52,2,11.99,2z M18.92,8h-2.95c-0.32,-1.25,-0.78,-2.45,-1.38,-3.56C16.19,5.08,17.79,6.34,18.92,8z M12,4.04c0.83,1.2,1.48,2.53,1.91,3.96h-3.82C10.52,6.57,11.17,5.24,12,4.04z M4.26,14C4.1,13.36,4,12.69,4,12s0.1,-1.36,0.26,-2h3.38C7.55,10.66,7.5,11.33,7.5,12s0.05,1.34,0.14,2H4.26z M5.08,16h2.95c0.32,1.25,0.78,2.45,1.38,3.56C7.81,18.92,6.21,17.66,5.08,16z M8.03,8H5.08c1.13,-1.66,2.73,-2.92,4.33,-3.56C8.81,5.55,8.35,6.75,8.03,8z M12,19.96c-0.83,-1.2,-1.48,-2.53,-1.91,-3.96h3.82C13.48,17.43,12.83,18.76,12,19.96z M14.34,14H9.66c-0.1,-0.66,-0.16,-1.33,-0.16,-2s0.06,-1.35,0.16,-2h4.68c0.1,0.65,0.16,1.32,0.16,2S14.44,13.34,14.34,14z M14.59,19.56c0.6,-1.11,1.06,-2.31,1.38,-3.56h2.95C17.79,17.65,16.21,18.92,14.59,19.56z M16.36,14c0.09,-0.66,0.14,-1.33,0.14,-2s-0.05,-1.34,-0.14,-2h3.38c0.16,0.64,0.26,1.31,0.26,2s-0.1,1.36,-0.26,2H16.36z"
      />
    </Svg>
  );
}

export default function LanguageScreen({ navigation }: Props): React.JSX.Element {
  const { languageCode, setLanguage } = useSettingsStore();

  const close = () => navigation.goBack();

  const handleSelect = (code: LanguageCode, label: string) => {
    setLanguage(label, code);
    close();
  };

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
      <View style={styles.card}>
        {/* Close button — absolutely positioned top-right */}
        <TouchableOpacity style={styles.closeBtn} onPress={close} accessibilityLabel="Close">
          <CloseIcon />
        </TouchableOpacity>

        {/* Globe icon badge */}
        <View style={[styles.badge, { backgroundColor: '#e6f6fa', shadowColor: '#3fa9c4' }]}>
          <GlobeIcon />
        </View>

        {/* Title */}
        <Text style={[styles.title, { marginBottom: 12 }]}>Choose Language</Text>

        {/* Language rows */}
        {LANGUAGES.map(lang => {
          const selected = lang.code === languageCode;
          return (
            <TouchableOpacity
              key={lang.code}
              onPress={() => handleSelect(lang.code, lang.label)}
              style={[styles.langRow, { backgroundColor: selected ? TEAL : '#f4f7f8' }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.langText, { color: selected ? '#ffffff' : '#2c3e50' }]}>
                {lang.label}
              </Text>
            </TouchableOpacity>
          );
        })}
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
    padding: 18,
    position: 'relative',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#f2f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  badge: {
    width: 50,
    height: 50,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#2c3e50',
    textAlign: 'center',
  },
  langRow: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 16,
    marginBottom: 8,
  },
  langText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
