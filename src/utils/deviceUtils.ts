/**
 * deviceUtils.ts
 * Device detection helpers.
 * Original: UIDevice+Tools category + IS_IPAD / IS_iPhone_X macros in Common.h
 */
import { Dimensions, Platform, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** True if the device is a tablet.
 *  Original: IS_IPAD macro — (UI_USER_INTERFACE_IDIOM() == UIUserInterfaceIdiomPad) */
export const IS_TABLET: boolean =
  Platform.OS === 'ios'
    ? Platform.isPad
    : SCREEN_WIDTH >= 600;

/** Logical screen width (points, not pixels). */
export const SCREEN_W = SCREEN_WIDTH;

/** Logical screen height (points, not pixels). */
export const SCREEN_H = SCREEN_HEIGHT;

/** Device pixel ratio. */
export const PIXEL_RATIO = PixelRatio.get();

/**
 * Scale a value by the screen's width relative to a 375-point baseline (iPhone SE 2).
 * Approximates the original's deviceScale calculations.
 */
export function scale(size: number): number {
  return (SCREEN_WIDTH / 375) * size;
}

/**
 * Scale a value by the screen's height relative to a 667-point baseline.
 */
export function verticalScale(size: number): number {
  return (SCREEN_HEIGHT / 667) * size;
}

/**
 * Moderate scale — mix of width scale and fixed size, to avoid over-scaling on iPads.
 * factor controls how aggressively to scale (0 = no scale, 1 = full scale).
 */
export function moderateScale(size: number, factor = 0.5): number {
  return size + (scale(size) - size) * factor;
}
