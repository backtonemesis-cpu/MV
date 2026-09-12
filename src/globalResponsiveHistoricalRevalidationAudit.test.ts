import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(process.cwd(), 'src');
const read = (relativePath: string) => fs.readFileSync(path.join(SRC, relativePath), 'utf8');

const transaction = read('components/TransactionModal.tsx');
const audit = read('components/AuditLogView.tsx');
const savings = read('components/SavingsView.tsx');
const rollover = read('components/MonthImportModal.tsx');
const indexCss = read('index.css');
const mobileCss = read('mobileUx.css');
const designCss = read('globalDesignSystem.css');

describe('GLOBAL-RESPONSIVE-001 historical responsive revalidation', () => {
  it('contains Split Categories inside the transaction body and a local horizontal control rail', () => {
    expect(transaction).toContain('className="mv-modal-scroll-body mv-transaction-body"');
    expect(transaction).toContain('className="mv-hscroll items-center"');
    expect(mobileCss).toContain('.mv-layout-phone .mv-transaction-body {');
    expect(mobileCss).toContain('overflow-x: clip;');
    expect(mobileCss).toContain('overscroll-behavior-inline: none;');
    expect(indexCss).toContain('.mv-hscroll {');
    expect(indexCss).toContain('max-width: 100%;');
    expect(indexCss).toContain('overflow-x: auto;');
  });

  it('keeps Savings Goal actions in the same local horizontal control rail instead of expanding the page', () => {
    expect(savings).toContain('className="mv-hscroll mt-4 pt-3 border-t border-muted"');
    expect(indexCss).toContain('.mv-hscroll {');
    expect(indexCss).toContain('overflow-x: auto;');
    expect(indexCss).toContain('overscroll-behavior-inline: contain;');
  });

  it('bounds Prepare Next Month to the Phone viewport and gives its content one vertical scroll owner', () => {
    expect(rollover).toContain('className="mv-modal-card mv-modal-wide mv-rollover-modal"');
    expect(rollover).toContain('className="mv-modal-form mv-rollover-form"');
    expect(rollover).toContain('className="mv-rollover-scroll"');
    expect(indexCss).toContain('.mv-rollover-scroll {');
    expect(indexCss).toContain('overflow-y: auto;');
    expect(indexCss).toContain('.mv-rollover-scopes,');
    expect(indexCss).toContain('grid-template-columns: 1fr;');
    expect(designCss).toContain('.mv-layout-phone .mv-modal-card.mv-modal-wide');
    expect(designCss).toContain('width: calc(100vw - var(--mv-ds-space-6)) !important;');
    expect(designCss).toContain('max-height: calc(100dvh - var(--mv-ds-space-6) - env(safe-area-inset-bottom)) !important;');
  });

  it('prevents Audit Trail identifiers from forcing page-level horizontal overflow', () => {
    expect(audit).toContain('className="min-w-0 max-w-full space-y-4 pb-12"');
    expect(audit).toContain('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1');
    expect(audit).toContain('min-w-0 break-all font-semibold text-muted');
    expect(audit).toContain('min-w-0 break-all">{entry.entityId}</span>');
    expect(audit).toContain('min-w-0 break-words text-xs text-main font-medium');
  });

  it('keeps raw Audit Trail details locally scrollable rather than forcing the whole page to pan', () => {
    expect(audit).toContain('max-w-full overflow-x-auto rounded-lg');
    expect(audit).toContain('JSON.stringify(entry.details, null, 2)');
  });
});
