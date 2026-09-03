// AUTO-GENERATED — do not edit manually.
// Source of truth: src/data/levels.json
// Regenerate:      node scripts/generateImageIndex.js
//
// Metro requires all require() calls to be static strings known at bundle
// time. This file is generated from levels.json so the filenames live in
// one place only.

import type { ImageSourcePropType } from 'react-native';

const colorImages: Record<string, number> = {
  'dog.png':   require('./dog.png'),
  'cow.png':   require('./cow.png'),
  'horse.png': require('./horse.png'),
};

/** Return the bundled full-colour image for a level (level.colorImage, e.g. "dog.png"). */
export function getColorImage(filename: string | null): number | null {
  if (filename === null) return null;
  return colorImages[filename] ?? null;
}

/** All bundled colour image sources — used for cache pre-warming. */
export function getAllColorImages(): number[] {
  return Object.values(colorImages);
}

const layerImages: Record<string, ImageSourcePropType> = {
  'dog_layer.png':   require('./dog_layer.png'),
  'cow_layer.png':   require('./cow_layer.png'),
  'horse_layer.png': require('./horse_layer.png'),
};

/** Return the bundled layer image for a level (level.layerImage, e.g. "dog_layer.png"). */
export function getLayerImage(filename: string | null): ImageSourcePropType | null {
  if (filename === null) return null;
  return layerImages[filename] ?? null;
}
