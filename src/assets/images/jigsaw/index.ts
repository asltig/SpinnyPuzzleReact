/** Bundled jigsaw puzzle images — j1 through j8. */
const JIGSAW_IMAGES: Record<string, number> = {
  j1: require('./j1.jpg'),
  j2: require('./j2.jpg'),
  j3: require('./j3.jpg'),
  j4: require('./j4.jpg'),
  j5: require('./j5.jpg'),
  j6: require('./j6.jpg'),
  j7: require('./j7.jpg'),
  j8: require('./j8.jpg'),
};

export function getJigsawImage(name: string): number | undefined {
  return JIGSAW_IMAGES[name];
}