import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/AccountsView.tsx'),
  'utf8'
);

const archiveBlock =
  source.match(/\{\/\* MODAL: Archive account confirmation \*\/[\s\S]*?\{\/\* MODAL: Permanent account deletion \*\//)?.[0] ?? '';

describe('Accounts Archive submenu audit contract', () => {
  it('uses an in-app accessible confirmation instead of browser confirm', () => {
    expect(source).not.toContain('confirm(`Archive');
    expect(archiveBlock).toContain('role="dialog"');
    expect(archiveBlock).toContain('aria-modal="true"');
    expect(archiveBlock).toContain('Archive account');
    expect(archiveBlock).toContain('data-modal-initial-focus');
  });

  it('shows unambiguous account identity, balance and archive consequences', () => {
    expect(archiveBlock).toContain('accountIdentityLabel(archiveAccountTarget)');
    expect(archiveBlock).toContain('formatPence(');
    expect(archiveBlock).toContain('Existing financial history and references will be preserved.');
    expect(archiveBlock).toContain('blocked from new financial activity until reactivated');
  });

  it('requires an explicit Archive account action and keeps Cancel safe', () => {
    expect(archiveBlock).toContain('onClick={handleArchiveConfirmed}');
    expect(archiveBlock).toContain("'Archiving…' : 'Archive account'");
    expect(archiveBlock).toContain('Cancel');
  });

  it('removes the generic Edit-status bypass and provides an explicit Reactivate action', () => {
    expect(source).not.toContain('setEditIsActive');
    expect(source).not.toContain('isActive: editIsActive');
    expect(source).toContain("selectedAccount.isActive === false ? 'Archived' : 'Active'");
    expect(source).toContain('onClick={() => handleReactivate(acc)}');
    expect(source).toContain('Reactivate');
  });

  it('keeps archive errors inside the dialog for assistive technology', () => {
    expect(archiveBlock).toContain('<div role="alert"');
  });
});
