/**
 * gameColors.ts
 * Single source of truth for each game's levels-map background color.
 * Every *LevelsScreen imports its background from here, and
 * ChooseGameTypeScreen's circular-reveal transition uses the same map —
 * so the reveal animation can never drift out of sync with the screen it
 * reveals into.
 */
export const LEVELS_BG_COLOR = {
  spinny:    '#392b38',
  jigsaw:    '#2e1f3d',
  patchwork: '#2e1f3d',
  memory:    '#5cba6f',
  onet:      '#e0698a',
} as const;

export type GameKey = keyof typeof LEVELS_BG_COLOR;
