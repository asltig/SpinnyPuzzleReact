/**
 * JigsawSnapEffect.tsx
 * Star particle burst when a jigsaw piece snaps into its slot.
 *
 * Mirrors ObjC EmitterLayerAnimation.createSquareAnimationWithFrame:OnView:imageName:emiterSize:
 *   • Particles spawn on/around the piece bounding-box perimeter
 *     (kCAEmitterLayerOutline + kCAEmitterLayerRectangle)
 *   • Burst radially outward then fade (ObjC: velocity=positive → outward)
 *   • lifetime ~0.85 s, alphaSpeed = −1 (fully transparent at end)
 *   • star image, four colours, spin ±180°
 *
 * Usage: mount once per snap event; force-remount with a unique `key` to replay.
 */

import React, { useEffect, useMemo } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';

const STAR_IMG    = require('../../assets/images/star.png');
const STAR_SIZE   = 14;
const LIFETIME_MS = 820;
const COLORS      = ['#FFD44F', '#5DDAC9', '#FF6B9D', '#e6ffe6', '#ffe6ff'];
const COUNT       = 22;

interface Particle {
  spawnX:  number;   // absolute screen position
  spawnY:  number;
  angle:   number;   // outward drift direction
  speed:   number;   // drift distance over lifetime
  color:   string;
  spin:    number;   // degrees
  anim:    Animated.Value;
}

interface Props {
  /** Center of the snapped piece in screen-absolute coordinates. */
  centerX: number;
  centerY: number;
  /** Base piece width (without tab overhang). */
  pieceW:  number;
  /** Base piece height (without tab overhang). */
  pieceH:  number;
}

export function JigsawSnapEffect({ centerX, centerY, pieceW, pieceH }: Props): React.JSX.Element {
  const hw = pieceW / 2;
  const hh = pieceH / 2;

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: COUNT }, (_, i) => {
      // Spawn on the piece perimeter (4 edges equally)
      const edge = i % 4;
      let spawnX: number;
      let spawnY: number;

      if (edge === 0) {          // top edge
        spawnX = centerX + (Math.random() * 2 - 1) * hw;
        spawnY = centerY - hh;
      } else if (edge === 1) {   // right edge
        spawnX = centerX + hw;
        spawnY = centerY + (Math.random() * 2 - 1) * hh;
      } else if (edge === 2) {   // bottom edge
        spawnX = centerX + (Math.random() * 2 - 1) * hw;
        spawnY = centerY + hh;
      } else {                   // left edge
        spawnX = centerX - hw;
        spawnY = centerY + (Math.random() * 2 - 1) * hh;
      }

      // Drift outward from center
      const dx    = spawnX - centerX;
      const dy    = spawnY - centerY;
      const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.6; // slight scatter
      const speed = 20 + Math.random() * 30;

      return {
        spawnX,
        spawnY,
        angle,
        speed,
        color:   COLORS[i % COLORS.length]!,
        spin:    i % 2 === 0 ? 180 : -180,
        anim:    new Animated.Value(0),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Animated.parallel(
      particles.map((p) =>
        Animated.timing(p.anim, { toValue: 1, duration: LIFETIME_MS, useNativeDriver: true }),
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
            ss.particle,
            {
              left: p.spawnX - STAR_SIZE / 2,
              top:  p.spawnY - STAR_SIZE / 2,
            },
            {
              opacity: p.anim.interpolate({
                inputRange:  [0, 0.12, 0.75, 1],
                outputRange: [0, 1,    0.7,  0],
              }),
              transform: [
                {
                  translateX: p.anim.interpolate({
                    inputRange:  [0, 1],
                    outputRange: [0, Math.cos(p.angle) * p.speed],
                  }),
                },
                {
                  translateY: p.anim.interpolate({
                    inputRange:  [0, 1],
                    outputRange: [0, Math.sin(p.angle) * p.speed],
                  }),
                },
                {
                  rotate: p.anim.interpolate({
                    inputRange:  [0, 1],
                    outputRange: ['0deg', `${p.spin}deg`],
                  }),
                },
                {
                  scale: p.anim.interpolate({
                    inputRange:  [0, 0.18, 1],
                    outputRange: [0.3, 1.4, 0.4],
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

const ss = StyleSheet.create({
  particle: { position: 'absolute' },
});