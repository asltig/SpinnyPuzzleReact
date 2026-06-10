import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  ImageBackground,
} from 'react-native';

const sc  = Dimensions.get('screen');
const W   = Math.max(sc.width, sc.height);
const H   = Math.min(sc.width, sc.height);

export const CARD_W  = Math.round(W * 0.50);
export const CLOSE_R = Math.round(H * 0.044);
const OUTER_RADIUS   = 34;
const INNER_RADIUS   = 20;
const TITLE_ZONE_H   = Math.round(H * 0.20);
const SIDE_PAD       = 14;
export const INNER_W = CARD_W - SIDE_PAD * 2;

export const FS = (n: number) => Math.round(n * (H / 375));

interface Props {
  title:    string;
  onClose:  () => void;
  children: React.ReactNode;
}

export default function ModalCard({ title, onClose, children }: Props) {
  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      />

      <View style={styles.cardWrapper}>
        <ImageBackground
          source={require('../assets/images/alertBase.png')}
          style={styles.outerCard}
          imageStyle={{ borderRadius: OUTER_RADIUS }}
          resizeMode="stretch"
        >
          {/* Blue title zone */}
          <View style={styles.titleZone}>
            <Text style={styles.title}>{title}</Text>
          </View>

          {/* White inner card — shrinks to content */}
          <View style={styles.innerCard}>
            {children}
          </View>
        </ImageBackground>

        {/* × button lives outside ImageBackground so overflow:hidden won't clip it */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <Text style={styles.closeX}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.50)',
    alignItems:      'center',
    justifyContent:  'center',
  },

  cardWrapper: {
    width:    CARD_W,
    overflow: 'visible',
    ...Platform.select({
      ios: {
        shadowColor:   '#000',
        shadowOffset:  { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius:  14,
      },
      android: { elevation: 14 },
    }),
  },

  outerCard: {
    width:        CARD_W,
    borderRadius: OUTER_RADIUS,
    overflow:     'hidden',
    // fallback colour while image loads
    backgroundColor: '#5bc8e8',
  },

  titleZone: {
    height:            TITLE_ZONE_H,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 44,
  },
  title: {
    fontFamily:       'FredokaOne-Regular',
    fontSize:         FS(26),
    color:            '#b8f5c8',
    textShadowColor:  '#fff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
    textAlign:        'center',
    letterSpacing:    0.5,
  },

  innerCard: {
    marginHorizontal: SIDE_PAD,
    marginBottom:     SIDE_PAD,
    backgroundColor:  '#fff',
    borderRadius:     INNER_RADIUS,
    paddingVertical:  FS(20),
    paddingHorizontal: FS(18),
    alignItems:       'center',
  },

  closeBtn: {
    position:        'absolute',
    top:             -(CLOSE_R * 0.5),
    right:           -(CLOSE_R * 0.5),
    width:           CLOSE_R * 2,
    height:          CLOSE_R * 2,
    borderRadius:    CLOSE_R,
    backgroundColor: '#e53935',
    borderWidth:     2.5,
    borderColor:     '#fff',
    alignItems:      'center',
    justifyContent:  'center',
    ...Platform.select({
      ios: {
        shadowColor:   '#000',
        shadowOffset:  { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius:  4,
      },
      android: { elevation: 8 },
    }),
  },
  closeX: {
    color:      '#fff',
    fontSize:   FS(14),
    fontWeight: '800',
    lineHeight: FS(16),
  },
});
