import React, { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { registerRevealHandlers } from '../utils/circularReveal';

/**
 * Full-screen circular reveal overlay matching iOS BIZCircularTransitionHandler.
 * Expand: circle grows from card center outward, covering the screen before
 * navigation fires. Contract: circle shrinks back to reveal ChooseGameType.
 * Rendered above NavigationContainer (zIndex 9999) with pointerEvents="none".
 */
export function CircularRevealOverlay() {
  const { width: W, height: H } = useWindowDimensions();
  const maxRadius = Math.ceil(Math.sqrt(W * W + H * H));

  const cx      = useSharedValue(W / 2);
  const cy      = useSharedValue(H / 2);
  const radius  = useSharedValue(0);
  const opacity = useSharedValue(0);
  const bgColor = useSharedValue('#392635');

  useEffect(() => {
    registerRevealHandlers(
      // expand — circle grows from card, then navigate, then fade out
      (newCx, newCy, color, onComplete) => {
        cx.value      = newCx;
        cy.value      = newCy;
        bgColor.value = color;
        radius.value  = 0;
        opacity.value = 1;
        radius.value  = withTiming(maxRadius, {
          duration: 500,
          easing:   Easing.out(Easing.cubic),
        }, (finished) => {
          if (finished) {
            runOnJS(onComplete)();
            // Hold while the destination screen's initial rows render on the JS
            // thread, then fade. SectionList with initialNumToRender=6 keeps this
            // fast; 250ms is enough on any device to render the first visible rows.
            opacity.value = withDelay(250, withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) }));
          }
        });
      },
      // contract — appear at full size, navigate fires externally, then shrink to reveal
      (newCx, newCy, color) => {
        cx.value      = newCx;
        cy.value      = newCy;
        bgColor.value = color;
        radius.value  = maxRadius;
        opacity.value = 1;
        radius.value  = withTiming(0, {
          duration: 450,
          easing:   Easing.in(Easing.cubic),
        }, (finished) => {
          if (finished) {
            opacity.value = 0;
          }
        });
      },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxRadius]);

  const circleStyle = useAnimatedStyle(() => ({
    position:        'absolute',
    width:           radius.value * 2,
    height:          radius.value * 2,
    left:            cx.value - radius.value,
    top:             cy.value - radius.value,
    borderRadius:    radius.value,
    backgroundColor: bgColor.value,
    opacity:         opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[circleStyle, { zIndex: 9999 }]}
    />
  );
}