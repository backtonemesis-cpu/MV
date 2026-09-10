const BRIDGED_SELECT_SELECTOR = '.mv-density-root select:not([data-mv-native="true"])';

interface RectLike {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function pointInsideRect(rect: RectLike, clientX: number, clientY: number): boolean {
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

function isBridgeEligible(select: HTMLSelectElement): boolean {
  return (
    !select.disabled &&
    !select.multiple &&
    select.size <= 1 &&
    select.dataset.mvNative !== 'true'
  );
}

function isVisible(select: HTMLSelectElement): boolean {
  const style = window.getComputedStyle(select);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = select.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function selectFromLabelTarget(target: EventTarget | null): HTMLSelectElement | null {
  if (!(target instanceof Element)) return null;
  const label = target.closest('label');
  if (!(label instanceof HTMLLabelElement)) return null;

  const nestedSelect = label.querySelector<HTMLSelectElement>('select');
  if (nestedSelect && isBridgeEligible(nestedSelect)) return nestedSelect;

  if (!label.htmlFor) return null;
  const labelledControl = document.getElementById(label.htmlFor);
  return labelledControl instanceof HTMLSelectElement && isBridgeEligible(labelledControl)
    ? labelledControl
    : null;
}

function selectAtPoint(clientX: number, clientY: number): HTMLSelectElement | null {
  const selects = Array.from(
    document.querySelectorAll<HTMLSelectElement>(BRIDGED_SELECT_SELECTOR)
  );

  for (let index = selects.length - 1; index >= 0; index -= 1) {
    const select = selects[index];
    if (!isBridgeEligible(select) || !isVisible(select)) continue;
    if (pointInsideRect(select.getBoundingClientRect(), clientX, clientY)) return select;
  }

  return null;
}

function dispatchBridgeOpen(select: HTMLSelectElement): void {
  select.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true,
    })
  );
}

export function installMVNativeSelectTouchGuard(): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => undefined;

  let pendingSelect: HTMLSelectElement | null = null;

  const resolvePointerSelect = (event: PointerEvent | MouseEvent): HTMLSelectElement | null => {
    const labelSelect = selectFromLabelTarget(event.target);
    if (labelSelect) return labelSelect;

    if (event.target instanceof HTMLSelectElement) return null;
    if (event.target instanceof Element && event.target.closest('[data-mv-select-popover]')) {
      return null;
    }

    return selectAtPoint(event.clientX, event.clientY);
  };

  const handlePointerDown = (event: PointerEvent) => {
    const select = resolvePointerSelect(event);
    if (!select) return;

    event.preventDefault();
    event.stopPropagation();
    pendingSelect = select;
    dispatchBridgeOpen(select);
  };

  const handleClick = (event: MouseEvent) => {
    const select = resolvePointerSelect(event) ?? selectFromLabelTarget(event.target) ?? pendingSelect;
    if (!select) return;

    event.preventDefault();
    event.stopPropagation();
    pendingSelect = null;
  };

  document.addEventListener('pointerdown', handlePointerDown, true);
  document.addEventListener('click', handleClick, true);

  return () => {
    document.removeEventListener('pointerdown', handlePointerDown, true);
    document.removeEventListener('click', handleClick, true);
    pendingSelect = null;
  };
}
