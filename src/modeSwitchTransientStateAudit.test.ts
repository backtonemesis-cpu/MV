import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const app = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
const navigation = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/Navigation.tsx'),
  'utf8'
);

describe('GA-MODE-001 layout-mode transient-state regression', () => {
  it('keeps layout mode persisted and mirrored to the document root', () => {
    expect(app).toContain("const LAYOUT_MODE_STORAGE_KEY = 'mv-layout-mode-v1';");
    expect(app).toContain('window.localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, layoutMode);');
    expect(app).toContain('document.documentElement.dataset.layoutMode = layoutMode;');
    expect(app).toContain("layoutMode === 'phone' ? 'mv-layout-phone' : 'mv-layout-pc'");
  });

  it('clears the Phone-only More menu whenever layout mode changes', () => {
    expect(navigation).toContain('const observer = new MutationObserver((mutations) => {');
    expect(navigation).toContain("mutation.attributeName === 'data-layout-mode'");
    expect(navigation).toContain('setIsMoreOpen(false);');
    expect(navigation).toContain("attributeFilter: ['data-layout-mode']");
    expect(navigation).toContain('return () => observer.disconnect();');
  });

  it('preserves existing active-tab and explicit navigation cleanup', () => {
    expect(navigation).toContain('}, [activeTab]);');
    expect(navigation).toContain('const navigate = (tab: NavTab) => {');
    expect(navigation).toContain('setIsMoreOpen(false);\n    onTabChange(tab);');
    expect(navigation).toContain("window.addEventListener('hashchange', syncFromLocation);");
  });
});
