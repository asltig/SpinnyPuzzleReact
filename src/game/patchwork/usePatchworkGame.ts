/**
 * usePatchworkGame.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Game-engine hook for the Patchwork tile-placement puzzle mode.
 *
 * ─── Scope (easy 2×2 only) ───────────────────────────────────────────────────
 *   Hard-wired for 4 tiles (2 cols × 2 rows). Extending to medium (3×3 = 9)
 *   or hard (4×4 = 16) requires adding explicit SharedValue declarations for
 *   each additional tile. hooks-in-loops is prohibited by React's rules — every
 *   tile gets its own named set of SharedValues.
 *
 * ─── Thread model ─────────────────────────────────────────────────────────────
 *   UI thread  — all SharedValue reads/writes, animations (withTiming/withSpring)
 *   JS thread  — haptics, callbacks (runOnJS), console logs (via runOnJS)
 *
 *   The Reanimated UI thread is serial. All SharedValue mutations within
 *   worklets are sequentially consistent — no concurrent-write races are
 *   possible even with two fingers on two tiles simultaneously.
 *
 * ─── Key difference from Jigsaw ───────────────────────────────────────────────
 *   Jigsaw uses pixel-proximity snap (continuous distance tolerance).
 *   Patchwork uses cell-based snap (discrete grid membership):
 *     isNearTarget: true while drag is over the correct grid cell
 *     onEnd snap:   pixelToGridCell determines the drop cell; if it matches
 *                   tile.target, snap to cellToPixelFrame destination.
 *     No-snap:      tile springs BACK to startX/startY (its position before
 *                   the drag began), not left at the release point.
 *
 * ─── Gesture lifecycle guarantee (enforced by assertTileClean) ───────────────
 *   Every gesture path through onBegin → … → onFinalize must leave:
 *     isActive          === false
 *     isNearTarget      === false
 *     hasTargetPosition === isPlaced  (logical consistency, no numeric check)
 *     scale             → 1.0        (spring started; may still be in-flight)
 *     posX / posY       → targetFrame (snapped) or startX/Y (not snapped)
 *
 *   The four paths and their final states:
 *
 *   ① Normal drag, no snap
 *       onBegin    isActive=T  scale→LIFT  startX/Y snapshot
 *       onUpdate   posX/Y tracking; isNearTarget reflects cell membership
 *       onEnd      isActive=F  isNearTarget=F  isPlaced=F  hasTargetPosition=F
 *                  (no animation started — onFinalize fires immediately after
 *                   and is the authoritative cleanup owner for the non-snap path)
 *       onFinalize isActive=F (noop)  isNearTarget=F (noop)
 *                  !isPlaced → scale→withSequence(dip,1.0)  posX/Y→originX/Y
 *       → CLEAN ✓
 *
 *   ② Normal drag, snap
 *       onBegin    isActive=T  scale→LIFT  startX/Y snapshot
 *       onUpdate   posX/Y tracking; isNearTarget=T over correct cell
 *       onEnd      isActive=F  isNearTarget=F  posX/Y→targetFrame (withTiming)
 *                  hasTargetPosition=T  isPlaced=T  scale→1.0
 *       onFinalize isActive=F (noop)  isNearTarget=F (noop)
 *                  isPlaced=T  hasTargetPosition=T → spring guard skips
 *       → CLEAN ✓
 *
 *   ③ Cancelled / interrupted (finger leaves bounds, gesture arena lost)
 *       onBegin    isActive=T  scale→LIFT  startX/Y snapshot
 *       onUpdate   (may or may not fire)
 *       onEnd      does NOT fire for cancelled gestures
 *       onFinalize isActive=F  isNearTarget=F  hasTargetPosition=F
 *                  !isPlaced → posX/Y→startX/Y  scale→1.0
 *       → CLEAN ✓
 *
 *   ④ Touch on already-placed tile
 *       onBegin    isPlaced=T → early return (nothing mutated)
 *       onUpdate   isPlaced=T → early return
 *       onEnd      isActive=F (noop)  isNearTarget=F (noop)  isPlaced=T → return
 *       onFinalize isActive=F (noop)  isNearTarget=F (noop)
 *                  isPlaced=T  hasTargetPosition=T (set on first snap) → skip
 *       → CLEAN ✓
 *
 *   assertTileClean() fires at the tail of every onFinalize. Checks:
 *     isActive / isNearTarget  — must always be false
 *     hasTargetPosition ↔ isPlaced — logical consistency (no numeric check)
 *     scale — warns if still above 1.0 (spring in-flight, informational)
 *   Active only when DEBUG_PATCHWORK=true && __DEV__. Zero cost in production.
 *
 * ─── winFired guard ──────────────────────────────────────────────────────────
 *   winFired is set atomically on the UI thread when the last tile snaps.
 *   Prevents handleCompleteJS from being dispatched more than once.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  useSharedValue,
  withTiming,
  withSpring,
  withSequence,
  runOnJS,
  runOnUI,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import {
  patchworkGridConfigForMode,
  generateTiles,
  pixelToGridCell,
  cellToPixelFrame,
  isTileOverTarget,
} from './patchworkMath';
import type { PatchworkTile, PatchworkGridConfig, Frame } from './types';
import type { GameMode } from '../../types/models';
import {
  DEBUG_PATCHWORK,
  SNAP_ANIMATION_MS,
  DRAG_LIFT_SCALE,
} from '../../constants/gameConstants';

// ─────────────────────────────────────────────
// Animation constants
// ─────────────────────────────────────────────

// SNAP_ANIMATION_MS and DRAG_LIFT_SCALE imported from gameConstants for cross-mode consistency.
const SNAP_EASING  = Easing.out(Easing.cubic);

/** Spring config for the scale pop (lift → 1.0). */
const SCALE_SPRING = { damping: 14, stiffness: 220, mass: 0.8 } as const;

/** Spring config for position spring-back on failed drop. */
const POS_SPRING   = { damping: 18, stiffness: 260, mass: 0.9 } as const;

// ─────────────────────────────────────────────
// Debug logging (plain JS — called via runOnJS from worklets)
// ─────────────────────────────────────────────

function _logTrace(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(`[Patchwork] ${msg}`);
}

function _logError(msg: string): void {
  // eslint-disable-next-line no-console
  console.error(`[Patchwork] ⚠ ${msg}`);
}

// ─────────────────────────────────────────────
// Post-condition assertion worklet
// ─────────────────────────────────────────────

/**
 * assertTileClean — called at the tail of every onFinalize.
 *
 * Invariants:
 *   isActive          must be false  (tile not stuck in "grabbed" state)
 *   isNearTarget      must be false  (highlight not stuck on)
 *
 *   Logical consistency — hasTargetPosition ↔ isPlaced:
 *     isPlaced=T  → hasTargetPosition must be T
 *       snap branch in onEnd sets both atomically; a mismatch here means the
 *       snap branch ran but skipped the flag write — BUG.
 *     isPlaced=F  → hasTargetPosition must be F
 *       flag was never set, or a reset failed to clear it — BUG.
 *
 *   NOTE: numeric posX/posY are intentionally NOT checked. withTiming /
 *   withSpring are in-flight when onFinalize fires; hasTargetPosition proves
 *   that the animation was *started*, not that it has completed.
 *
 *   scale — informational trace only. withSpring(1.0) was called, but
 *   scale.value will still be near LIFT_SCALE immediately after onFinalize.
 *   A value > 1.02 is expected and normal; logged as a trace, not an error.
 */
function assertTileClean(
  idx:               number,
  isActive:          SharedValue<boolean>,
  isNearTarget:      SharedValue<boolean>,
  scale:             SharedValue<number>,
  isPlaced:          SharedValue<boolean>,
  hasTargetPosition: SharedValue<boolean>,
  logTrace:          (msg: string) => void,
  logError:          (msg: string) => void,
): void {
  'worklet';

  let clean = true;

  // ── isActive must always be false after any lifecycle end ─────────────────
  if (isActive.value !== false) {
    runOnJS(logError)(`tile[${idx}] isActive stuck TRUE after gesture — BUG`);
    clean = false;
  }

  // ── isNearTarget must always be false after any lifecycle end ─────────────
  if (isNearTarget.value !== false) {
    runOnJS(logError)(`tile[${idx}] isNearTarget stuck TRUE after gesture — BUG`);
    clean = false;
  }

  // ── Logical consistency: hasTargetPosition ↔ isPlaced ────────────────────
  const placed = isPlaced.value;
  const hasPos = hasTargetPosition.value;

  if (placed && !hasPos) {
    runOnJS(logError)(
      `tile[${idx}] isPlaced=T but hasTargetPosition=F — snap flag never set — BUG`,
    );
    clean = false;
  }
  if (!placed && hasPos) {
    runOnJS(logError)(
      `tile[${idx}] isPlaced=F but hasTargetPosition=T — snap flag leaked — BUG`,
    );
    clean = false;
  }

  // ── scale: spring in-flight is expected — trace only ─────────────────────
  const sv = scale.value;
  if (sv > 1.02) {
    runOnJS(logTrace)(
      `tile[${idx}] scale=${sv.toFixed(3)} (spring in flight → 1.0, expected)`,
    );
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  if (clean) {
    runOnJS(logTrace)(
      `tile[${idx}] post-gesture clean ✓  placed=${placed ? 'T' : 'F'}  hasTargetPos=${hasPos ? 'T' : 'F'}  scale=${sv.toFixed(3)}`,
    );
  }
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface PatchworkTileState {
  descriptor:        PatchworkTile;
  posX:              SharedValue<number>;
  posY:              SharedValue<number>;
  isPlaced:          SharedValue<boolean>;
  isActive:          SharedValue<boolean>;
  scale:             SharedValue<number>;
  isNearTarget:      SharedValue<boolean>;
  /** Set to true atomically with isPlaced in the snap branch of onEnd.
   *  assertTileClean verifies hasTargetPosition === isPlaced after every gesture. */
  hasTargetPosition: SharedValue<boolean>;
  gesture:           ReturnType<typeof Gesture.Pan>;
}

interface UsePatchworkGameInput {
  boardSize:       number;
  mode?:           GameMode;
  onComplete:      () => void;
  onTilePlaced?:   (tileIndex: number) => void;
}

export interface UsePatchworkGameReturn {
  tileStates:   PatchworkTileState[];
  config:       PatchworkGridConfig;
  tileW:        number;
  tileH:        number;
  resetLevel:   () => void;
  /** True while any tile is being dragged — drives ghost previews and tile fades. */
  isAnyActive:  SharedValue<boolean>;
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function usePatchworkGame({
  boardSize,
  mode = 'easy',
  onComplete,
  onTilePlaced,
}: UsePatchworkGameInput): UsePatchworkGameReturn {

  const config: PatchworkGridConfig = useMemo(
    () => patchworkGridConfigForMode(mode),
    [mode],
  );

  const tileW = boardSize / config.cols;
  const tileH = boardSize / config.rows;

  // ── Initial tile set (stable — never replaced mid-session) ───────────────
  const imageKeys = useMemo(
    () => Array.from({ length: config.cols * config.rows }, (_, i) => `tile-${i}`),
    [config.cols, config.rows],
  );

  const boardFrame: Frame = { x: 0, y: 0, width: boardSize, height: boardSize };

  const [tiles] = useState<PatchworkTile[]>(() =>
    generateTiles(imageKeys, boardFrame, config),
  );

  const totalTiles = tiles.length;

  // ── Position SharedValues (board-local pixels) ────────────────────────────
  const px0 = useSharedValue<number>(tiles[0]?.initialFrame.x ?? 0);
  const py0 = useSharedValue<number>(tiles[0]?.initialFrame.y ?? 0);
  const px1 = useSharedValue<number>(tiles[1]?.initialFrame.x ?? tileW);
  const py1 = useSharedValue<number>(tiles[1]?.initialFrame.y ?? 0);
  const px2 = useSharedValue<number>(tiles[2]?.initialFrame.x ?? 0);
  const py2 = useSharedValue<number>(tiles[2]?.initialFrame.y ?? tileH);
  const px3 = useSharedValue<number>(tiles[3]?.initialFrame.x ?? tileW);
  const py3 = useSharedValue<number>(tiles[3]?.initialFrame.y ?? tileH);

  // ── Gesture-start position snapshots ─────────────────────────────────────
  // Stored in onBegin (after center-anchor offset); the translation origin
  // for onUpdate: posX = startX + translationX.
  const sx0 = useSharedValue(0); const sy0 = useSharedValue(0);
  const sx1 = useSharedValue(0); const sy1 = useSharedValue(0);
  const sx2 = useSharedValue(0); const sy2 = useSharedValue(0);
  const sx3 = useSharedValue(0); const sy3 = useSharedValue(0);

  // ── Pre-drag origin snapshots ─────────────────────────────────────────────
  // Captured in onBegin BEFORE the center-anchor offset is applied.
  // Failed drops spring BACK to these — restoring the tile to where it sat
  // before the user picked it up, not to the shifted startX/Y.
  const ox0 = useSharedValue(0); const oy0 = useSharedValue(0);
  const ox1 = useSharedValue(0); const oy1 = useSharedValue(0);
  const ox2 = useSharedValue(0); const oy2 = useSharedValue(0);
  const ox3 = useSharedValue(0); const oy3 = useSharedValue(0);

  // ── Global drag lock ──────────────────────────────────────────────────────
  // Set to true when any tile's onBegin activates; prevents a second finger
  // on a different tile from activating simultaneously. Cleared in the active
  // tile's onFinalize via the wasActivated guard below.
  const isAnyActive = useSharedValue(false);

  // ── Per-tile activation guards ────────────────────────────────────────────
  // wasActivated tracks whether a tile's onBegin actually ran past the guard.
  // onFinalize checks this before releasing the global lock: a gesture on tile
  // B that was blocked (isAnyActive=true) still fires onFinalize, and without
  // this guard it would incorrectly clear the lock while tile A is mid-drag.
  const was0 = useSharedValue(false); const was1 = useSharedValue(false);
  const was2 = useSharedValue(false); const was3 = useSharedValue(false);

  // ── Logical flags ─────────────────────────────────────────────────────────
  const placed0 = useSharedValue(false); const active0 = useSharedValue(false);
  const placed1 = useSharedValue(false); const active1 = useSharedValue(false);
  const placed2 = useSharedValue(false); const active2 = useSharedValue(false);
  const placed3 = useSharedValue(false); const active3 = useSharedValue(false);

  // ── Snap-position flag ────────────────────────────────────────────────────
  // Set atomically with isPlaced in the onEnd snap branch.
  // assertTileClean verifies: hasTargetPosition === isPlaced (always).
  const snap0 = useSharedValue(false); const snap1 = useSharedValue(false);
  const snap2 = useSharedValue(false); const snap3 = useSharedValue(false);

  // ── Visual state ──────────────────────────────────────────────────────────
  const scale0 = useSharedValue(1); const scale1 = useSharedValue(1);
  const scale2 = useSharedValue(1); const scale3 = useSharedValue(1);

  const near0 = useSharedValue(false); const near1 = useSharedValue(false);
  const near2 = useSharedValue(false); const near3 = useSharedValue(false);

  // ── Counters + win guard ──────────────────────────────────────────────────
  const placedCount = useSharedValue(0);
  const winFired    = useSharedValue(false);

  // ── JS callbacks ─────────────────────────────────────────────────────────
  const onCompleteRef    = useRef(onComplete);
  const onTilePlacedRef  = useRef(onTilePlaced);
  onCompleteRef.current    = onComplete;
  onTilePlacedRef.current  = onTilePlaced;

  const triggerLiftHaptic = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true });
  }, []);

  const triggerSnapHaptic = useCallback(() => {
    ReactNativeHapticFeedback.trigger('notificationSuccess', { enableVibrateFallback: true });
  }, []);

  const triggerWinHaptic = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactHeavy', { enableVibrateFallback: true });
  }, []);

  const handleTilePlacedJS = useCallback((idx: number) => {
    triggerSnapHaptic();
    onTilePlacedRef.current?.(idx);
  }, [triggerSnapHaptic]);

  const handleCompleteJS = useCallback(() => {
    triggerWinHaptic();
    onCompleteRef.current();
  }, [triggerWinHaptic]);

  // ── Gesture factory ───────────────────────────────────────────────────────
  /**
   * makePanGesture
   * Returns a stable Pan gesture for one tile. Called once per tile inside
   * useMemo([makePanGesture]) — the gesture object never changes after mount,
   * so GestureDetector never re-attaches the native handler mid-drag.
   *
   * Closure captures: boardSize, config (stable via useMemo), placedCount,
   * winFired, totalTiles, handleCompleteJS, handleTilePlacedJS.
   * Parameters:    per-tile identity + all SharedValues for that tile.
   */
  const makePanGesture = useCallback((
    idx:               number,
    tileTarget:        { row: number; col: number },  // static, from descriptor
    posX:              SharedValue<number>,
    posY:              SharedValue<number>,
    startX:            SharedValue<number>,
    startY:            SharedValue<number>,
    isPlaced:          SharedValue<boolean>,
    isActive:          SharedValue<boolean>,
    scale:             SharedValue<number>,
    isNearTarget:      SharedValue<boolean>,
    hasTargetPosition: SharedValue<boolean>,
    originX:           SharedValue<number>,
    originY:           SharedValue<number>,
    isAnyActiveGlobal: SharedValue<boolean>,
    wasActivated:      SharedValue<boolean>,
  ): ReturnType<typeof Gesture.Pan> => {

    const debug = __DEV__ && DEBUG_PATCHWORK;

    return Gesture.Pan()
      .minDistance(0)

      // ── onBegin ────────────────────────────────────────────────────────────
      .onBegin((e) => {
        'worklet';
        if (debug) {
          runOnJS(_logTrace)(
            `tile[${idx}] onBegin  placed=${isPlaced.value}  anyActive=${isAnyActiveGlobal.value}`,
          );
        }

        // Guard: don't activate a placed tile, re-enter if already active,
        // or start a second drag while another tile holds the global lock.
        if (isPlaced.value || isActive.value || isAnyActiveGlobal.value) return;

        // Save the pre-drag origin — used to spring back on failed drop.
        // Must be captured BEFORE the center-anchor adjustment below so we
        // restore the tile's actual resting position, not the shifted start.
        originX.value = posX.value;
        originY.value = posY.value;

        // ── Centered anchor ───────────────────────────────────────────────────
        // e.x / e.y = finger position within the tile view (0,0 = top-left).
        // Shifting by (e.x − halfW, e.y − halfH) makes the tile center land
        // exactly on the finger regardless of where on the tile the user tapped.
        const halfW = boardSize / config.cols / 2;
        const halfH = boardSize / config.rows / 2;
        posX.value = posX.value + (e.x - halfW);
        posY.value = posY.value + (e.y - halfH);

        // Snapshot the adjusted position as the translation origin for onUpdate.
        startX.value = posX.value;
        startY.value = posY.value;

        isActive.value          = true;
        isAnyActiveGlobal.value = true;
        wasActivated.value      = true;
        scale.value             = withSpring(DRAG_LIFT_SCALE, SCALE_SPRING);
        // Light haptic on lift — tactile confirmation the tile is held.
        runOnJS(triggerLiftHaptic)();
      })

      // ── onUpdate ───────────────────────────────────────────────────────────
      .onUpdate((e) => {
        'worklet';
        // Guard against two failure modes:
        //   isPlaced   — tile already snapped; position is owned by snap animation.
        //   !isActive  — onBegin returned early (global lock, re-entry, or placed
        //                guard). Without this, a blocked gesture's onUpdate would
        //                compute posX = stale_startX + translationX and silently
        //                teleport the tile to a garbage position on screen.
        if (isPlaced.value || !isActive.value) return;

        posX.value = startX.value + e.translationX;
        posY.value = startY.value + e.translationY;

        // Use tile CENTER for cell membership — more natural than top-left.
        // halfW/halfH are derived from boardSize and config, both in closure.
        const halfW = boardSize / config.cols / 2;
        const halfH = boardSize / config.rows / 2;

        // isNearTarget: true while the tile's center is inside the target cell.
        isNearTarget.value = isTileOverTarget(
          posX.value + halfW,
          posY.value + halfH,
          tileTarget,
          boardSize, boardSize,
          config,
        );
      })

      // ── onEnd ──────────────────────────────────────────────────────────────
      .onEnd(() => {
        'worklet';
        // Always clear active + near first — safe even for blocked gestures
        // where these were never set (writes are idempotent false→false).
        isActive.value     = false;
        isNearTarget.value = false;

        // If this gesture was never activated (onBegin returned early due to
        // the global lock, isPlaced guard, or re-entry guard), skip all snap /
        // spring-back logic. Without this guard, a second-finger gesture on a
        // tile that happens to be positioned over its target cell would trigger
        // a false snap and incorrectly increment placedCount.
        if (!wasActivated.value) return;

        if (debug) {
          runOnJS(_logTrace)(
            `tile[${idx}] onEnd  placed=${isPlaced.value}  pos=(${posX.value.toFixed(1)},${posY.value.toFixed(1)})`,
          );
        }

        if (isPlaced.value) return;

        // Use tile CENTER for snap decision — must be consistent with onUpdate.
        const halfW = boardSize / config.cols / 2;
        const halfH = boardSize / config.rows / 2;
        const centerX = posX.value + halfW;
        const centerY = posY.value + halfH;

        const cell = pixelToGridCell(centerX, centerY, boardSize, boardSize, config);
        const isCorrectCell = cell.row === tileTarget.row && cell.col === tileTarget.col;

        if (debug) {
          runOnJS(_logTrace)(
            `tile[${idx}] center=(${centerX.toFixed(1)},${centerY.toFixed(1)})  cell=(${cell.row},${cell.col})  target=(${tileTarget.row},${tileTarget.col})  valid=${isCorrectCell}`,
          );
        }

        if (isCorrectCell) {
          // ── SNAP ─────────────────────────────────────────────────────────
          const snapFrame = cellToPixelFrame(cell.row, cell.col, boardSize, boardSize, config);
          posX.value = withTiming(snapFrame.x, { duration: SNAP_ANIMATION_MS, easing: SNAP_EASING });
          posY.value = withTiming(snapFrame.y, { duration: SNAP_ANIMATION_MS, easing: SNAP_EASING });
          scale.value = withSpring(1.0, SCALE_SPRING);

          // Set hasTargetPosition and isPlaced atomically (UI thread is serial —
          // no interleaving possible between these two assignments).
          hasTargetPosition.value = true;
          isPlaced.value          = true;

          placedCount.value = placedCount.value + 1;

          if (placedCount.value >= totalTiles) {
            if (!winFired.value) {
              winFired.value = true;
              runOnJS(handleCompleteJS)();
            }
          } else {
            runOnJS(handleTilePlacedJS)(idx);
          }

        } else {
          // ── SPRING-BACK with bounce ───────────────────────────────────────
          // Tile dropped in the wrong cell. Do NOT start the spring-back here.
          // onFinalize fires immediately after onEnd on the UI thread — any
          // animation started here would be overwritten before it could play.
          // All cleanup for the non-snap path is handled in onFinalize below.
        }
      })

      // ── onFinalize ─────────────────────────────────────────────────────────
      // Fires after onEnd for normal completions, and INSTEAD of onEnd for
      // cancelled / interrupted gestures (finger out of bounds, arena stolen).
      // This is the single universal exit point — the authoritative place for
      // all post-gesture animation and flag cleanup.
      //
      // IMPORTANT: onFinalize fires on the UI thread immediately after onEnd
      // (same synchronous tick). Any animation started in onEnd would be
      // overwritten here before it could execute. For this reason ALL
      // non-snap spring-back logic lives here, not in onEnd.
      .onFinalize(() => {
        'worklet';

        // Always clear active / near — idempotent; safe even if onBegin
        // returned early (blocked gesture) or onEnd already cleared them.
        isActive.value     = false;
        isNearTarget.value = false;

        // wasActivated guards against a blocked second-finger gesture
        // (multi-touch on a different tile) incorrectly releasing the global
        // lock while the first tile is still being dragged. If onBegin never
        // passed its guard, wasActivated is false — nothing further to clean up.
        if (!wasActivated.value) {
          if (debug) {
            runOnJS(_logTrace)(`tile[${idx}] onFinalize  blocked (not activated) — clean ✓`);
          }
          return;
        }

        wasActivated.value      = false;
        isAnyActiveGlobal.value = false;

        // For unplaced tiles — covers two sub-cases:
        //   a) Normal failed drop (onEnd ran, non-snap branch): posX/Y are
        //      still at the release point; play the bounce then spring-back.
        //   b) Cancelled / interrupted gesture (onEnd never ran): posX/Y are
        //      wherever the finger was when the gesture was cancelled; same
        //      bounce spring-back applies.
        // For placed tiles: onEnd already started the snap withTiming — skip.
        if (!isPlaced.value) {
          scale.value = withSequence(
            withTiming(0.91, { duration: 70, easing: Easing.out(Easing.quad) }),
            withSpring(1.0, SCALE_SPRING),
          );
          posX.value  = withSpring(originX.value, POS_SPRING);
          posY.value  = withSpring(originY.value, POS_SPRING);
        }

        if (debug) {
          runOnJS(_logTrace)(`tile[${idx}] onFinalize`);
          assertTileClean(
            idx, isActive, isNearTarget, scale, isPlaced, hasTargetPosition,
            _logTrace, _logError,
          );
        }
      });

  }, [
    boardSize,
    config,
    totalTiles,
    placedCount,
    winFired,
    handleCompleteJS,
    handleTilePlacedJS,
    triggerLiftHaptic,
  ]);

  // ── Memoized gestures — one per tile, stable across re-renders ───────────
  const g0 = useMemo(
    () => makePanGesture(0, tiles[0]!.target, px0, py0, sx0, sy0, placed0, active0, scale0, near0, snap0, ox0, oy0, isAnyActive, was0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [makePanGesture],
  );
  const g1 = useMemo(
    () => makePanGesture(1, tiles[1]!.target, px1, py1, sx1, sy1, placed1, active1, scale1, near1, snap1, ox1, oy1, isAnyActive, was1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [makePanGesture],
  );
  const g2 = useMemo(
    () => makePanGesture(2, tiles[2]!.target, px2, py2, sx2, sy2, placed2, active2, scale2, near2, snap2, ox2, oy2, isAnyActive, was2),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [makePanGesture],
  );
  const g3 = useMemo(
    () => makePanGesture(3, tiles[3]!.target, px3, py3, sx3, sy3, placed3, active3, scale3, near3, snap3, ox3, oy3, isAnyActive, was3),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [makePanGesture],
  );

  // ── Tile states ───────────────────────────────────────────────────────────
  // Memoized: SharedValues and gesture objects are stable after mount, so
  // this array is created once and never recreated, avoiding re-renders of
  // PatchworkBoard during play (state changes don't come from React renders —
  // they flow through SharedValues directly on the UI thread).
  const tileStates = useMemo<PatchworkTileState[]>(() => [
    { descriptor: tiles[0]!, posX: px0, posY: py0, isPlaced: placed0, isActive: active0, scale: scale0, isNearTarget: near0, hasTargetPosition: snap0, gesture: g0 },
    { descriptor: tiles[1]!, posX: px1, posY: py1, isPlaced: placed1, isActive: active1, scale: scale1, isNearTarget: near1, hasTargetPosition: snap1, gesture: g1 },
    { descriptor: tiles[2]!, posX: px2, posY: py2, isPlaced: placed2, isActive: active2, scale: scale2, isNearTarget: near2, hasTargetPosition: snap2, gesture: g2 },
    { descriptor: tiles[3]!, posX: px3, posY: py3, isPlaced: placed3, isActive: active3, scale: scale3, isNearTarget: near3, hasTargetPosition: snap3, gesture: g3 },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [
    // All deps are stable after mount: useSharedValue refs never change,
    // useMemo gesture refs never change, useState tiles never change.
    tiles,
    px0, py0, placed0, active0, scale0, near0, snap0, g0,
    px1, py1, placed1, active1, scale1, near1, snap1, g1,
    px2, py2, placed2, active2, scale2, near2, snap2, g2,
    px3, py3, placed3, active3, scale3, near3, snap3, g3,
  ]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetLevel = useCallback(() => {
    // Compute boardFrame inline to avoid stale-closure risk.
    const frame: Frame = { x: 0, y: 0, width: boardSize, height: boardSize };
    const next = generateTiles(imageKeys, frame, config);

    // Positions can be set from JS (SharedValues accept JS-thread writes).
    px0.value = next[0]!.initialFrame.x; py0.value = next[0]!.initialFrame.y;
    px1.value = next[1]!.initialFrame.x; py1.value = next[1]!.initialFrame.y;
    px2.value = next[2]!.initialFrame.x; py2.value = next[2]!.initialFrame.y;
    px3.value = next[3]!.initialFrame.x; py3.value = next[3]!.initialFrame.y;

    // All flag + visual resets run on the UI thread together so they're
    // applied atomically with respect to any in-flight gesture worklet.
    runOnUI(() => {
      'worklet';
      placed0.value = false; active0.value = false; scale0.value = 1; near0.value = false; snap0.value = false; was0.value = false;
      placed1.value = false; active1.value = false; scale1.value = 1; near1.value = false; snap1.value = false; was1.value = false;
      placed2.value = false; active2.value = false; scale2.value = 1; near2.value = false; snap2.value = false; was2.value = false;
      placed3.value = false; active3.value = false; scale3.value = 1; near3.value = false; snap3.value = false; was3.value = false;
      isAnyActive.value = false;
      placedCount.value = 0;
      winFired.value    = false;
    })();
  }, [
    boardSize, config, imageKeys,
    px0, py0, px1, py1, px2, py2, px3, py3,
    placed0, active0, scale0, near0, snap0, was0,
    placed1, active1, scale1, near1, snap1, was1,
    placed2, active2, scale2, near2, snap2, was2,
    placed3, active3, scale3, near3, snap3, was3,
    isAnyActive, placedCount, winFired,
  ]);

  return { tileStates, config, tileW, tileH, resetLevel, isAnyActive };
}
