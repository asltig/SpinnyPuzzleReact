import React, { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { registerRevealHandlers, markRevealAnimationDone } from '../utils/circularReveal';

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
      // expand — navigate fires immediately so the destination screen has the full
      // animation duration (~500ms) to render. The overlay only fades once BOTH
      // the animation is done AND the destination screen signals its first layout
      // (via markRevealScreenReady called from onLayout on the root view).
      (newCx, newCy, color, onNavigate) => {
        cx.value      = newCx;
        cy.value      = newCy;
        bgColor.value = color;
        radius.value  = 0;
        opacity.value = 1;
        // Navigate at ~50ms — by then the circle has enough radius to obscure the
        // source card; the destination screen mounts behind the expanding overlay.
        setTimeout(onNavigate, 50);
        radius.value  = withTiming(maxRadius, {
          duration: 500,
          easing:   Easing.out(Easing.cubic),
        }, (finished) => {
          if (finished) {
            // Signal animation done; dismiss fires only once screen is also ready.
            runOnJS(markRevealAnimationDone)();
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
      // dismiss — destination screen is mounted and ready; fade out the overlay
      () => {
        opacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) });
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