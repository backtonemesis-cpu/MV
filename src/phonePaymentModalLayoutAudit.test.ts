import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const modal = fs.readFileSync(
  path.join(src, 'components/BulkPaymentStatusModal.tsx'),
  'utf8'
);
const css = fs.readFileSync(path.join(src, 'index.css'), 'utf8');

describe('Phone payment confirmation modal layout regression', () => {
  it('renders above the Phone bottom navigation instead of underneath it', () => {
    const navStart = css.indexOf('.mv-layout-phone .mv-nav-mobile');
    const modalStart = css.indexOf(
      '.mv-layout-phone .mv-modal-backdrop,\n.mv-layout-phone .fixed.inset-0.z-50'
    );
    expect(navStart).toBeGreaterThanOrEqual(0);
    expect(modalStart).toBeGreaterThanOrEqual(0);

    const navBlock = css.slice(navStart, navStart + 500);
    const modalBlock = css.slice(modalStart, modalStart + 700);
    expect(navBlock).toContain('z-index: 80');
    expect(modalBlock).toContain('z-index: 100 !important');
    expect(modalBlock).toContain('env(safe-area-inset-bottom)');
  });

  it('uses a constrained Phone sheet with fixed header/footer and a real scrollable bill list', () => {
    expect(modal).toContain('mv-payment-status-modal');
    expect(modal).toContain('mv-payment-status-form');
    expect(modal).toContain('mv-payment-status-list');
    expect(css).toContain('.mv-layout-phone .mv-payment-status-modal');
    expect(css).toContain('flex-direction: column');
    expect(css).toContain('.mv-layout-phone .mv-payment-status-form');
    expect(css).toContain('overflow: hidden !important');
    expect(css).toContain('.mv-layout-phone .mv-payment-status-list');
    expect(css).toContain('overflow-y: auto !important');
    expect(css).toContain('touch-action: pan-y');
    expect(css).toContain('-webkit-overflow-scrolling: touch');
    expect(css).toContain(
      '.mv-layout-phone .mv-payment-status-modal .mv-modal-actions'
    );
    expect(css).toContain('margin-top: auto !important');
  });

  it('keeps Bills and Total in a compact two-column summary in Phone mode', () => {
    expect(modal).toContain('mv-payment-summary-grid');
    expect(css).toContain(
      '.mv-layout-phone .mv-workspace .grid.mv-payment-summary-grid'
    );
    expect(css).toContain(
      'grid-template-columns: repeat(2, minmax(0, 1fr)) !important'
    );
  });

  it('does not add any new payment or funding mutation path', () => {
    expect(modal).toContain('await onMarkPaid(payments, date)');
    expect(modal).toContain('await onUndoPaid(payments)');
    expect(modal).not.toContain('localStorage');
    expect(modal).not.toContain('executeLocalTransfer');
    expect(modal).not.toContain('markLocalPaymentsPaid');
  });
});
