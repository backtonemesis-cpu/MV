const UNIFIED_BILL_SESSION_KEY = 'mv-unified-add-bill';
const UNIFIED_ADD_SESSION_KEY = 'mv-unified-add-launcher';
const OPEN_BILL_EVENT = 'mv:open-planned-payment';
const SWITCH_UNIFIED_TYPE_EVENT = 'mv:switch-unified-add-type';
const TRANSACTION_TYPES = ['expense', 'income', 'transfer', 'refund', 'repayment'] as const;

type UnifiedTransactionType = (typeof TRANSACTION_TYPES)[number];

let isSelectingUnifiedType = false;

function isUnifiedTransactionType(value: string | undefined): value is UnifiedTransactionType {
  return Boolean(value && TRANSACTION_TYPES.includes(value as UnifiedTransactionType));
}

function selectUnifiedTransactionType(type: UnifiedTransactionType): void {
  const button = document.querySelector<HTMLButtonElement>(
    `.mv-transaction-type-tab[aria-label="Add ${type}"]`
  );
  if (!button) return;

  // This synthetic click must reach React's type handler, but it must not be
  // mistaken for another user-requested tab switch by the capture listener
  // below. Without the guard, switching between two populated transaction
  // forms recursively closes and reopens the modal until the browser locks.
  isSelectingUnifiedType = true;
  try {
    button.click();
  } finally {
    isSelectingUnifiedType = false;
  }
}

function openFreshUnifiedTransaction(type: UnifiedTransactionType): void {
  window.sessionStorage.removeItem(UNIFIED_BILL_SESSION_KEY);
  window.sessionStorage.setItem(UNIFIED_ADD_SESSION_KEY, '1');

  // Open and select in the same browser task whenever React mounts the modal
  // synchronously. If the button is not present until React's queued update,
  // use a microtask rather than waiting for a painted animation frame. The old
  // two-frame bridge deliberately exposed the intermediate unselected launcher,
  // which caused the visible "New Transaction / What would you like to add?"
  // flash reported on iPhone when switching creation types.
  document.getElementById('dashboard-add-btn')?.click();
  selectUnifiedTransactionType(type);
  queueMicrotask(() => selectUnifiedTransactionType(type));
}

function removeInFieldHelperText(root: ParentNode = document): void {
  const unifiedRoots = root.querySelectorAll<HTMLElement>(
    '.mv-transaction-modal:has(.mv-transaction-type-tab[aria-label="Add bill"]), .mv-add-bill-modal[data-unified-add="true"]'
  );

  unifiedRoots.forEach((modal) => {
    modal.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[placeholder]').forEach((control) => {
      control.removeAttribute('placeholder');
    });

    modal.querySelectorAll<HTMLSelectElement>('select').forEach((select) => {
      const emptyOption = Array.from(select.options).find((option) => option.value === '');
      if (emptyOption && emptyOption.textContent !== '') emptyOption.textContent = '';
    });
  });
}

// Bill remains PlannedPayment-only. These events preserve one visual launcher
// across the two existing persistence workflows without coupling their saves.
if (typeof window !== 'undefined') {
  window.addEventListener(OPEN_BILL_EVENT, () => {
    window.sessionStorage.setItem(UNIFIED_BILL_SESSION_KEY, '1');
  });

  window.addEventListener(SWITCH_UNIFIED_TYPE_EVENT, (event) => {
    const type = (event as CustomEvent<{ type?: string }>).detail?.type;
    if (!isUnifiedTransactionType(type)) return;
    openFreshUnifiedTransaction(type);
  });

  // Transaction types share the same modal component. A plain in-place type
  // change would otherwise retain unsaved state such as amount, description,
  // accounts, payer, category, notes or splits. In the unified Add launcher we
  // deliberately remount the form when moving between two ordinary creation
  // types, so each choice starts clean. Nothing is saved or mutated by this.
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as Element | null;
      const button = target?.closest<HTMLButtonElement>('.mv-transaction-type-tab');
      if (!button) return;
      if (isSelectingUnifiedType) return;

      const modal = button.closest<HTMLElement>('.mv-transaction-modal');
      if (!modal?.querySelector('.mv-transaction-type-tab[aria-label="Add bill"]')) return;

      const label = button.getAttribute('aria-label') || '';
      const nextType = label.startsWith('Add ') ? label.slice(4) : undefined;
      if (!isUnifiedTransactionType(nextType)) return;

      const active = modal.querySelector<HTMLButtonElement>(
        '.mv-transaction-type-tab[aria-pressed="true"]'
      );
      if (!active || active === button) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      modal
        .querySelector<HTMLButtonElement>('[aria-label="Close transaction dialog"]')
        ?.click();
      openFreshUnifiedTransaction(nextType);
    },
    true
  );

  const sanitize = () => removeInFieldHelperText(document);
  sanitize();
  const observer = new MutationObserver(sanitize);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
