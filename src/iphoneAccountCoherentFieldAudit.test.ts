import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(process.cwd(), 'src');
const read = (relativePath: string) => fs.readFileSync(path.join(SRC, relativePath), 'utf8');

describe('Step 44 iPhone Account coherent selected-state presentation', () => {
  it('keeps the native Account select as the real control and masks only its closed selected text on Phone mode', () => {
    const modal = read('components/TransactionModal.tsx');
    const css = read('mobileUx.css');

    expect(modal).toContain('id="transaction-account"');
    expect(modal).toContain('value={accountId}');
    expect(modal).toContain('onChange={(e) => setAccountId(e.target.value)}');
    expect(css).toContain('> #transaction-account {');
    expect(css).toContain('color: transparent !important;');
    expect(css).toContain('#transaction-account > option');
    expect(css).toContain('color: CanvasText;');
  });

  it('keeps the authoritative account identity inside the Account field face and balance secondary', () => {
    const modal = read('components/TransactionModal.tsx');
    const css = read('mobileUx.css');

    expect(modal).toContain('{accountIdentityLabel(selectedAccount)}');
    expect(modal).toContain('Balance: {formatPence(selectedAccount.currentBalancePence)}');
    expect(css).toContain('.mv-selected-account-identity');
    expect(css).toContain('grid-row: 2;');
    expect(css).toContain('pointer-events: none;');
    expect(css).toContain('.mv-selected-account-balance');
    expect(css).toContain('grid-row: 3;');
  });

  it('matches Account and Category outer width without introducing a generic select override', () => {
    const css = read('mobileUx.css');
    expect(css).toContain('#transaction-account.mv-transaction-control');
    expect(css).toContain('#transaction-category.mv-transaction-control');
    expect((css.match(/width: calc\(100% \+ 12px\) !important;/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(css).not.toContain('.mv-layout-phone select.mv-transaction-control {');
  });
});
