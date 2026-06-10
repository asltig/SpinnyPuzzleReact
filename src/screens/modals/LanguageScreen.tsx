/**
 * LanguageScreen.tsx  —  matches IMG_1383.PNG
 *
 * Title:    "CHOOSE LANGUAGE"
 * Content:  2×2 grid of green pill buttons (English, Français / Español, Русский)
 *           Selected language has a slightly lighter/outlined style.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList }     from '../../navigation/types';
import type { LanguageCode }           from '../../types/models';
import { useSettingsStore }            from '../../stores/useSettingsStore';
import ModalCard, { FS, INNER_W }      from '../../components/ModalCard';

type Props = NativeStackScreenProps<RootStackParamList, 'Language'>;

const LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: 'en', label: 'English'  },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español'  },
  { code: 'ru', label: 'Русский'  },
];

export default function LanguageScreen({ navigation }: Props): React.JSX.Element {
  const { languageCode, setLanguage } = useSettingsStore();

  const close = () => navigation.goBack();

  const handleSelect = (code: LanguageCode, label: string) => {
    setLanguage(label, code);
    close();
  };

  const rows = [LANGUAGES.slice(0, 2), LANGUAGES.slice(2, 4)] as const;

  return (
    <ModalCard title="CHOOSE LANGUAGE" onClose={close}>
      <View style={styles.grid}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map((lang) => {
              const selected = lang.code === languageCode;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.btn, selected && styles.btnSelected]}
                  onPress={() => handleSelect(lang.code, lang.label)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.btnText, selected && styles.btnTextSelected]}>
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </ModalCard>
  );
}

const BTN_W = Math.round((INNER_W - FS(12)) / 2);

const styles = StyleSheet.create({
  grid: {
    gap: FS(12),
    width: '100%',
  },
  row: {
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            FS(12),
  },

  btn: {
    width:           BTN_W,
    height:          FS(42),
    borderRadius:    FS(24),
    backgroundColor: '#5aba3c',
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#2d6e1a',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.5,
    shadowRadius:    0,
    elevation:       4,
  },
  btnSelected: {
    backgroundColor: '#7dd64c',
    borderWidth:     2,
    borderColor:     '#fff',
  },
  btnText: {
    fontFamily: 'FredokaOne-Regular',
    fontSize:   FS(16),
    color:      '#fff',
  },
  btnTextSelected: {
    color: '#fff',
  },
});
