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

// Unified Add now stays inside one React modal shell for Expense, Income,
// Transfer, Refund, Repayment and Bill. Do not intercept tab clicks or remount
// the form: TransactionModal owns fresh-state isolation while preserving Date.
if (typeof window !== 'undefined') {
  const sanitize = () => removeInFieldHelperText(document);
  sanitize();
  const observer = new MutationObserver(sanitize);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
