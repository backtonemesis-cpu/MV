const UNIFIED_BILL_SESSION_KEY = 'mv-unified-add-bill';
const UNIFIED_ADD_SESSION_KEY = 'mv-unified-add-launcher';
const OPEN_BILL_EVENT = 'mv:open-planned-payment';
const SWITCH_UNIFIED_TYPE_EVENT = 'mv:switch-unified-add-type';

// Bill remains PlannedPayment-only. These events preserve one visual launcher
// across the two existing persistence workflows without coupling their saves.
if (typeof window !== 'undefined') {
  window.addEventListener(OPEN_BILL_EVENT, () => {
    window.sessionStorage.setItem(UNIFIED_BILL_SESSION_KEY, '1');
  });

  window.addEventListener(SWITCH_UNIFIED_TYPE_EVENT, (event) => {
    const type = (event as CustomEvent<{ type?: string }>).detail?.type;
    if (!type || !['expense', 'income', 'transfer', 'refund', 'repayment'].includes(type)) return;

    window.sessionStorage.removeItem(UNIFIED_BILL_SESSION_KEY);
    window.sessionStorage.setItem(UNIFIED_ADD_SESSION_KEY, '1');

    window.requestAnimationFrame(() => {
      document.getElementById('dashboard-add-btn')?.click();
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>(`.mv-transaction-type-tab[aria-label="Add ${type}"]`)?.click();
      });
    });
  });
}
