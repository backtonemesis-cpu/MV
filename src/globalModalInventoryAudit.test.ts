import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const COMPONENTS = path.join(ROOT, 'src', 'components');
const indexCss = fs.readFileSync(path.join(ROOT, 'src', 'index.css'), 'utf8');
const modalHelper = fs.readFileSync(path.join(ROOT, 'src', 'utils', 'modalAccessibility.ts'), 'utf8');

function walkTsx(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkTsx(full);
    return entry.isFile() && entry.name.endsWith('.tsx') ? [full] : [];
  });
}

function source(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

const dialogFiles = walkTsx(COMPONENTS)
  .map((file) => ({ file, source: source(file) }))
  .filter(({ source }) => source.includes('aria-modal="true"'));

describe('global modal inventory and shared containment contract', () => {
  it('finds the current rendered modal inventory rather than relying on a hand-written component list', () => {
    expect(dialogFiles.length).toBeGreaterThan(0);
  });

  it('routes every rendered aria-modal dialog through the shared modal accessibility stack', () => {
    for (const { file, source } of dialogFiles) {
      const name = path.relative(COMPONENTS, file);
      expect(source, name).toContain('useModalAccessibility');
      expect(source, name).toContain('role="dialog"');
      expect(source, name).toContain('tabIndex={-1}');
    }
  });

  it('keeps one shared top-modal Escape/Tab, focus-return, inert-background and body-lock implementation', () => {
    expect(modalHelper).toContain('const modalStack: ModalEntry[] = []');
    expect(modalHelper).toContain('if (!isTopModal(modalId)) return');
    expect(modalHelper).toContain("event.key === 'Escape'");
    expect(modalHelper).toContain("event.key !== 'Tab'");
    expect(modalHelper).toContain('sibling.inert = true');
    expect(modalHelper).toContain("sibling.setAttribute('aria-hidden', 'true')");
    expect(modalHelper).toContain("document.body.style.overflow = 'hidden'");
    expect(modalHelper).toContain('returnTarget.focus({ preventScroll: true })');
  });

  it('keeps shared modal cards bounded with one scrolling body and non-scrolling actions', () => {
    expect(indexCss).toContain('.mv-modal-card {');
    expect(indexCss).toContain('max-height: min(88vh, 760px);');
    expect(indexCss).toContain('overflow: hidden;');
    expect(indexCss).toContain('.mv-modal-scroll-body {');
    expect(indexCss).toContain('overflow-y: auto;');
    expect(indexCss).toContain('.mv-modal-fixed-actions {');
    expect(indexCss).toContain('flex: 0 0 auto;');
  });

  it('keeps Phone-mode modal geometry inside the app viewport with touch-sized footer actions', () => {
    expect(indexCss).toContain('.mv-layout-phone .mv-modal-backdrop');
    expect(indexCss).toContain('align-items: flex-end');
    expect(indexCss).toContain('.mv-layout-phone .mv-modal-actions button');
    expect(indexCss).toContain('.mv-layout-phone .mv-modal-fixed-actions button');
    expect(indexCss).toContain('min-height: 44px !important;');
    expect(indexCss).toContain('env(safe-area-inset-bottom)');
  });

  it('keeps modal infrastructure independent from finance and persistence mutation', () => {
    expect(modalHelper).not.toContain('localStorage');
    expect(modalHelper).not.toContain('amountPence');
    expect(modalHelper).not.toContain('accountId');
  });
});
