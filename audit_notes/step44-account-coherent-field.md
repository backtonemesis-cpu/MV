Step 44 iPhone Account selected-state presentation repair.

Scope: presentation only.

- Preserve native transaction-account select, option values, accountId binding, active/historical rules, transfer/repayment filtering, and accountOptionLabel() picker content.
- Match Account outer width to the already-passed Category outer width in Phone mode.
- When an account is selected, mask only Safari's closed native selected text; keep picker option rows readable.
- Overlay authoritative accountIdentityLabel(selectedAccount) inside the Account field boundary with pointer-events:none so the native select remains the touch target.
- Show only Balance: formatPence(selectedAccount.currentBalancePence) as the compact secondary line beneath the field.
- No Category semantics, account balances, transaction calculations, or generic select styling changed.

Physical iPhone 13 Safari rendering remains the final gate after deploy.
