import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const app = fs.readFileSync(
  path.resolve(process.cwd(), 'src/App.tsx'),
  'utf8'
);

describe('Primary navigation scroll reset regression', () => {
  it('routes primary navigation through a single scroll-reset handler', () => {
    expect(app).toContain('const handlePrimaryTabChange = useCallback((tab: NavTab) => {');
    expect(app).toContain('onTabChange={handlePrimaryTabChange}');
    expect(app).toContain('onNavigateToTab={handlePrimaryTabChange}');
    expect(app).toContain('onNavigate={handlePrimaryTabChange}');
  });

  it('resets both the scrollable workspace and window after tab changes', () => {
    expect(app).toContain("document.querySelector<HTMLElement>('.mv-app-workspace')");
    expect(app).toContain('workspace.scrollTop = 0');
    expect(app).toContain('workspace.scrollLeft = 0');
    expect(app).toContain('window.scrollTo(0, 0)');
    expect(app).toContain('window.requestAnimationFrame(() => {');
  });

  it('does not tie scroll reset to PC/Phone mode changes', () => {
    const handlerStart = app.indexOf('const handlePrimaryTabChange');
    const handlerEnd = app.indexOf('// Token-based theme engine', handlerStart);
    const handler = app.slice(handlerStart, handlerEnd);
    expect(handler).not.toContain('setLayoutMode');
    expect(handler).not.toContain('layoutMode');
  });
});
