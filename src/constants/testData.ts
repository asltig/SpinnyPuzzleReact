/**
 * testData.ts
 * Hard-coded level + package data used while the database layer is not yet
 * seeded (Steps 1–7). Remove / replace with real DB queries in Step 3.
 *
 * Provides 3 Tutorial levels so navigation (next-level chaining in
 * LevelCompleteScreen) works end-to-end without touching WatermelonDB.
 */

import type { Level, Package, PackageWithLevels } from '../types/models';

// ─── Package ───────────────────────────────────────────────────────────────

export const TEST_PACKAGE: Package = {
  id:                  'tutorial',
  name:                'Tutorial',
  backgroundColorDark:  '#0f0f23',
  backgroundColorLight: '#1a1a4e',
  // Four purple shades, outermost ring first
  circleColor:          '#7c3aed',
  circleRangeColors:    JSON.stringify(['#6d28d9', '#7c3aed', '#9333ea', '#a855f7']),
  touchedLayerColor:    '#c4b5fd',
  isPurchased:          true,
  textColor:            '#F9D84E',
  nextButtonImage:      'btnNextFarm',
};

// ─── Levels ───────────────────────────────────────────────────────────────

const makeLevel = (index: number): Level => ({
  id:              `tutorial_${index}`,
  name:            `Level ${index}`,
  packageName:     'Tutorial',
  imgUrl:          '',
  imgPath:         '',
  order:           index - 1,
  imageDownloaded: false,
  levelCompleted:  false,
  isInitialData:   true,
  colorImage:      null,
  layerImage:      null,
  descrip:         '',
  titleColor:      '#3d2b0a',
});

export const TEST_LEVELS: Level[] = [
  makeLevel(1),
  makeLevel(2),
  makeLevel(3),
];

// ─── Combined ─────────────────────────────────────────────────────────────

export const TEST_PACKAGE_WITH_LEVELS: PackageWithLevels = {
  package: TEST_PACKAGE,
  levels:  TEST_LEVELS,
};
