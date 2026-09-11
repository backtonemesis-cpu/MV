import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const componentsDir = path.resolve(process.cwd(), 'src/components');
const read = (name: string) =>
  fs.readFileSync(path.join(componentsDir, name), 'utf8');

const navigation = read('Navigation.tsx');
const activity = read('TransactionList.tsx');
const income = read('IncomeView.tsx');
const savings = read('SavingsView.tsx');
const accounts = read('AccountsView.tsx');
const transactionModal = read('TransactionModal.tsx');

describe('Reachable control accessibility audit', () => {
  it('keeps mobile More disclosure links after the More trigger in forward DOM order', () => {
    const gridIndex = navigation.indexOf(
      'className="mv-mobile-nav-grid grid grid-cols-5 h-14"'
    );
    const panelIndex = navigation.indexOf('id="mobile-more-navigation"');

    expect(gridIndex).toBeGreaterThanOrEqual(0);
    expect(panelIndex).toBeGreaterThan(gridIndex);
    expect(navigation).toContain('aria-expanded={isMoreOpen}');
    expect(navigation).toContain('aria-controls="mobile-more-navigation"');
  });

  it('does not expose finance articles as unnamed pseudo-buttons in the tab order', () => {
    expect(activity).not.toContain('tabIndex={canEditRow ? 0 : undefined}');
    expect(income).not.toContain('tabIndex={canEdit ? 0 : undefined}');
    expect(activity).not.toContain(
      "if (event.key === 'Enter' || event.key === ' ')"
    );
    expect(income).not.toContain(
      "if (event.key === 'Enter' || event.key === ' ')"
    );
    expect(activity).toContain('aria-label={`Edit ${tx.description}`}');
    expect(income).toContain('aria-label={`Edit ${income.name}`}');
  });

  it('does not autofocus ordinary text inputs in Income, Savings, or Accounts dialogs', () => {
    for (const [name, source] of [
      ['IncomeView.tsx', income],
      ['SavingsView.tsx', savings],
      ['AccountsView.tsx', accounts],
    ] as const) {
      const autoFocusedInputs =
        source.match(/<input\b[^>]*\bautoFocus\b[^>]*>/gs) || [];
      expect(autoFocusedInputs, name).toHaveLength(0);
    }
  });

  it('gives every shared modal-close button an explicit accessible name', () => {
    const files = fs
      .readdirSync(componentsDir)
      .filter((name) => name.endsWith('.tsx'));

    for (const name of files) {
      const source = read(name);
      let cursor = 0;

      while (true) {
        const classIndex = source.indexOf(
          'className="mv-modal-close"',
          cursor
        );
        if (classIndex < 0) break;

        const buttonStart = source.lastIndexOf('<button', classIndex);
        const openingEnd = source.indexOf('>', classIndex);

        expect(
          buttonStart,
          `${name}: modal close must be a button`
        ).toBeGreaterThanOrEqual(0);
        expect(
          openingEnd,
          `${name}: modal close opening tag`
        ).toBeGreaterThan(classIndex);

        const openingTag = source.slice(buttonStart, openingEnd + 1);
        expect(
          openingTag,
          `${name}: modal close accessible name`
        ).toContain('aria-label=');

        cursor = openingEnd + 1;
      }
    }
  });

  it('uses an explicit row-specific accessible name for split removal', () => {
    expect(transactionModal).toContain(
      'aria-label={`Remove split ${idx + 1}`}'
    );
  });
});
