import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(process.cwd(), 'src');
const read = (relativePath: string) => fs.readFileSync(path.join(SRC, relativePath), 'utf8');

describe('Stage 6 mobile and iPhone regression contract', () => {
  it('loads mobile audit overrides after the global design system', () => {
    const main = read('main.tsx');
    expect(main).toContain("import './globalDesignSystem.css';");
    expect(main).toContain("import './mobileUx.css';");
    expect(main.indexOf("import './mobileUx.css';")).toBeGreaterThan(
      main.indexOf("import './globalDesignSystem.css';")
    );
  });

  it('keeps Phone-mode bottom navigation attached to the physical viewport', () => {
    const css = read('mobileUx.css');
    expect(css).toContain('.mv-layout-phone .mv-nav-mobile');
    expect(css).toContain('position: fixed !important');
    expect(css).toContain('inset: auto 0 0 0 !important');
    expect(css).toContain('width: 100vw !important');
  });

  it('keeps routine mobile form controls at the 16px body token and width-safe', () => {
    const css = read('mobileUx.css');
    expect(css).toContain('input:not([type="checkbox"]):not([type="radio"])');
    expect(css).toContain('font-size: var(--mv-ds-text-body) !important');
    expect(css).toContain('min-width: 0 !important');
    expect(css).toContain('max-width: 100% !important');
  });

  it('keeps physical-phone header controls named and the PC/Phone escape hatch intact', () => {
    const header = read('components/Header.tsx');
    const design = read('globalDesignSystem.css');

    expect(header).toContain('aria-label="Open backup and restore"');
    expect(header).toContain("aria-label={isLoading ? 'Refreshing household data' : 'Refresh household data'}");
    expect(header).toContain("aria-label={isPrivacyMasked ? 'Show balances' : 'Mask balances'}");
    expect(header).toContain('aria-label="Use PC layout"');
    expect(header).toContain('aria-label="Use Phone layout"');
    expect(header).toContain("aria-pressed={layoutMode === 'pc'}");
    expect(header).toContain("aria-pressed={layoutMode === 'phone'}");

    expect(design).toContain('PHYSICAL PHONE HEADER ESCAPE HATCH');
    expect(design).toContain('width: 10rem !important');
    expect(design).toContain('min-height: var(--mv-ds-control-large) !important');
    expect(design).toContain('env(safe-area-inset-bottom)');
  });

  it('exposes active destinations in desktop and mobile navigation', () => {
    const navigation = read('components/Navigation.tsx');
    expect(navigation).toContain('aria-label="Primary navigation"');
    expect(navigation).toContain('aria-label="Mobile navigation"');
    expect(navigation).toContain("aria-current={isActive ? 'page' : undefined}");
    expect(navigation).toContain("aria-controls={isMoreOpen ? 'mobile-more-navigation' : undefined}");
  });

  it('uses the shared modal accessibility contract for the command palette', () => {
    const palette = read('components/CommandPalette.tsx');
    expect(palette).toContain("import { useModalAccessibility } from '../utils/modalAccessibility'");
    expect(palette).toContain('useModalAccessibility<HTMLElement>(isOpen, onClose)');
    expect(palette).toContain('role="dialog"');
    expect(palette).toContain('aria-modal="true"');
    expect(palette).toContain('ref={dialogRef}');
    expect(palette).not.toContain('role="listbox"');
    expect(palette).not.toContain('role="option"');
  });
});
