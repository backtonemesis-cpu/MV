import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/AccountsView.tsx'),
  'utf8'
);

const editBlock =
  source.match(/\{\/\* MODAL: Edit Account \*\/[\s\S]*?\{\/\* MODAL: Reconcile Balance \*\//)?.[0] ?? '';

describe('Accounts Edit Account submenu audit contract', () => {
  it('does not force focus into the edit form on open', () => {
    expect(editBlock).not.toContain('autoFocus');
  });

  it('visibly marks required edit fields and associates their labels', () => {
    expect(editBlock).toContain('Account Name *');
    expect(editBlock).toContain('Owner *');
    expect(editBlock).toContain('Type *');

    for (const id of [
      'account-edit-name',
      'account-edit-owner',
      'account-edit-type',
      'account-edit-notes',
    ]) {
      expect(editBlock).toContain('htmlFor="' + id + '"');
      expect(editBlock).toContain('id="' + id + '"');
    }
  });

  it('keeps the complete editable account-type set and preserves legacy joint type only when linked', () => {
    expect(editBlock).toContain('<option value="current">Current Account</option>');
    expect(editBlock).toContain('<option value="savings">Savings Account</option>');
    expect(editBlock).toContain('<option value="cash">Cash</option>');
    expect(editBlock).toContain('<option value="credit">Credit Card</option>');
    expect(editBlock).toContain("selectedAccount.type === 'joint'");
    expect(editBlock).toContain('<option value="joint">Joint Current (legacy)</option>');
  });

  it('does not silently ignore a blank account name', () => {
    expect(source).toContain("if (!editName.trim()) {");
    expect(source).toContain("setError('Enter an account name.')");
  });

  it('announces validation errors and gives Status a programmatic label', () => {
    expect(editBlock).toContain('<div role="alert"');
    expect(editBlock).toContain('id="account-edit-status-label"');
    expect(editBlock).toContain('id="account-edit-status-text"');
    expect(editBlock).toContain('aria-labelledby="account-edit-status-label account-edit-status-text"');
  });

  it('preserves removed-owner historical identity when editing', () => {
    expect(source).toContain('const editOwnerOptions = useMemo(() => {');
    expect(source).toContain('(removed)');
  });
});
