/**
 * SnapStarEffect.tsx
 * Star particle burst when a ring snaps into the correct position.
 *
 * ─── Matches ObjC EmitterLayerAnimation.createCircleAnimationWithFrame: ───────
 *   • Particles spawn on the ring's circumference (kCAEmitterLayerOutline + circle)
 *   • velocity = −20 → stars drift INWARD toward board center
 *   • lifetime = 1 s, alphaSpeed = −1 → fully fades out in 1 s
 *   • Three colours: #e6ffe6 (light green), #ffe6ff (pink), #66ff99 (bright green)
 *   • Particle count ≈ 5 × tag × 4 emitters / 3 cells ≈ 6 × tag
 *     (tag = RING_COUNT − ringIndex, i.e. 4 for outermost, 1 for innermost)
 *   • Stars rotate ±180° during flight (spin = ±π)
 *   • Star image: icons8-christmas-star-filled-50.png, rendered at 12 pt
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';
import type { RingDescriptor } from '../../game/spinny/types';

// ─── Constants (from ObjC EmitterLayerAnimation) ──────────────────────────────
const STAR_IMG        = require('../../assets/images/star.png');
const STAR_SIZE       = 12;                           // ~0.2 × 50pt source image
const LIFETIME_MS     = 900;                          // ObjC lifetime = 1.0 (slightly shorter for snappiness)
const INWARD_DRIFT    = 20;                           // ObjC velocity = −20
const COLORS          = ['#e6ffe6', '#ffe6ff', '#66ff99'];
const RING_COUNT      = 4;

// ─────────────────────────────────────────────────────────────────────────────

interface Particle {
  x:       number;
  y:       number;
  angle:   number;
  drift:   number;   // inward travel distance — varies per star
  color:   string;
  spinDeg: number;
  anim:    Animated.Value;
}

interface Props {
  /** Ring geometry — used to calculate circumference spawn radius. */
  descriptor: RingDescriptor;
  /** Board side length in px — center = boardSize / 2. */
  boardSize:  number;
  /** 0 = outermost, RING_COUNT−1 = innermost. Affects particle count. */
  ringIndex:  number;
}

/**
 * Mounts, plays the burst animation once, then becomes inert.
 * Force-remount with a changing `key` prop to replay for each snap event.
 */
export function SnapStarEffect({ descriptor, boardSize, ringIndex }: Props): React.JSX.Element {
  const center = boardSize / 2;

  // ObjC: emitterSize = CGSizeMake(ringDiameter + 20, ringDiameter + 20)
  // kCAEmitterLayerOutline → particles on the circle edge at radius = emitterSize/2
  const emitterRadius = descriptor.outerRadius + 10;

  // ObjC: birthRate = 5 * tag, where tag = RING_COUNT - ringIndex (4=outer, 1=inner)
  const tag   = RING_COUNT - ringIndex;
  const count = Math.max(6, tag * 6);

  const particles = useMemo<Particle[]>(() =>
    Array.from({ length: count }, (_, i) => {
      // Fully random angle — no even distribution so clumps are natural
      const angle = Math.random() * 2 * Math.PI;

      // Spread radially across the whole ring band plus a small outer margin.
      // innerRadius → outerRadius + 15 gives the "across the ring" scatter.
      const minR = Math.max(0, descriptor.innerRadius - 5);
      const maxR = descriptor.outerRadius + 15;
      const r    = minR + Math.random() * (maxR - minR);

      return {
        x:       center + r * Math.cos(angle),
        y:       center + r * Math.sin(angle),
        angle,
        // Random inward drift: ObjC velocity = −20 ± velocityRange(10)
        drift:   12 + Math.random() * 18,
        color:   COLORS[i % COLORS.length]!,
        spinDeg: i % 3 === 0 ? 180 : i % 3 === 1 ? -180 : 0,
        anim:    new Animated.Value(0),
      };
    }),
    // Intentionally [] — particles are fixed at mount; key prop recreates per snap
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Start all particles simultaneously on mount (ObjC: stopDelay = 0.05s burst)
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    Animated.parallel(
      particles.map((p) =>
        Animated.timing(p.anim, {
          toValue:         1,
          duration:        LIFETIME_MS,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.particle,
            {
              left: p.x - STAR_SIZE / 2,
              top:  p.y - STAR_SIZE / 2,
            },
            {
              // ObjC alphaSpeed = −1 → fully transparent by lifetime end
              opacity: p.anim.interpolate({
                inputRange:  [0, 0.15, 0.85, 1],
                outputRange: [0, 1,    0.6,  0],
              }),
              transform: [
                // Drift inward — ObjC velocity = −20 ± velocityRange(10)
                {
                  translateX: p.anim.interpolate({
                    inputRange:  [0, 1],
                    outputRange: [0, -p.drift * Math.cos(p.angle)],
                  }),
                },
                {
                  translateY: p.anim.interpolate({
                    inputRange:  [0, 1],
                    outputRange: [0, -p.drift * Math.sin(p.angle)],
                  }),
                },
                // ObjC: spin = ±M_PI (180° per lifetime)
                {
                  rotate: p.anim.interpolate({
                    inputRange:  [0, 1],
                    outputRange: ['0deg', `${p.spinDeg}deg`],
                  }),
                },
                // Slight scale pulse — springs up then shrinks (ObjC scaleRange = 0.2)
                {
                  scale: p.anim.interpolate({
                    inputRange:  [0, 0.2, 1],
                    outputRange: [0.4, 1.3, 0.5],
                  }),
                },
              ],
            },
          ]}
        >
          <Image
            source={STAR_IMG}
            style={{ width: STAR_SIZE, height: STAR_SIZE, tintColor: p.color }}
            resizeMode="contain"
          />
        </Animated.View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
  },
});
