import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const settingsPath = path.resolve(process.cwd(), 'src/components/SettingsView.tsx');
const cssPath = path.resolve(process.cwd(), 'src/globalDesignSystem.css');
const settings = fs.readFileSync(settingsPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

const phoneRepairStart = css.indexOf(
  '/* PHONE-SET-001: keep the five Settings tabs in one horizontal strip in Phone mode. */'
);
const phoneRepair = phoneRepairStart >= 0 ? css.slice(phoneRepairStart) : '';

describe('PHONE-SET-001 Settings tab strip', () => {
  it('keeps all five Settings destinations in the semantic tablist', () => {
    expect(settings).toContain('aria-label="Settings sections"');
    expect(settings.match(/role="tab"/g)?.length).toBe(5);
    expect(settings).toContain('>\n            Categories\n          </button>');
    expect(settings).toContain('>Appearance</span>');
    expect(settings).toContain('>Household</span>');
    expect(settings).toContain('>Audit</span>');
    expect(settings).toContain('>Backup</span>');
  });

  it('turns the existing two-column wrapper into one non-wrapping horizontal row in Phone mode', () => {
    expect(phoneRepairStart).toBeGreaterThanOrEqual(0);
    expect(phoneRepair).toContain('.mv-layout-phone .mv-settings-tabs > .grid');
    expect(phoneRepair).toContain('display: flex !important;');
    expect(phoneRepair).toContain('width: max-content !important;');
    expect(phoneRepair).toContain('min-width: 100% !important;');
    expect(phoneRepair).toContain('flex-wrap: nowrap !important;');
  });

  it('keeps each Phone-mode tab as an individual non-wrapping scroll item', () => {
    expect(phoneRepair).toContain('.mv-layout-phone .mv-settings-tabs > .grid > .mv-settings-tab');
    expect(phoneRepair).toContain('flex: 0 0 auto !important;');
    expect(phoneRepair).toContain('white-space: nowrap !important;');
  });

  it('preserves horizontal overflow on the Settings tablist instead of clipping destinations', () => {
    expect(css).toContain('.mv-layout-phone .mv-settings-tabs');
    expect(css).toContain('overflow-x: auto');
    expect(css).toContain('-webkit-overflow-scrolling: touch');
  });
});
