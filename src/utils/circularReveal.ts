type ExpandFn = (cx: number, cy: number, color: string, onComplete: () => void) => void;
type ContractFn = (cx: number, cy: number, color: string) => void;
type DismissFn = () => void;

let _expand: ExpandFn | null = null;
let _contract: ContractFn | null = null;
let _dismiss: DismissFn | null = null;

// Stores the last card tap position and color for the reverse (contract) animation.
export const storedCard = { cx: 0, cy: 0, color: '#392635' };

export function registerRevealHandlers(expand: ExpandFn, contract: ContractFn, dismiss: DismissFn) {
  _expand = expand;
  _contract = contract;
  _dismiss = dismiss;
}

export function expandCircle(cx: number, cy: number, color: string, onComplete: () => void) {
  storedCard.cx = cx;
  storedCard.cy = cy;
  storedCard.color = color;
  _expand?.(cx, cy, color, onComplete);
}

export function contractCircle() {
  _contract?.(storedCard.cx, storedCard.cy, storedCard.color);
}

/** Call from the destination screen's first mount to fade out the expand overlay. */
export function dismissRevealOverlay() {
  _dismiss?.();
}
