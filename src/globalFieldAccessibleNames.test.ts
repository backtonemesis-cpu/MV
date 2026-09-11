import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const componentDir = path.resolve(process.cwd(), 'src', 'components');
const read = (name: string) => fs.readFileSync(path.join(componentDir, name), 'utf8');

function expectLabelPair(source: string, id: string) {
  expect(source).toContain(`htmlFor="${id}"`);
  expect(source).toContain(`id="${id}"`);
}

describe('global editable field accessible-name contract', () => {
  it('associates Income labels with every editable field and keeps Category visibly required', () => {
    const source = read('IncomeView.tsx');

    for (const id of [
      'income-source',
      'income-expected-amount',
      'income-expected-date',
      'income-received-by',
      'income-account',
      'income-category',
      'income-notes',
      'income-actual-amount',
      'income-actual-date',
      'income-receiving-account',
    ]) {
      expectLabelPair(source, id);
    }

    expect(source).toContain('htmlFor="income-category"');
    expect(source).toContain('Category *</label>');
    expect(source).not.toContain('Category (optional)');
  });

  it('associates Payment Details fields with their visible labels', () => {
    const source = read('MarkPaymentPaidModal.tsx');

    for (const id of ['payment-actual-amount', 'payment-actual-date', 'payment-account']) {
      expectLabelPair(source, id);
    }
  });

  it('associates Savings goal and transfer fields in create, edit and transfer flows', () => {
    const source = read('SavingsView.tsx');

    for (const id of [
      'savings-goal-create-name',
      'savings-goal-create-target',
      'savings-goal-create-monthly-plan',
      'savings-goal-create-date',
      'savings-transfer-source',
      'savings-transfer-destination',
      'savings-transfer-amount',
      'savings-goal-edit-name',
      'savings-goal-edit-target',
      'savings-goal-edit-monthly-plan',
      'savings-goal-edit-date',
    ]) {
      expectLabelPair(source, id);
    }
  });

  it('associates the duplicated Accounts savings-goal editor fields without changing account fields', () => {
    const source = read('AccountsView.tsx');

    for (const id of [
      'accounts-goal-create-name',
      'accounts-goal-create-target',
      'accounts-goal-create-monthly-plan',
      'accounts-goal-create-date',
      'accounts-goal-edit-name',
      'accounts-goal-edit-target',
      'accounts-goal-edit-monthly-plan',
      'accounts-goal-edit-date',
    ]) {
      expectLabelPair(source, id);
    }

    expectLabelPair(source, 'account-create-owner');
    expectLabelPair(source, 'account-edit-owner');
  });

  it('gives household access role selectors a meaningful per-member accessible name', () => {
    const source = read('MembersView.tsx');
    expect(source).toContain('aria-label={`Role for ${member.name}`}');
  });

  it('associates Audit Trail search and type-filter controls', () => {
    const source = read('AuditLogView.tsx');
    expectLabelPair(source, 'audit-log-search');
    expectLabelPair(source, 'audit-log-type-filter');
  });

  it('associates Backup & Restore file and JSON inputs in both restore surfaces', () => {
    const modal = read('BackupRestoreModal.tsx');
    const settings = read('SettingsView.tsx');

    expectLabelPair(modal, 'backup-restore-file');
    expectLabelPair(modal, 'backup-restore-json');
    expectLabelPair(settings, 'settings-restore-file');
    expectLabelPair(settings, 'settings-restore-json');
  });

  it('associates Settings household member name fields, including dynamic edit rows', () => {
    const source = read('SettingsView.tsx');
    expectLabelPair(source, 'settings-add-member-name');
    expect(source).toContain('htmlFor={`settings-edit-member-name-${member.id}`}');
    expect(source).toContain('id={`settings-edit-member-name-${member.id}`}');
  });
});
