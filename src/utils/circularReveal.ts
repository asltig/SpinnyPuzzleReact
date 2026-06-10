type ExpandFn = (cx: number, cy: number, color: string, onComplete: () => void) => void;
type ContractFn = (cx: number, cy: number, color: string) => void;

let _expand: ExpandFn | null = null;
let _contract: ContractFn | null = null;

// Stores the last card tap position and color for the reverse (contract) animation.
export const storedCard = { cx: 0, cy: 0, color: '#392635' };

export function registerRevealHandlers(expand: ExpandFn, contract: ContractFn) {
  _expand = expand;
  _contract = contract;
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
