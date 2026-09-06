const MODAL_SELECTOR = '.mv-modal-backdrop .mv-modal-card';
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let generatedId = 0;

function nextId(prefix: string): string {
  generatedId += 1;
  return `${prefix}-${generatedId}`;
}

function openDialogs(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(MODAL_SELECTOR));
}

function activeDialog(): HTMLElement | null {
  const dialogs = openDialogs();
  return dialogs.length ? dialogs[dialogs.length - 1] : null;
}

function focusableElements(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute('disabled') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      element.getAttribute('tabindex') !== '-1'
  );
}

function ensureDialogName(dialog: HTMLElement): void {
  if (dialog.hasAttribute('aria-label') || dialog.hasAttribute('aria-labelledby')) return;

  const title = dialog.querySelector<HTMLElement>('h1, h2, h3');
  if (!title) {
    dialog.setAttribute('aria-label', 'Dialog');
    return;
  }

  if (!title.id) title.id = nextId('mv-dialog-title');
  dialog.setAttribute('aria-labelledby', title.id);
}

function ensureCloseButtonName(dialog: HTMLElement): void {
  dialog.querySelectorAll<HTMLButtonElement>('.mv-modal-close').forEach((button) => {
    const hasName =
      Boolean(button.getAttribute('aria-label')) ||
      Boolean(button.getAttribute('aria-labelledby')) ||
      Boolean(button.textContent?.trim());
    if (!hasName) button.setAttribute('aria-label', 'Close dialog');
  });
}

function associateVisibleLabels(dialog: HTMLElement): void {
  dialog.querySelectorAll<HTMLLabelElement>('label:not([for])').forEach((label) => {
    const container = label.parentElement;
    if (!container) return;

    const control = container.querySelector<HTMLElement>(
      'input:not([type="hidden"]), select, textarea'
    );
    if (!control) return;

    if (!control.id) control.id = nextId('mv-dialog-control');
    label.htmlFor = control.id;
  });
}

function ensureDialogSemantics(dialog: HTMLElement): void {
  if (!dialog.hasAttribute('role')) dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  ensureDialogName(dialog);
  ensureCloseButtonName(dialog);
  associateVisibleLabels(dialog);
}

export function installModalAccessibility(): () => void {
  let returnFocus: HTMLElement | null = null;
  let previousDialogCount = 0;

  const scan = () => {
    const dialogs = openDialogs();
    dialogs.forEach(ensureDialogSemantics);

    if (previousDialogCount === 0 && dialogs.length > 0) {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const dialog = dialogs[dialogs.length - 1];
      requestAnimationFrame(() => {
        if (!dialog.isConnected || dialog.contains(document.activeElement)) return;
        const first = focusableElements(dialog)[0];
        if (first) first.focus();
        else {
          dialog.tabIndex = -1;
          dialog.focus();
        }
      });
    }

    if (previousDialogCount > 0 && dialogs.length === 0) {
      const target = returnFocus;
      returnFocus = null;
      requestAnimationFrame(() => {
        if (target?.isConnected) target.focus();
      });
    }

    previousDialogCount = dialogs.length;
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const dialog = activeDialog();
    if (!dialog) return;

    const focusable = focusableElements(dialog);
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.tabIndex = -1;
      dialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement;

    if (!dialog.contains(current)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }

    if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && current === first) {
      event.preventDefault();
      last.focus();
    }
  };

  const observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('keydown', handleKeyDown, true);
  scan();

  return () => {
    observer.disconnect();
    document.removeEventListener('keydown', handleKeyDown, true);
  };
}
