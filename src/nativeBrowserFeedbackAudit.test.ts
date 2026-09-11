import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const activeRuntimeSources = [
  './components/TransferPlanView.tsx',
  './components/SettingsView.tsx',
  './components/SavingsView.tsx',
  './components/AccountsView.tsx',
  './components/IncomeView.tsx',
];

const nativeDialogCall = /\bwindow\.(?:alert|confirm)\s*\(|(^|[^\w.])(?:alert|confirm)\s*\(/m;

describe('native browser feedback contract', () => {
  for (const path of activeRuntimeSources) {
    it(`${path} does not use native browser alert/confirm`, () => {
      expect(source(path)).not.toMatch(nativeDialogCall);
    });
  }

  it('uses an accessible shared destructive confirmation dialog', () => {
    const dialog = source('./components/ConfirmActionDialog.tsx');

    expect(dialog).toContain('useModalAccessibility');
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('aria-modal="true"');
    expect(dialog).toContain('data-modal-initial-focus');
    expect(dialog).toContain('role="alert"');
  });

  it('keeps Transfer Plan mutation failures as persistent accessible feedback', () => {
    const transferPlan = source('./components/TransferPlanView.tsx');

    expect(transferPlan).toContain('selectionError');
    expect(transferPlan).toContain('role="alert"');
    expect(transferPlan).not.toContain('window.alert(');
  });

  it('routes active destructive confirmations through ConfirmActionDialog', () => {
    for (const path of [
      './components/SettingsView.tsx',
      './components/SavingsView.tsx',
      './components/AccountsView.tsx',
      './components/IncomeView.tsx',
    ]) {
      expect(source(path)).toContain("from './ConfirmActionDialog'");
      expect(source(path)).toContain('<ConfirmActionDialog');
    }
  });

  it('keeps the legacy MembersView source outside the active App runtime', () => {
    const app = source('./App.tsx');
    expect(app).not.toContain("from './components/MembersView'");
    expect(app).not.toContain('<MembersView');
  });
});
