import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type ModalEntry = {
  id: symbol;
  dialog: HTMLElement;
};

type BackgroundState = {
  element: HTMLElement;
  inert: boolean;
  ariaHidden: string | null;
};

const modalStack: ModalEntry[] = [];
let previousBodyOverflow: string | null = null;
let isolatedBackground: BackgroundState[] = [];

function getTopModal(): ModalEntry | undefined {
  return modalStack[modalStack.length - 1];
}

function isTopModal(id: symbol): boolean {
  return getTopModal()?.id === id;
}

function restoreBackgroundIsolation() {
  for (const state of isolatedBackground) {
    state.element.inert = state.inert;
    if (state.ariaHidden === null) state.element.removeAttribute('aria-hidden');
    else state.element.setAttribute('aria-hidden', state.ariaHidden);
  }
  isolatedBackground = [];
}

function isolateBackground(dialog: HTMLElement) {
  restoreBackgroundIsolation();

  let child: HTMLElement = dialog;
  let parent = dialog.parentElement;

  while (parent) {
    for (const sibling of Array.from(parent.children)) {
      if (sibling === child || !(sibling instanceof HTMLElement)) continue;
      if (sibling.tagName === 'SCRIPT' || sibling.tagName === 'STYLE') continue;

      isolatedBackground.push({
        element: sibling,
        inert: sibling.inert,
        ariaHidden: sibling.getAttribute('aria-hidden'),
      });
      sibling.inert = true;
      sibling.setAttribute('aria-hidden', 'true');
    }

    if (parent === document.body) break;
    child = parent;
    parent = parent.parentElement;
  }
}

function reconcileModalEnvironment() {
  const topModal = getTopModal();

  if (!topModal) {
    restoreBackgroundIsolation();
    if (previousBodyOverflow !== null) {
      document.body.style.overflow = previousBodyOverflow;
      previousBodyOverflow = null;
    }
    return;
  }

  if (previousBodyOverflow === null) {
    previousBodyOverflow = document.body.style.overflow;
  }
  document.body.style.overflow = 'hidden';

  if (topModal.dialog.isConnected) {
    isolateBackground(topModal.dialog);
  }
}

function registerModal(entry: ModalEntry) {
  modalStack.push(entry);
  reconcileModalEnvironment();
}

function unregisterModal(id: symbol) {
  const index = modalStack.findIndex((entry) => entry.id === id);
  if (index !== -1) modalStack.splice(index, 1);
  reconcileModalEnvironment();
}

export function useModalAccessibility<T extends HTMLElement>(
  active: boolean,
  onEscape?: () => void
) {
  const dialogRef = useRef<T | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const escapeHandlerRef = useRef(onEscape);

  escapeHandlerRef.current = onEscape;

  useEffect(() => {
    if (!active) return;

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const modalId = Symbol('mv-modal');
    registerModal({ id: modalId, dialog });

    const focusInitial = window.requestAnimationFrame(() => {
      if (!isTopModal(modalId)) return;

      const current = document.activeElement;
      if (current instanceof HTMLElement && dialog.contains(current)) return;

      const initialFocus =
        dialog.querySelector<HTMLElement>('[data-modal-initial-focus]') ??
        dialog.querySelector<HTMLElement>('[autofocus]') ??
        dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (initialFocus || dialog).focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopModal(modalId)) return;

      const isCommandShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (isCommandShortcut && !dialog.hasAttribute('data-modal-allows-command-shortcut')) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (event.key === 'Escape' && escapeHandlerRef.current) {
        event.preventDefault();
        event.stopPropagation();
        escapeHandlerRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null);

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(focusInitial);
      document.removeEventListener('keydown', handleKeyDown, true);
      unregisterModal(modalId);

      const returnTarget = returnFocusRef.current;
      if (!returnTarget?.isConnected) return;

      const remainingTop = getTopModal();
      if (remainingTop && !remainingTop.dialog.contains(returnTarget)) return;

      window.requestAnimationFrame(() => returnTarget.focus({ preventScroll: true }));
    };
  }, [active]);

  return dialogRef;
}
