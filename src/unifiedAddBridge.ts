function removeTextInputHelperText(root: ParentNode = document): void {
  const unifiedRoots = root.querySelectorAll<HTMLElement>(
    '.mv-transaction-modal:has(.mv-transaction-type-tab[aria-label="Add bill"]), .mv-add-bill-modal[data-unified-add="true"]'
  );

  unifiedRoots.forEach((modal) => {
    modal.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[placeholder]').forEach((control) => {
      control.removeAttribute('placeholder');
    });
  });
}

// Unified Add now stays inside one React modal shell for Expense, Income,
// Transfer, Refund, Repayment and Bill. Text-input helper placeholders remain
// suppressed for visual density, but select/account prompts stay visible so an
// empty field is understandable. Do not intercept tab clicks or remount the
// form: TransactionModal owns fresh-state isolation while preserving Date.
if (typeof window !== 'undefined') {
  const sanitize = () => removeTextInputHelperText(document);
  sanitize();
  const observer = new MutationObserver(sanitize);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
