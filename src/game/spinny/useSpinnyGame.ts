/**
 * useSpinnyGame.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * The Spinny game engine hook.
 *
 * Owns all Reanimated shared values (ring angles, solved flags, active ring,
 * game phase). Wires a single Gesture.Pan() that runs 100% on the UI thread
 * for zero-latency ring rotation.
 *
 * Replaces:
 *   CustomControl.m                         — gesture, angle accumulation, snap
 *   OneFingerRotationGestureRecognizer.m    — atan2 math, annular hit zone
 *   SPGamePlayViewController.m              — game phase, ring lifecycle, win
 *
 * Thread model:
 *   UI thread  — all SharedValue reads/writes and gesture math ('worklet' fns)
 *   JS thread  — React state, store calls, sound/haptic (via runOnJS)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useRef } from 'react';
import {
  useSharedValue,
  withTiming,
  runOnJS,
  runOnUI,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import {
  hitTestRings,
  angleDeltaDegrees,
  accumulateAngle,
  isRingSnapped,
  isLevelComplete,
  computeRingDescriptors,
  generateInitialAngles,
} from './spinnyMath';
import {
  SNAP_ANIMATION_MS,
  RING_COUNT,
  HAPTIC_THRESHOLD_DEG,
} from '../../constants/gameConstants';

/** Snap easing — ease-out cubic so the ring decelerates naturally into place. */
const SNAP_EASING = Easing.out(Easing.cubic);
import { IS_TABLET } from '../../utils/deviceUtils';
import { soundService } from '../../services/audio/soundService';
import type { RingDescriptor, GamePhase } from './types';

// ─────────────────────────────────────────────
// Hook inputs / outputs
// ─────────────────────────────────────────────

interface UseSpinnyGameInput {
  /** Full width/height of the square board view in logical pixels. */
  boardSize: number;
  /** Number of concentric rings for this level. Defaults to RING_COUNT (4).
   *  The engine always allocates 4 shared values internally (hooks can't be
   *  called conditionally); a smaller count simply uses a leading subset. */
  ringCount?: number;
  /** Called when all rings solve (win condition). */
  onLevelComplete: () => void;
  /** Called when a single ring snaps into place. */
  onRingSnapped?: (ringIndex: number) => void;
}

export interface UseSpinnyGameReturn {
  ringAngles:      SharedValue<number>[];
  ringSolved:      SharedValue<boolean>[];
  activeRingIndex: SharedValue<number>;
  gamePhase:       SharedValue<GamePhase>;
  ringDescriptors: RingDescriptor[];
  panGesture:      ReturnType<typeof Gesture.Pan>;
  snapNextRing:    () => void;
  resetLevel:      () => void;
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useSpinnyGame({
  boardSize,
  ringCount = RING_COUNT,
  onLevelComplete,
  onRingSnapped,
}: UseSpinnyGameInput): UseSpinnyGameReturn {

  // ── Static ring geometry ──────────────────────────────────────────────────
  const ringDescriptors: RingDescriptor[] = computeRingDescriptors(
    boardSize,
    ringCount,
    IS_TABLET,
  );
  const boardCenter = boardSize / 2;

  // ── SharedValues — explicitly declared (avoids hooks-in-loops) ────────────
  // All rings start at random angles in [30, 330] — none pre-solved.
  // Always generate RING_COUNT angles (4 shared values are always allocated
  // below); a smaller ringCount just leaves the trailing ones unused.
  const [ia0, ia1, ia2, ia3] = generateInitialAngles(RING_COUNT);

  const angle0 = useSharedValue<number>(ia0 ?? 180);
  const angle1 = useSharedValue<number>(ia1 ?? 90);
  const angle2 = useSharedValue<number>(ia2 ?? 270);
  const angle3 = useSharedValue<number>(ia3 ?? 135);
  const ringAngles = [angle0, angle1, angle2, angle3] as SharedValue<number>[];

  const solved0 = useSharedValue<boolean>(false);
  const solved1 = useSharedValue<boolean>(false);
  const solved2 = useSharedValue<boolean>(false);
  const solved3 = useSharedValue<boolean>(false);
  const ringSolved = [solved0, solved1, solved2, solved3] as SharedValue<boolean>[];

  const activeRingIndex = useSharedValue<number>(0); // outermost ring selected by default
  const angleAtTouchDown = useSharedValue<number>(0);

  // Track previous touch position for incremental delta — RNGH Pan does NOT
  // expose changeX/changeY, so we maintain prev coords ourselves on the UI thread.
  const prevTouchX = useSharedValue<number>(0);
  const prevTouchY = useSharedValue<number>(0);

  // Degrees rotated since the last haptic tick — accumulated across frames so
  // slow drags still tick regularly (a single frame's delta is usually well
  // under HAPTIC_THRESHOLD_DEG). Gives the ring a soft, ratchet-like buzz.
  const hapticAccum = useSharedValue<number>(0);


  // Start immediately in 'playing' — entry animation added in Step 13.
  // Original: implicit "ready" state after createCircles finishes.
  const gamePhase = useSharedValue<GamePhase>('playing');

  // ── JS-thread callbacks (called from worklets via runOnJS) ────────────────

  // Throttled so a fast flick (many ticks queued in quick succession) blends
  // into one continuous soft buzz instead of spamming the haptic engine.
  const lastHapticTimeRef = useRef(0);
  const triggerLightHaptic = useCallback(() => {
    const now = Date.now();
    if (now - lastHapticTimeRef.current < 60) return;
    lastHapticTimeRef.current = now;
    ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true });
  }, []);

  const lastTickTimeRef = useRef(0);
  const playRotationTick = useCallback(() => {
    const now = Date.now();
    if (now - lastTickTimeRef.current < 150) return;
    lastTickTimeRef.current = now;
    soundService.play('button_click');
  }, []);

  // Cuts off the tick sound the instant the finger lifts. Without this, a
  // fast spin's last queued tick plays out its full natural duration after
  // rotation has already stopped, sounding like it "keeps going".
  const stopRotationTick = useCallback(() => {
    soundService.stop('button_click');
  }, []);

  const triggerSuccessHaptic = useCallback(() => {
    ReactNativeHapticFeedback.trigger('notificationSuccess', { enableVibrateFallback: true });
  }, []);

  // One strong pulse whenever the active ring actually changes (manual
  // re-select or auto-advance to the next unsolved ring after a snap).
  const triggerRingSelectHaptic = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactHeavy', { enableVibrateFallback: true });
  }, []);

  const playSnapSound = useCallback(() => {
    soundService.play('ring_snap');
  }, []);

  const handleRingSnappedJS = useCallback(
    (ringIndex: number) => {
      triggerSuccessHaptic();
      playSnapSound();
      onRingSnapped?.(ringIndex);
    },
    [triggerSuccessHaptic, playSnapSound, onRingSnapped],
  );

  const handleLevelCompleteJS = useCallback(() => {
    (onLevelComplete() as Promise<void> | void)?.catch?.(console.error);
  }, [onLevelComplete]);

  // Changes the active ring, firing the strong "new ring" haptic only when
  // the selection actually moves to a different ring — not on re-grabbing
  // the ring that's already selected.
  const selectRing = (index: number) => {
    'worklet';
    if (activeRingIndex.value !== index) {
      runOnJS(triggerRingSelectHaptic)();
    }
    activeRingIndex.value = index;
  };

  // ── Pan Gesture — single gesture covers the whole board ───────────────────
  //
  // onBegin  → annular hit test → select active ring
  // onUpdate → atan2 angle delta → accumulate into ringAngles SharedValue
  // onEnd    → snap check → win check
  // onFinalize → clean up if gesture is cancelled
  //
  // All callbacks execute as worklets on the UI thread (zero bridge crossings).

  const panGesture = Gesture.Pan()
    .minDistance(0)

    .onBegin((e) => {
      'worklet';
      if (gamePhase.value !== 'playing') return;

      const solvedFlags = [
        solved0.value,
        solved1.value,
        solved2.value,
        solved3.value,
      ];

      // Any unsolved ring can be selected — annular hit test.
      const hit = hitTestRings(
        e.x, e.y,
        boardCenter, boardCenter,
        ringDescriptors,
        solvedFlags,
      );

      if (hit.ringIndex === -1) return;

      selectRing(hit.ringIndex);
      angleAtTouchDown.value = ringAngles[hit.ringIndex]!.value;
      prevTouchX.value       = e.x;
      prevTouchY.value       = e.y;
      hapticAccum.value      = 0;
      gamePhase.value        = 'rotating';
    })

    .onUpdate((e) => {
      'worklet';
      const idx = activeRingIndex.value;
      if (idx === -1 || gamePhase.value !== 'rotating') return;

      // Compute incremental angle delta using the atan2 math from ObjC
      // OneFingerRotationGestureRecognizer. RNGH Pan has no changeX/changeY,
      // so we track the previous touch position ourselves (prevTouchX/Y SharedValues).
      const prevX = prevTouchX.value;
      const prevY = prevTouchY.value;

      const delta = angleDeltaDegrees(
        prevX, prevY,
        e.x,   e.y,
        boardCenter, boardCenter,
      );

      // Update stored position for next frame
      prevTouchX.value = e.x;
      prevTouchY.value = e.y;

      const ring = ringAngles[idx]!;
      ring.value = accumulateAngle(ring.value, delta);

      // Soft vibration while spinning — tick every HAPTIC_THRESHOLD_DEG of
      // travel accumulated across frames (not per-frame delta, which is
      // almost always smaller than the threshold at normal drag speeds).
      // Keeping the remainder instead of resetting to 0 keeps ticks evenly
      // spaced regardless of how much each frame's delta overshoots it.
      hapticAccum.value += Math.abs(delta);
      if (hapticAccum.value >= HAPTIC_THRESHOLD_DEG) {
        hapticAccum.value -= HAPTIC_THRESHOLD_DEG;
        runOnJS(triggerLightHaptic)();
        runOnJS(playRotationTick)();
      }
    })

    .onEnd(() => {
      'worklet';

      // Guard: only process snap logic when a ring is actually being dragged.
      if (gamePhase.value !== 'rotating') {
        if (gamePhase.value !== 'completed') gamePhase.value = 'playing';
        return;
      }

      const idx = activeRingIndex.value;
      const currentAngle = ringAngles[idx]!.value;

      // ── Snap check ───────────────────────────────────────────────────────
      if (isRingSnapped(currentAngle)) {
        const snapTarget = Math.round(currentAngle / 360) * 360;
        ringAngles[idx]!.value = withTiming(snapTarget, {
          duration: SNAP_ANIMATION_MS,
          easing:   SNAP_EASING,
        });
        ringSolved[idx]!.value = true;
        runOnJS(handleRingSnappedJS)(idx);

        // ── Win check ────────────────────────────────────────────────────
        // Only the first `ringCount` flags are real for this level — the
        // rest stay permanently false and must not block the win condition.
        const allSolved = isLevelComplete(
          [solved0.value, solved1.value, solved2.value, solved3.value].slice(0, ringCount),
        );

        if (allSolved) {
          gamePhase.value = 'completed';
          runOnJS(handleLevelCompleteJS)();
        } else {
          gamePhase.value = 'playing';
          // Auto-select the next unsolved ring (outermost first).
          if      (!solved0.value) { selectRing(0); }
          else if (!solved1.value) { selectRing(1); }
          else if (!solved2.value) { selectRing(2); }
          else if (!solved3.value) { selectRing(3); }
        }
      } else {
        // Ring not snapped — keep it selected so the player can retry.
        gamePhase.value = 'playing';
      }
      // activeRingIndex is NOT reset to -1; selection persists between gestures.
    })

    .onFinalize(() => {
      'worklet';
      if (gamePhase.value === 'rotating') {
        gamePhase.value = 'playing';
        // Selection (activeRingIndex) persists — ring stays highlighted for retry.
      }
      runOnJS(stopRotationTick)();
      prevTouchX.value = 0;
      prevTouchY.value = 0;
    });

  // ── Hint: snap the next unsolved ring to 0° ───────────────────────────────
  // Scans outermost-first so hints always clear rings from the outside in.
  const snapNextRing = useCallback(() => {
    // Snap the first unsolved ring (outermost-first scan).
    for (let i = 0; i < ringCount; i++) {
      if (!ringSolved[i]!.value) {
        const hintTarget = Math.round(ringAngles[i]!.value / 360) * 360;
        ringAngles[i]!.value = withTiming(hintTarget, {
          duration: SNAP_ANIMATION_MS,
          easing:   SNAP_EASING,
        });

        runOnUI(() => {
          'worklet';
          ringSolved[i]!.value = true;

          const allSolved = isLevelComplete(
            [solved0.value, solved1.value, solved2.value, solved3.value].slice(0, ringCount),
          );
          if (allSolved) {
            gamePhase.value = 'completed';
            runOnJS(handleLevelCompleteJS)();
          } else {
            // Auto-select next unsolved ring after hint snap.
            if      (!solved0.value) { selectRing(0); }
            else if (!solved1.value) { selectRing(1); }
            else if (!solved2.value) { selectRing(2); }
            else if (!solved3.value) { selectRing(3); }
          }
        })();

        handleRingSnappedJS(i);
        return;
      }
    }
  }, [
    ringAngles, ringSolved, gamePhase, ringCount,
    solved0, solved1, solved2, solved3,
    handleRingSnappedJS, handleLevelCompleteJS,
  ]);

  // ── Reset — randomise all 4 ring angles ──────────────────────────────────
  const resetLevel = useCallback(() => {
    const next = generateInitialAngles(RING_COUNT);
    angle0.value = next[0] ?? 180;
    angle1.value = next[1] ?? 90;
    angle2.value = next[2] ?? 270;
    angle3.value = next[3] ?? 135;

    runOnUI(() => {
      'worklet';
      solved0.value         = false;
      solved1.value         = false;
      solved2.value         = false;
      solved3.value         = false;
      activeRingIndex.value = 0; // outermost ring selected again after reset
      gamePhase.value       = 'playing';
    })();
  }, [
    angle0, angle1, angle2, angle3,
    solved0, solved1, solved2, solved3,
    activeRingIndex, gamePhase,
  ]);

  return {
    ringAngles,
    ringSolved,
    activeRingIndex,
    gamePhase,
    ringDescriptors,
    panGesture,
    snapNextRing,
    resetLevel,
  };
}
