/**
 * useJigsawGame.ts
 * Game-engine hook for the Jigsaw puzzle.
 * Supports Easy (6), Medium (12) and Hard (20) pieces.
 *
 * All SharedValues are pre-allocated for the Hard-mode maximum (20 pieces).
 * Unused slots stay at defaults and produce no-op gestures.
 * Rules of Hooks: every useSharedValue / useMemo is unconditional, at top level.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  useSharedValue,
  withTiming,
  withSpring,
  runOnJS,
  runOnUI,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { gridConfigForMode, computeLayout, generatePieces, isPieceNearTarget } from './jigsawMath';
import type { JigsawPiece } from './types';
import type { GameMode } from '../../types/models';
import { soundService } from '../../services/audio/soundService';

// ─────────────────────────────────────────────
const SNAP_MS     = 160;
const RETURN_MS   = 220;
const SCALE_SPRING = { damping: 14, stiffness: 220, mass: 0.8 } as const;
const SNAP_EASING  = Easing.out(Easing.cubic);
const MAX_PIECES   = 20; // Hard mode maximum

// ─────────────────────────────────────────────
export interface JigsawPieceState {
  descriptor:   JigsawPiece;
  posX:         SharedValue<number>;
  posY:         SharedValue<number>;
  scale:        SharedValue<number>;
  isPlaced:     SharedValue<boolean>;
  isActive:     SharedValue<boolean>;
  isNearTarget: SharedValue<boolean>;
  gesture:      ReturnType<typeof Gesture.Pan>;
}

interface Params {
  screenW:       number;
  screenH:       number;
  topBarH:       number;
  mode:          GameMode;
  onComplete:    () => void;
  /** Called (on JS thread) whenever a piece snaps into its slot. */
  onPieceSnapped?: (pieceIndex: number) => void;
}

interface Return {
  pieceStates: JigsawPieceState[];
  pieces:      JigsawPiece[];
  boardFrame:  { x: number; y: number; width: number; height: number };
  baseW: number; baseH: number;
  tabW:  number; tabH:  number;
  canvasW: number; canvasH: number;
  resetLevel: () => void;
}

// ─────────────────────────────────────────────
export function useJigsawGame({
  screenW, screenH, topBarH, mode, onComplete, onPieceSnapped,
}: Params): Return {

  const cfg    = useMemo(() => gridConfigForMode(mode), [mode]);
  const layout = useMemo(() => computeLayout(screenW, screenH, topBarH, cfg), [screenW, screenH, topBarH, cfg]);
  const pieces = useMemo(() => generatePieces(layout, cfg), [layout, cfg]);

  const triggerHaptic = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactMedium', { enableVibrateFallback: true });
  }, []);
  const playSnap = useCallback(() => soundService.play('ring_snap'), []);

  // Stable ref so gesture closures (useMemo []) always call the latest callback
  const onSnappedRef = useRef(onPieceSnapped);
  onSnappedRef.current = onPieceSnapped;

  const handleSnapped = useCallback((idx: number) => {
    onSnappedRef.current?.(idx);
  }, []); // stable — ref holds latest value

  const winFired = useSharedValue(false);

  // ── Pre-allocated SharedValues for MAX_PIECES=20 ──────────────────────────
  // Positions
  const px0 =useSharedValue(0); const py0 =useSharedValue(0);
  const px1 =useSharedValue(0); const py1 =useSharedValue(0);
  const px2 =useSharedValue(0); const py2 =useSharedValue(0);
  const px3 =useSharedValue(0); const py3 =useSharedValue(0);
  const px4 =useSharedValue(0); const py4 =useSharedValue(0);
  const px5 =useSharedValue(0); const py5 =useSharedValue(0);
  const px6 =useSharedValue(0); const py6 =useSharedValue(0);
  const px7 =useSharedValue(0); const py7 =useSharedValue(0);
  const px8 =useSharedValue(0); const py8 =useSharedValue(0);
  const px9 =useSharedValue(0); const py9 =useSharedValue(0);
  const px10=useSharedValue(0); const py10=useSharedValue(0);
  const px11=useSharedValue(0); const py11=useSharedValue(0);
  const px12=useSharedValue(0); const py12=useSharedValue(0);
  const px13=useSharedValue(0); const py13=useSharedValue(0);
  const px14=useSharedValue(0); const py14=useSharedValue(0);
  const px15=useSharedValue(0); const py15=useSharedValue(0);
  const px16=useSharedValue(0); const py16=useSharedValue(0);
  const px17=useSharedValue(0); const py17=useSharedValue(0);
  const px18=useSharedValue(0); const py18=useSharedValue(0);
  const px19=useSharedValue(0); const py19=useSharedValue(0);
  // Drag offsets
  const ox0 =useSharedValue(0); const oy0 =useSharedValue(0);
  const ox1 =useSharedValue(0); const oy1 =useSharedValue(0);
  const ox2 =useSharedValue(0); const oy2 =useSharedValue(0);
  const ox3 =useSharedValue(0); const oy3 =useSharedValue(0);
  const ox4 =useSharedValue(0); const oy4 =useSharedValue(0);
  const ox5 =useSharedValue(0); const oy5 =useSharedValue(0);
  const ox6 =useSharedValue(0); const oy6 =useSharedValue(0);
  const ox7 =useSharedValue(0); const oy7 =useSharedValue(0);
  const ox8 =useSharedValue(0); const oy8 =useSharedValue(0);
  const ox9 =useSharedValue(0); const oy9 =useSharedValue(0);
  const ox10=useSharedValue(0); const oy10=useSharedValue(0);
  const ox11=useSharedValue(0); const oy11=useSharedValue(0);
  const ox12=useSharedValue(0); const oy12=useSharedValue(0);
  const ox13=useSharedValue(0); const oy13=useSharedValue(0);
  const ox14=useSharedValue(0); const oy14=useSharedValue(0);
  const ox15=useSharedValue(0); const oy15=useSharedValue(0);
  const ox16=useSharedValue(0); const oy16=useSharedValue(0);
  const ox17=useSharedValue(0); const oy17=useSharedValue(0);
  const ox18=useSharedValue(0); const oy18=useSharedValue(0);
  const ox19=useSharedValue(0); const oy19=useSharedValue(0);
  // Scale
  const sc0 =useSharedValue(1); const sc1 =useSharedValue(1);
  const sc2 =useSharedValue(1); const sc3 =useSharedValue(1);
  const sc4 =useSharedValue(1); const sc5 =useSharedValue(1);
  const sc6 =useSharedValue(1); const sc7 =useSharedValue(1);
  const sc8 =useSharedValue(1); const sc9 =useSharedValue(1);
  const sc10=useSharedValue(1); const sc11=useSharedValue(1);
  const sc12=useSharedValue(1); const sc13=useSharedValue(1);
  const sc14=useSharedValue(1); const sc15=useSharedValue(1);
  const sc16=useSharedValue(1); const sc17=useSharedValue(1);
  const sc18=useSharedValue(1); const sc19=useSharedValue(1);
  // Placed flags
  const pl0 =useSharedValue(false); const pl1 =useSharedValue(false);
  const pl2 =useSharedValue(false); const pl3 =useSharedValue(false);
  const pl4 =useSharedValue(false); const pl5 =useSharedValue(false);
  const pl6 =useSharedValue(false); const pl7 =useSharedValue(false);
  const pl8 =useSharedValue(false); const pl9 =useSharedValue(false);
  const pl10=useSharedValue(false); const pl11=useSharedValue(false);
  const pl12=useSharedValue(false); const pl13=useSharedValue(false);
  const pl14=useSharedValue(false); const pl15=useSharedValue(false);
  const pl16=useSharedValue(false); const pl17=useSharedValue(false);
  const pl18=useSharedValue(false); const pl19=useSharedValue(false);
  // Active flags
  const ac0 =useSharedValue(false); const ac1 =useSharedValue(false);
  const ac2 =useSharedValue(false); const ac3 =useSharedValue(false);
  const ac4 =useSharedValue(false); const ac5 =useSharedValue(false);
  const ac6 =useSharedValue(false); const ac7 =useSharedValue(false);
  const ac8 =useSharedValue(false); const ac9 =useSharedValue(false);
  const ac10=useSharedValue(false); const ac11=useSharedValue(false);
  const ac12=useSharedValue(false); const ac13=useSharedValue(false);
  const ac14=useSharedValue(false); const ac15=useSharedValue(false);
  const ac16=useSharedValue(false); const ac17=useSharedValue(false);
  const ac18=useSharedValue(false); const ac19=useSharedValue(false);
  // Near-target flags
  const nt0 =useSharedValue(false); const nt1 =useSharedValue(false);
  const nt2 =useSharedValue(false); const nt3 =useSharedValue(false);
  const nt4 =useSharedValue(false); const nt5 =useSharedValue(false);
  const nt6 =useSharedValue(false); const nt7 =useSharedValue(false);
  const nt8 =useSharedValue(false); const nt9 =useSharedValue(false);
  const nt10=useSharedValue(false); const nt11=useSharedValue(false);
  const nt12=useSharedValue(false); const nt13=useSharedValue(false);
  const nt14=useSharedValue(false); const nt15=useSharedValue(false);
  const nt16=useSharedValue(false); const nt17=useSharedValue(false);
  const nt18=useSharedValue(false); const nt19=useSharedValue(false);

  // Indexed arrays (plain JS, not hooks)
  const PX=[px0,px1,px2,px3,px4,px5,px6,px7,px8,px9,px10,px11,px12,px13,px14,px15,px16,px17,px18,px19] as const;
  const PY=[py0,py1,py2,py3,py4,py5,py6,py7,py8,py9,py10,py11,py12,py13,py14,py15,py16,py17,py18,py19] as const;
  const OX=[ox0,ox1,ox2,ox3,ox4,ox5,ox6,ox7,ox8,ox9,ox10,ox11,ox12,ox13,ox14,ox15,ox16,ox17,ox18,ox19] as const;
  const OY=[oy0,oy1,oy2,oy3,oy4,oy5,oy6,oy7,oy8,oy9,oy10,oy11,oy12,oy13,oy14,oy15,oy16,oy17,oy18,oy19] as const;
  const SC=[sc0,sc1,sc2,sc3,sc4,sc5,sc6,sc7,sc8,sc9,sc10,sc11,sc12,sc13,sc14,sc15,sc16,sc17,sc18,sc19] as const;
  const PL=[pl0,pl1,pl2,pl3,pl4,pl5,pl6,pl7,pl8,pl9,pl10,pl11,pl12,pl13,pl14,pl15,pl16,pl17,pl18,pl19] as const;
  const AC=[ac0,ac1,ac2,ac3,ac4,ac5,ac6,ac7,ac8,ac9,ac10,ac11,ac12,ac13,ac14,ac15,ac16,ac17,ac18,ac19] as const;
  const NT=[nt0,nt1,nt2,nt3,nt4,nt5,nt6,nt7,nt8,nt9,nt10,nt11,nt12,nt13,nt14,nt15,nt16,nt17,nt18,nt19] as const;

  // ── Sync positions to computed layout ─────────────────────────────────────
  useEffect(() => {
    const ps = pieces;
    runOnUI(() => {
      'worklet';
      for (let i = 0; i < MAX_PIECES; i++) {
        const p = ps[i];
        PX[i]!.value = p ? p.panelX     : 0;
        PY[i]!.value = p ? p.panelY     : 0;
        SC[i]!.value = p ? p.panelScale : 1;
        PL[i]!.value = false;
        AC[i]!.value = false;
        NT[i]!.value = false;
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieces]);

  // ── Gesture builder (plain function, not a hook) ───────────────────────────
  const n = pieces.length;

  function buildGesture(
    posX: SharedValue<number>, posY: SharedValue<number>,
    offX: SharedValue<number>, offY: SharedValue<number>,
    scale: SharedValue<number>,
    placed: SharedValue<boolean>, active: SharedValue<boolean>, near: SharedValue<boolean>,
    targetX: number, targetY: number,
    panelX: number, panelY: number, panelScale: number,
    snapTol: number,
    pieceIdx: number,         // ← for onPieceSnapped callback
  ): ReturnType<typeof Gesture.Pan> {
    return Gesture.Pan()
      .minDistance(0)
      .onBegin((e) => {
        'worklet';
        if (placed.value) return;
        active.value = true;
        offX.value   = e.absoluteX - posX.value;
        offY.value   = e.absoluteY - posY.value;
        scale.value  = withSpring(1.0, SCALE_SPRING);
        runOnJS(triggerHaptic)();
      })
      .onUpdate((e) => {
        'worklet';
        if (placed.value) return;
        posX.value = e.absoluteX - offX.value;
        posY.value = e.absoluteY - offY.value;
        near.value = isPieceNearTarget(posX.value, posY.value, targetX, targetY, snapTol);
      })
      .onEnd(() => {
        'worklet';
        if (placed.value) return;
        active.value = false;
        near.value   = false;
        if (isPieceNearTarget(posX.value, posY.value, targetX, targetY, snapTol)) {
          posX.value   = withTiming(targetX, { duration: SNAP_MS, easing: SNAP_EASING });
          posY.value   = withTiming(targetY, { duration: SNAP_MS, easing: SNAP_EASING });
          scale.value  = withTiming(1.0, { duration: SNAP_MS });
          placed.value = true;
          runOnJS(playSnap)();
          runOnJS(triggerHaptic)();
          runOnJS(handleSnapped)(pieceIdx);   // ← star effect trigger
          // Win check
          if (!winFired.value) {
            let done = true;
            for (let i = 0; i < n; i++) { if (!PL[i]!.value) { done = false; break; } }
            if (done) { winFired.value = true; runOnJS(onComplete)(); }
          }
        } else {
          posX.value  = withTiming(panelX,    { duration: RETURN_MS, easing: SNAP_EASING });
          posY.value  = withTiming(panelY,    { duration: RETURN_MS, easing: SNAP_EASING });
          scale.value = withSpring(panelScale, SCALE_SPRING);
        }
      })
      .onFinalize(() => {
        'worklet';
        if (!placed.value) { active.value = false; near.value = false; }
      });
  }

  // ── Piece data snapshots for useMemo (captured at mount) ──────────────────
  const tol = cfg.snapTolerance;
  const p = pieces; // stable reference

  // 20 explicit gestures — each useMemo is unconditional (Rules of Hooks)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g0  = useMemo(()=>p[0]  ? buildGesture(px0, py0, ox0, oy0, sc0, pl0, ac0, nt0, p[0].targetX, p[0].targetY, p[0].panelX, p[0].panelY, p[0].panelScale, tol, 0) : Gesture.Pan(),[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g1  = useMemo(()=>p[1]  ? buildGesture(px1, py1, ox1, oy1, sc1, pl1, ac1, nt1, p[1].targetX, p[1].targetY, p[1].panelX, p[1].panelY, p[1].panelScale, tol, 1) : Gesture.Pan(),[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g2  = useMemo(()=>p[2]  ? buildGesture(px2, py2, ox2, oy2, sc2, pl2, ac2, nt2, p[2].targetX, p[2].targetY, p[2].panelX, p[2].panelY, p[2].panelScale, tol, 2) : Gesture.Pan(),[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g3  = useMemo(()=>p[3]  ? buildGesture(px3, py3, ox3, oy3, sc3, pl3, ac3, nt3, p[3].targetX, p[3].targetY, p[3].panelX, p[3].panelY, p[3].panelScale, tol, 3) : Gesture.Pan(),[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g4  = useMemo(()=>p[4]  ? buildGesture(px4, py4, ox4, oy4, sc4, pl4, ac4, nt4, p[4].targetX, p[4].targetY, p[4].panelX, p[4].panelY, p[4].panelScale, tol, 4) : Gesture.Pan(),[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g5  = useMemo(()=>p[5]  ? buildGesture(px5, py5, ox5, oy5, sc5, pl5, ac5, nt5, p[5].targetX, p[5].targetY, p[5].panelX, p[5].panelY, p[5].panelScale, tol, 5) : Gesture.Pan(),[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g6  = useMemo(()=>p[6]  ? buildGesture(px6, py6, ox6, oy6, sc6, pl6, ac6, nt6, p[6].targetX, p[6].targetY, p[6].panelX, p[6].panelY, p[6].panelScale, tol, 6) : Gesture.Pan(),[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g7  = useMemo(()=>p[7]  ? buildGesture(px7, py7, ox7, oy7, sc7, pl7, ac7, nt7, p[7].targetX, p[7].targetY, p[7].panelX, p[7].panelY, p[7].panelScale, tol, 7) : Gesture.Pan(),[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g8  = useMemo(()=>p[8]  ? buildGesture(px8, py8, ox8, oy8, sc8, pl8, ac8, nt8, p[8].targetX, p[8].targetY, p[8].panelX, p[8].panelY, p[8].panelScale, tol, 8) : Gesture.Pan(),[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g9  = useMemo(()=>p[9]  ? buildGesture(px9, py9, ox9, oy9, sc9, pl9, ac9, nt9, p[9].targetX, p[9].targetY, p[9].panelX, p[9].panelY, p[9].panelScale, tol, 9) : Gesture.Pan(),[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g10 = useMemo(()=>p[10] ? buildGesture(px10,py10,ox10,oy10,sc10,pl10,ac10,nt10,p[10].targetX,p[10].targetY,p[10].panelX,p[10].panelY,p[10].panelScale,tol,10) : Gesture.Pan(),[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g11 = useMemo(()=>p[11] ? buildGesture(px11,py11,ox11,oy11,sc11,pl11,ac11,nt11,p[11].targetX,p[11].targetY,p[11].panelX,p[11].panelY,p[11].panelScale,tol,11) : Gesture.Pan(),[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g12 = useMemo(()=>p[12] ? buildGesture(px12,py12,ox12,oy12,sc12,pl12,ac12,nt12,p[12].targetX,p[12].targetY,p[12].panelX,p[12].panelY,p[12].panelScale,tol,12) : Gesture.Pan(),[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g13 = useMemo(()=>p[13] ? buildGesture(px13,py13,ox13,oy13,sc13,pl13,ac13,nt13,p[13].targetX,p[13].targetY,p[13].panelX,p[13].panelY,p[13].panelScale,tol,13) : Gesture.Pan(),[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g14 = useMemo(()=>p[14] ? buildGesture(px14,py14,ox14,oy14,sc14,pl14,ac14,nt14,p[14].targetX,p[14].targetY,p[14].panelX,p[14].panelY,p[14].panelScale,tol,14) : Gesture.Pan(),[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g15 = useMemo(()=>p[15] ? buildGesture(px15,py15,ox15,oy15,sc15,pl15,ac15,nt15,p[15].targetX,p[15].targetY,p[15].panelX,p[15].panelY,p[15].panelScale,tol,15) : Gesture.Pan(),[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g16 = useMemo(()=>p[16] ? buildGesture(px16,py16,ox16,oy16,sc16,pl16,ac16,nt16,p[16].targetX,p[16].targetY,p[16].panelX,p[16].panelY,p[16].panelScale,tol,16) : Gesture.Pan(),[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g17 = useMemo(()=>p[17] ? buildGesture(px17,py17,ox17,oy17,sc17,pl17,ac17,nt17,p[17].targetX,p[17].targetY,p[17].panelX,p[17].panelY,p[17].panelScale,tol,17) : Gesture.Pan(),[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g18 = useMemo(()=>p[18] ? buildGesture(px18,py18,ox18,oy18,sc18,pl18,ac18,nt18,p[18].targetX,p[18].targetY,p[18].panelX,p[18].panelY,p[18].panelScale,tol,18) : Gesture.Pan(),[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g19 = useMemo(()=>p[19] ? buildGesture(px19,py19,ox19,oy19,sc19,pl19,ac19,nt19,p[19].targetX,p[19].targetY,p[19].panelX,p[19].panelY,p[19].panelScale,tol,19) : Gesture.Pan(),[]);

  // ── Assemble piece states ─────────────────────────────────────────────────
  const pieceStates = useMemo<JigsawPieceState[]>(() => {
    const gs = [g0,g1,g2,g3,g4,g5,g6,g7,g8,g9,g10,g11,g12,g13,g14,g15,g16,g17,g18,g19];
    return pieces.map((piece, i) => ({
      descriptor:   piece,
      posX:         PX[i]!,
      posY:         PY[i]!,
      scale:        SC[i]!,
      isPlaced:     PL[i]!,
      isActive:     AC[i]!,
      isNearTarget: NT[i]!,
      gesture:      gs[i]!,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieces]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetLevel = useCallback(() => {
    winFired.value = false;
    const ps = pieces;
    runOnUI(() => {
      'worklet';
      for (let i = 0; i < MAX_PIECES; i++) {
        const p2 = ps[i];
        PX[i]!.value = p2 ? p2.panelX     : 0;
        PY[i]!.value = p2 ? p2.panelY     : 0;
        SC[i]!.value = p2 ? p2.panelScale : 1;
        PL[i]!.value = false; AC[i]!.value = false; NT[i]!.value = false;
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieces]);

  return {
    pieceStates, pieces,
    boardFrame:  layout.boardFrame,
    baseW:  layout.baseW,  baseH:  layout.baseH,
    tabW:   layout.tabW,   tabH:   layout.tabH,
    canvasW: layout.canvasW, canvasH: layout.canvasH,
    resetLevel,
  };
}