type ExpandFn = (cx: number, cy: number, color: string, onComplete: () => void) => void;
type ContractFn = (cx: number, cy: number, color: string) => void;
type DismissFn = () => void;

let _expand: ExpandFn | null = null;
let _contract: ContractFn | null = null;
let _dismiss: DismissFn | null = null;

// Stores the last card tap position and color for the reverse (contract) animation.
export const storedCard = { cx: 0, cy: 0, color: '#392635' };

// Two-flag gate: overlay only fades when BOTH animation is done AND destination
// screen has completed its first native layout (onLayout fires on root view).
let _animDone = false;
let _screenReady = false;
let _fallbackTimer: ReturnType<typeof setTimeout> | null = null;

function _tryDismiss() {
  if (_animDone && _screenReady) {
    _animDone = false;
    _screenReady = false;
    if (_fallbackTimer !== null) {
      clearTimeout(_fallbackTimer);
      _fallbackTimer = null;
    }
    _dismiss?.();
  }
}

export function registerRevealHandlers(expand: ExpandFn, contract: ContractFn, dismiss: DismissFn) {
  _expand = expand;
  _contract = contract;
  _dismiss = dismiss;
}

export function expandCircle(cx: number, cy: number, color: string, onComplete: () => void) {
  storedCard.cx = cx;
  storedCard.cy = cy;
  storedCard.color = color;
  // Reset flags for this new transition
  _animDone = false;
  _screenReady = false;
  if (_fallbackTimer !== null) {
    clearTimeout(_fallbackTimer);
    _fallbackTimer = null;
  }
  _expand?.(cx, cy, color, onComplete);
}

/** Called (via runOnJS) from the withTiming callback when the expand circle reaches full size. */
export function markRevealAnimationDone(): void {
  _animDone = true;
  _tryDismiss();
  // Safety fallback: if the screen never calls markRevealScreenReady (e.g. it was
  // already mounted), dismiss after 400 ms regardless.
  _fallbackTimer = setTimeout(() => {
    _fallbackTimer = null;
    if (_animDone) {
      _screenReady = true;
      _tryDismiss();
    }
  }, 400);
}

/** Call from the destination screen's root view onLayout (fires after first native layout). */
export function markRevealScreenReady(): void {
  _screenReady = true;
  _tryDismiss();
}

export function contractCircle() {
  _contract?.(storedCard.cx, storedCard.cy, storedCard.color);
}

/** Direct dismiss — used by contract-flow screens; not needed for expand flow. */
export function dismissRevealOverlay() {
  _dismiss?.();
}
