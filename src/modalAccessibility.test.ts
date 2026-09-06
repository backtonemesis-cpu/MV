import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(process.cwd(), 'src');
const read = (relativePath: string) => fs.readFileSync(path.join(SRC, relativePath), 'utf8');

describe('Stage 4 accessibility and responsive regression contract', () => {
  it('installs the global modal accessibility guard before the app renders', () => {
    const main = read('main.tsx');
    expect(main).toContain("import { installModalAccessibility } from './utils/modalAccessibility'");
    expect(main).toContain('installModalAccessibility();');
  });

  it('enforces modal semantics, contained focus, labelled controls and focus restoration', () => {
    const modal = read('utils/modalAccessibility.ts');
    expect(modal).toContain(".mv-modal-backdrop .mv-modal-card");
    expect(modal).toContain("dialog.setAttribute('role', 'dialog')");
    expect(modal).toContain("dialog.setAttribute('aria-modal', 'true')");
    expect(modal).toContain("dialog.setAttribute('aria-labelledby', title.id)");
    expect(modal).toContain("button.setAttribute('aria-label', 'Close dialog')");
    expect(modal).toContain('label.htmlFor = control.id');
    expect(modal).toContain("if (event.key !== 'Tab') return");
    expect(modal).toContain('(event.shiftKey ? last : first).focus()');
    expect(modal).toContain('if (target?.isConnected) target.focus()');
  });

  it('retains the previously repaired PC/Phone controls and iPhone-safe sizing', () => {
    const header = read('components/Header.tsx');
    const design = read('globalDesignSystem.css');

    expect(header).toContain('aria-label="App display mode"');
    expect(header).toContain('aria-label="Use PC layout"');
    expect(header).toContain('aria-label="Use Phone layout"');
    expect(header).toContain("aria-pressed={layoutMode === 'pc'}");
    expect(header).toContain("aria-pressed={layoutMode === 'phone'}");

    expect(design).toContain('--mv-ds-click-target: 2.75rem');
    expect(design).toContain('--mv-ds-control-large: 2.75rem');
    expect(design).toContain('env(safe-area-inset-bottom)');
    expect(design).toContain('.mv-layout-phone .mv-nav-mobile');
  });
});
