/**
 * HintTapTutorial.tsx
 * Final step of the first-level ring-rotation tutorial.
 *
 * Once only the last ring remains, dragging it is no longer demonstrated —
 * instead the board dims and blocks all touches, and a hand taps the Hint
 * button in the corner to show the player how to finish the puzzle.
 *
 * The dim layer is a plain View with default pointerEvents ("auto"), which
 * is enough to swallow touches to everything beneath it (RingBoard's
 * GestureDetector included) since RN routes a touch to the topmost view at
 * that point. It renders with a lower zIndex than the HUD buttons
 * (SpinnyGamePlayScreen's floatBtn = 10) so Back/Hint stay visible and
 * tappable above the dim.
 */

import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const HINT_FINGER = require('../../assets/images/HintFinger.png');

interface HintTapTutorialProps {
  /** Distance from the screen's right edge to the Hint button — matches its own `{ right }` placement. */
  buttonRight: number;
  /** Distance from the screen's top edge to the Hint button — matches its own `{ top }` placement. */
  buttonTop:   number;
  /** Hint button's diameter. */
  buttonSize:  number;
}

export function HintTapTutorial({
  buttonRight,
  buttonTop,
  buttonSize,
}: HintTapTutorialProps): React.JSX.Element {
  const tap = useSharedValue(0);
  useEffect(() => {
    tap.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 380, easing: Easing.in(Easing.quad) }),
        withTiming(0, { duration: 340 }), // brief pause between taps
      ),
      -1,
      false,
    );
  }, [tap]);

  const handStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tap.value, [0, 1], [1, 0.75]),
    transform: [
      { translateX: interpolate(tap.value, [0, 1], [0, -buttonSize * 0.10]) },
      { translateY: interpolate(tap.value, [0, 1], [0, buttonSize * 0.10]) },
    ],
  }));

  const fingerW = Math.round(buttonSize * 1.5);
  const fingerH = Math.round(fingerW * (388 / 546));

  return (
    <>
      {/* Dim + block the board and everything else beneath the HUD buttons */}
      <View style={styles.backdrop} />

      {/* Hand hovering over the Hint button, tapping down onto it */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.handWrap,
          // Centers the hand roughly on the button's bottom-left corner —
          // the fingertip lands there so it reads as tapping that corner.
          { right: buttonRight + buttonSize * 0.25 - 5, top: buttonTop + buttonSize * 0.47 + 20 },
          handStyle,
        ]}
      >
        <Image
          source={HINT_FINGER}
          style={{ width: fingerW, height: fingerH, transform: [{ rotate: '55deg' }] }}
          resizeMode="contain"
        />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,14,10,0.55)',
    zIndex:           9,
  },
  handWrap: {
    position: 'absolute',
    // Above the HUD buttons (SpinnyGamePlayScreen's floatBtn = 10) so the
    // hand visibly taps down ON TOP of the Hint button, not behind it.
    zIndex:   11,
  },
});
