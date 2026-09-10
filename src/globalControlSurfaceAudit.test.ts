import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const read = (relativePath: string) => fs.readFileSync(path.join(src, relativePath), 'utf8');

const surfaceCss = read('globalControlSurface.css');
const indexCss = read('index.css');
const main = read('main.tsx');
const transactionDateCss = fs.readFileSync(
  path.resolve(process.cwd(), 'public', 'iphone-transaction-date-fix.css'),
  'utf8'
);
const billDateCss = read('unifiedAddIphoneDateContainment.css');
const unifiedAddUi = read('components/UnifiedAddUi.tsx');
const fundingModal = read('components/ExecuteTransferModal.tsx');

describe('global field-surface contract', () => {
  it('uses the Account-field theme token as the global value-entry surface', () => {
    expect(indexCss).toMatch(/\[data-theme="slate"\][\s\S]*?--field:\s*#1f2937;/i);
    expect(indexCss).toMatch(/\[data-theme="dark"\][\s\S]*?--field:\s*#111522;/i);
    expect(indexCss).toMatch(/\[data-theme="light"\][\s\S]*?--field:\s*#ffffff;/i);
    expect(surfaceCss).toContain('background-color: var(--field) !important;');
  });

  it('covers native entry fields and native selectors globally in PC and Phone modes', () => {
    expect(surfaceCss).toContain('.mv-density-root:is(.mv-layout-pc, .mv-layout-phone)');
    expect(surfaceCss).toContain('input:not([type="checkbox"])');
    expect(surfaceCss).toContain('select,');
    expect(surfaceCss).toContain('textarea,');
  });

  it('covers semantic custom value selectors without recolouring general buttons or menu panels', () => {
    expect(surfaceCss).toContain('button[aria-haspopup="listbox"]');
    expect(surfaceCss).toContain('[role="combobox"]');
    expect(unifiedAddUi).toContain('aria-haspopup="listbox"');
    expect(fundingModal).toContain('aria-haspopup="listbox"');
    expect(surfaceCss).not.toMatch(/(?:^|\n)\s*button\s*[,\{]/);
    expect(surfaceCss).not.toContain('[role="option"]');
    expect(surfaceCss).not.toContain('[role="menuitem"]');
  });

  it('keeps non-field controls outside the global surface rule', () => {
    for (const type of [
      'checkbox',
      'radio',
      'range',
      'file',
      'color',
      'hidden',
      'button',
      'submit',
      'reset',
      'image',
    ]) {
      expect(surfaceCss).toContain(`:not([type="${type}"])`);
    }
  });

  it('loads after legacy, responsive and unified-Add visual layers so one surface token wins globally', () => {
    const surfaceImport = main.indexOf("import './globalControlSurface.css';");
    expect(surfaceImport).toBeGreaterThan(main.indexOf("import './index.css';"));
    expect(surfaceImport).toBeGreaterThan(main.indexOf("import './globalDesignSystem.css';"));
    expect(surfaceImport).toBeGreaterThan(main.indexOf("import './mobileUx.css';"));
    expect(surfaceImport).toBeGreaterThan(main.indexOf("import './unifiedAddConsistency.css';"));
    expect(surfaceImport).toBeGreaterThan(main.indexOf("import './unifiedAddSelectIndicator.css';"));
    expect(surfaceImport).toBeGreaterThan(main.indexOf("import './unifiedAddIphoneDateContainment.css';"));
  });

  it('changes only field background colour and does not redefine typography, geometry or indicators', () => {
    expect(surfaceCss).not.toContain('font-size');
    expect(surfaceCss).not.toContain('line-height');
    expect(surfaceCss).not.toContain('width:');
    expect(surfaceCss).not.toContain('height:');
    expect(surfaceCss).not.toContain('padding:');
    expect(surfaceCss).not.toContain('border:');
    expect(surfaceCss).not.toContain('appearance:');
    expect(surfaceCss).not.toContain('background-image');
  });

  it('gives the physically repaired iPhone transaction Date the same field surface without weakening containment', () => {
    expect(transactionDateCss).toContain('background-color: var(--field) !important;');
    expect(transactionDateCss).not.toContain('background: transparent !important;');
    expect(transactionDateCss).toContain('inline-size: 100% !important;');
    expect(transactionDateCss).toContain('max-inline-size: 100% !important;');
    expect(transactionDateCss).toContain('overflow: hidden');
    expect(transactionDateCss).toContain('::-webkit-calendar-picker-indicator');
  });

  it('preserves the proven Bill Due Date frame, which already renders the shared field surface on its wrapper', () => {
    expect(billDateCss).toContain('background: var(--field);');
    expect(billDateCss).toContain('#unified-bill-due-date');
    expect(billDateCss).toContain('background: transparent !important;');
    expect(billDateCss).toContain('::-webkit-calendar-picker-indicator');
  });
});
