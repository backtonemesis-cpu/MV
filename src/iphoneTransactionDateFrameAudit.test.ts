import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
const css = fs.readFileSync(
  path.resolve(process.cwd(), 'public/iphone-transaction-date-fix.css'),
  'utf8'
);

describe('Actual iPhone transaction date visual frame regression', () => {
  it('loads the dedicated iPhone transaction date containment layer', () => {
    expect(html).toContain('./iphone-transaction-date-fix.css');
  });

  it('clips native Safari date paint inside the transaction field container', () => {
    expect(css).toContain('label[for="transaction-date"]');
    expect(css).toContain('overflow: hidden');
    expect(css).toContain('#transaction-date');
    expect(css).toContain('max-width: 100% !important');
  });

  it('draws one MV-owned field frame instead of relying on Safari input paint', () => {
    expect(css).toContain('::after');
    expect(css).toContain('right: 0');
    expect(css).toContain('left: 0');
    expect(css).toContain('border: 1px solid var(--border)');
    expect(css).toContain('border-radius: 6px');
    expect(css).toContain('border: 0 !important');
    expect(css).toContain('background: transparent !important');
  });

  it('centres the native date value inside the 40px MV frame', () => {
    expect(css).toContain('height: 40px !important');
    expect(css).toContain('line-height: 40px !important');
    expect(css).toContain('::-webkit-date-and-time-value');
    expect(css).toContain('min-height: 40px');
    expect(css).toContain('text-align: left');
  });

  it('keeps the full date field tappable while hiding native chrome', () => {
    expect(css).toContain('-webkit-appearance: none');
    expect(css).toContain('appearance: none');
    expect(css).toContain('::-webkit-calendar-picker-indicator');
    expect(css).toContain('inset: 0');
    expect(css).toContain('opacity: 0');
  });

  it('preserves native date input semantics and only changes presentation', () => {
    const tx = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/TransactionModal.tsx'),
      'utf8'
    );
    expect(tx).toContain('id="transaction-date"');
    expect(tx).toContain('type="date"');
    expect(tx).toContain('value={date}');
    expect(tx).toContain('onChange={(e) => setDate(e.target.value)}');
  });
});
