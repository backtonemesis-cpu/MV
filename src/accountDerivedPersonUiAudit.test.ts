import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('account-derived person entry UI', () => {
  it('does not ask for Paid by or Received by when the account already owns attribution', () => {
    const source = read('src/components/TransactionModal.tsx');
    expect(source).not.toContain("'Received by'");
    expect(source).not.toContain("'Paid by'");
    expect(source).not.toContain('transaction-person-label');
    expect(source).toContain('resolveAccountOwnerPayer(sourceAccount, members)');
  });

  it('does not ask for a separate Responsible Person on bills', () => {
    const source = read('src/components/PlannedPaymentModal.tsx');
    expect(source).not.toContain('Responsible Person *');
    expect(source).not.toContain('planned-payment-person');
    expect(source).toContain('resolveAccountOwnerPayer(selectedAccount, members)');
  });

  it('preserves a Bill historical responsible person when its payment account is unchanged', () => {
    const source = read('src/components/PlannedPaymentModal.tsx');
    expect(source).toContain('payment && payment.accountId === accountId');
    expect(source).toContain('? payment.responsiblePerson');
    expect(source).toContain(': resolveAccountOwnerPayer(selectedAccount, members)');
  });
});
