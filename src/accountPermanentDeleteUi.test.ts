import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(process.cwd(), 'src');
const read = (relativePath: string) => fs.readFileSync(path.join(SRC, relativePath), 'utf8');

describe('Permanent account deletion UI contract', () => {
  it('shows Delete permanently only from authoritative eligibility', () => {
    const accounts = read('components/AccountsView.tsx');

    expect(accounts).toContain('accountDeleteEligibility[acc.id]?.canDeletePermanently');
    expect(accounts).toContain('Delete permanently');
    expect(accounts).toContain('onArchiveAccount');
    expect(accounts).toContain('onPermanentDeleteAccount');
    expect(accounts).not.toContain("{isArchived ? 'Delete' : 'Archive'}");
  });

  it('uses the shared accessible modal contract with a clear destructive confirmation', () => {
    const accounts = read('components/AccountsView.tsx');

    expect(accounts).toContain("showDeleteAccountModal");
    expect(accounts).toContain('role="dialog"');
    expect(accounts).toContain('aria-modal="true"');
    expect(accounts).toContain('aria-label={dialogLabel}');
    expect(accounts).toContain('data-modal-initial-focus');
    expect(accounts).toContain('Penny will re-check that the account still has no financial history or references immediately before deletion.');
    expect(accounts).toContain('It cannot be undone.');
  });

  it('identifies the exact account by name, type, and owner in confirmation', () => {
    const accounts = read('components/AccountsView.tsx');

    expect(accounts).toContain('{deleteAccountTarget.name}');
    expect(accounts).toContain('{deleteAccountTarget.type}');
    expect(accounts).toContain('deleteAccountTarget.ownerMemberId === JOINT_ACCOUNT_OWNER_ID');
  });

  it('warns when deletion will remove an isolated mistaken setup balance', () => {
    const accounts = read('components/AccountsView.tsx');

    expect(accounts).toContain('isolatedSetupBalancePence');
    expect(accounts).toContain('isolated setup balance');
    expect(accounts).toContain('no linked financial evidence exists');
  });

  it('prevents repeated confirmation while the mutation is in flight', () => {
    const accounts = read('components/AccountsView.tsx');

    expect(accounts).toContain('if (!deleteAccountTarget || isSubmitting) return;');
    expect(accounts).toContain('disabled={isSubmitting}');
    expect(accounts).toContain("{isSubmitting ? 'Deleting…' : 'Delete permanently'}");
  });
});
