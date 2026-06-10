/**
 * colorUtils.ts
 * Hex parsing and color manipulation.
 * Original: UIColor+Tools category
 */

/**
 * Parse a 6-digit or 8-digit hex string (#RRGGBB or #RRGGBBAA) into RGBA components.
 * Returns null if the string is not a valid hex color.
 */
export function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6 && clean.length !== 8) return null;

  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const a = clean.length === 8 ? parseInt(clean.slice(6, 8), 16) / 255 : 1;

  if ([r, g, b].some(isNaN)) return null;
  return { r, g, b, a };
}

/**
 * Build a CSS-style rgba() string from a hex color + optional alpha override.
 */
export function hexToRgbaString(hex: string, alpha = 1): string {
  const rgba = hexToRgba(hex);
  if (!rgba) return hex;
  return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${alpha * rgba.a})`;
}

/**
 * Parse the original's circleRangeColors JSON string (stored as a string in Core Data).
 * Original: [package.circleRangeColors objectFromString] — NSArray from JSON string
 */
export function parseCircleColors(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(x => typeof x === 'string')) {
      return parsed as string[];
    }
    return [];
  } catch {
    return [];
  }
}
