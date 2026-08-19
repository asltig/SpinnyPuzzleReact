#!/usr/bin/env node
/**
 * Reads levels.json and generates src/assets/images/levels/index.ts.
 *
 * All color_image / layer_image filenames in levels.json become static
 * require() calls in the generated file. Metro needs static strings —
 * dynamic require() is not supported — so this generator bridges the gap.
 *
 * Usage:  node scripts/generateImageIndex.js
 *         npm run generate:images
 *
 * Run after adding a new image filename to levels.json.
 */

const fs   = require('fs');
const path = require('path');

const LEVELS_JSON = path.resolve(__dirname, '../src/data/levels.json');
const OUT_FILE    = path.resolve(__dirname, '../src/assets/images/levels/index.ts');

const data = JSON.parse(fs.readFileSync(LEVELS_JSON, 'utf8'));

// Collect unique filenames from levels.json, preserving insertion order
const colorFiles = [];
const layerFiles = [];
const seenColor  = new Set();
const seenLayer  = new Set();

for (const level of data.levels) {
  if (level.color_image && !seenColor.has(level.color_image)) {
    seenColor.add(level.color_image);
    colorFiles.push(level.color_image);
  }
  if (level.layer_image && !seenLayer.has(level.layer_image)) {
    seenLayer.add(level.layer_image);
    layerFiles.push(level.layer_image);
  }
}

// Pad all keys to the same length for alignment
function buildEntries(files) {
  const maxLen = Math.max(...files.map(f => f.length));
  return files
    .map(f => `  '${f}':${' '.repeat(maxLen - f.length)} require('./${f}'),`)
    .join('\n');
}

const colorEntries = buildEntries(colorFiles);
const layerEntries = buildEntries(layerFiles);

const output = `\
// AUTO-GENERATED — do not edit manually.
// Source of truth: src/data/levels.json
// Regenerate:      node scripts/generateImageIndex.js
//
// Metro requires all require() calls to be static strings known at bundle
// time. This file is generated from levels.json so the filenames live in
// one place only.

import type { ImageSourcePropType } from 'react-native';

const colorImages: Record<string, number> = {
${colorEntries}
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
${layerEntries}
};

/** Return the bundled layer image for a level (level.layerImage, e.g. "dog_layer.png"). */
export function getLayerImage(filename: string | null): ImageSourcePropType | null {
  if (filename === null) return null;
  return layerImages[filename] ?? null;
}
`;

fs.writeFileSync(OUT_FILE, output, 'utf8');
console.log(`✓ Generated index.ts — ${colorFiles.length} color, ${layerFiles.length} layer images`);
