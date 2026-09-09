import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(
  path.resolve(process.cwd(), 'src/index.css'),
  'utf8'
);
const modal = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/TransactionModal.tsx'),
  'utf8'
);
const sharedUi = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/UnifiedAddUi.tsx'),
  'utf8'
);

describe('Actual iPhone transaction modal viewport safety', () => {
  it('removes the fixed bottom navigation while the transaction modal is open', () => {
    expect(css).toContain(
      '.mv-layout-phone:has(.mv-transaction-modal) .mv-nav-mobile'
    );
    expect(css).toContain('display: none !important');
  });

  it('reclaims the iPhone safe viewport for the transaction sheet', () => {
    expect(css).toContain(
      '.mv-layout-phone:has(.mv-transaction-modal) .mv-modal-backdrop'
    );
    expect(css).toContain(
      'height: min(680px, calc(100% - 16px - env(safe-area-inset-bottom))) !important'
    );
    expect(css).toContain(
      'max-height: calc(100% - 16px - env(safe-area-inset-bottom)) !important'
    );
  });

  it('keeps a fixed header/footer structure with only the form body scrolling', () => {
    expect(modal).toContain('className="mv-modal-header"');
    expect(modal).toContain('className="mv-modal-scroll-body mv-transaction-body"');
    expect(modal).toContain('<UnifiedAddFooter');
    expect(sharedUi).toContain('mv-modal-fixed-actions');
    expect(css).toContain(
      '.mv-layout-phone:has(.mv-transaction-modal) .mv-transaction-body'
    );
    expect(css).toContain('overflow-y: auto !important');
  });

  it('does not touch transaction amounts, dates or save logic', () => {
    expect(modal).toContain('amountPence: pence');
    expect(modal).toContain('date,');
    expect(modal).toContain('await onSave({');
  });
  it('contains the native iPhone date input within its one-column grid cell', () => {
    expect(css).toContain(
      '.mv-layout-phone .mv-transaction-modal .mv-modal-grid-2 > *'
    );
    expect(css).toContain('min-width: 0');
    expect(css).toContain(
      '.mv-layout-phone .mv-transaction-modal input[type="date"].mv-transaction-control'
    );
    expect(css).toContain('width: 100% !important');
    expect(css).toContain('max-width: 100% !important');
    expect(css).toContain('box-sizing: border-box');
  });

});
