/**
 * RateUsScreen.tsx  —  matches IMG_1381.PNG
 *
 * Blue outer card / white inner card shell (ModalCard).
 * Title:    "ENJOYING THIS GAME?"
 * Content:  subtitle · 5 tappable stars · Cancel + Submit pill buttons
 * Logic:    5 stars → App Store deep-link; <5 → show feedback TextView; Submit sends
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Linking,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList }     from '../../navigation/types';
import ModalCard, { FS, INNER_W }      from '../../components/ModalCard';

type Props = NativeStackScreenProps<RootStackParamList, 'RateUs'>;

const APP_STORE_URL = 'https://itunes.apple.com/app/id1375454324?action=write-review';

export default function RateUsScreen({ navigation }: Props): React.JSX.Element {
  const [stars,    setStars]    = useState(0);
  const [feedback, setFeedback] = useState('');
  const [showText, setShowText] = useState(false);

  const close = () => navigation.goBack();

  const handleStarPress = (n: number) => {
    setStars(n);
    if (n === 5 && !showText) {
      void Linking.openURL(APP_STORE_URL);
      close();
    }
  };

  const handleSubmit = () => {
    if (stars === 0) return;
    if (stars === 5) { void Linking.openURL(APP_STORE_URL); close(); return; }
    if (!showText)   { setShowText(true); return; }
    // second tap after feedback written — just close (POST feedback here if needed)
    close();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ModalCard title="ENJOYING THIS GAME?" onClose={close}>

        {/* Subtitle */}
        <Text style={styles.subtitle}>Tap a star to rate it on the App Store.</Text>

        {/* Stars */}
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <TouchableOpacity key={n} onPress={() => handleStarPress(n)} style={styles.starHit}>
              <Image
                source={
                  n <= stars
                    ? require('../../assets/images/star_filled.png')
                    : require('../../assets/images/star_empty.png')
                }
                style={styles.starImg}
                resizeMode="contain"
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Feedback input (revealed when < 5 stars, Submit tapped once) */}
        {showText && (
          <TextInput
            style={styles.textInput}
            placeholder="Tell us how we can improve…"
            placeholderTextColor="#aaa"
            value={feedback}
            onChangeText={setFeedback}
            multiline
            maxLength={300}
            textAlignVertical="top"
          />
        )}

        {/* Cancel + Submit */}
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.btn} onPress={close} activeOpacity={0.8}>
            <Text style={styles.btnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, stars === 0 && styles.btnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={stars === 0}
          >
            <Text style={styles.btnText}>Submit</Text>
          </TouchableOpacity>
        </View>

      </ModalCard>
    </KeyboardAvoidingView>
  );
}

const BTN_W = Math.round(INNER_W * 0.44);

const styles = StyleSheet.create({
  flex: { flex: 1 },

  subtitle: {
    fontFamily: 'FredokaOne-Regular',
    fontSize:   FS(15),
    color:      '#555',
    textAlign:  'center',
    marginBottom: FS(14),
  },

  starsRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    marginBottom:   FS(16),
    gap:            FS(6),
  },
  starHit: { padding: FS(4) },
  starImg: { width: FS(42), height: FS(42) },

  textInput: {
    width:           INNER_W - FS(8),
    height:          FS(70),
    borderWidth:     1,
    borderColor:     '#ccc',
    borderRadius:    FS(8),
    padding:         FS(8),
    fontSize:        FS(12),
    color:           '#333',
    marginBottom:    FS(14),
  },

  btnRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            FS(16),
  },
  btn: {
    width:           BTN_W,
    height:          FS(40),
    borderRadius:    FS(22),
    backgroundColor: '#5aba3c',
    alignItems:      'center',
    justifyContent:  'center',
    // 3-D pill shadow
    shadowColor:     '#2d6e1a',
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.5,
    shadowRadius:    0,
    elevation:       4,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: {
    fontFamily: 'FredokaOne-Regular',
    fontSize:   FS(16),
    color:      '#fff',
  },
});