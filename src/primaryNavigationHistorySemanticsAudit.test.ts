import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalNavTab, navHrefForTab, navTabFromHash } from './navigationState';

const navigation = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/Navigation.tsx'),
  'utf8'
);

const app = fs.readFileSync(
  path.resolve(process.cwd(), 'src/App.tsx'),
  'utf8'
);

describe('Primary navigation URL and history semantics', () => {
  it('maps supported destinations to stable GitHub Pages-safe hashes', () => {
    expect(navHrefForTab('dashboard')).toBe('#dashboard');
    expect(navHrefForTab('activity')).toBe('#activity');
    expect(navHrefForTab('accounts')).toBe('#accounts');
    expect(navHrefForTab('income')).toBe('#income');
    expect(navHrefForTab('savings')).toBe('#savings');
    expect(navHrefForTab('transfer_plan')).toBe('#transfer-plan');
    expect(navHrefForTab('settings')).toBe('#settings');
  });

  it('parses direct hashes and safely falls back to the dashboard', () => {
    expect(navTabFromHash('')).toBe('dashboard');
    expect(navTabFromHash('#accounts')).toBe('accounts');
    expect(navTabFromHash('INCOME')).toBe('income');
    expect(navTabFromHash('#unknown-section')).toBe('dashboard');
  });

  it('canonicalizes supported legacy navigation aliases without exposing blank views', () => {
    expect(canonicalNavTab('transactions')).toBe('activity');
    expect(navTabFromHash('#transactions')).toBe('activity');
    expect(canonicalNavTab('members')).toBe('settings');
    expect(navTabFromHash('#members')).toBe('settings');
  });

  it('renders primary destinations as links while leaving More as a disclosure button', () => {
    expect(navigation).toContain('href={navHrefForTab(tab.id)}');
    expect(navigation).toContain("aria-current={isActive ? 'page' : undefined}");
    expect(navigation).toContain('id="mobile-nav-tab-more"');
    expect(navigation).toContain('aria-expanded={isMoreOpen}');
    expect(navigation).toContain('aria-controls="mobile-more-navigation"');
    expect(navigation).not.toContain('role="menu"');
  });

  it('preserves native modified-click behavior for opening destinations separately', () => {
    expect(navigation).toContain('event.button !== 0');
    expect(navigation).toContain('event.metaKey');
    expect(navigation).toContain('event.ctrlKey');
    expect(navigation).toContain('event.shiftKey');
    expect(navigation).toContain('event.altKey');
    expect(navigation).toContain('event.preventDefault();');
  });

  it('synchronizes direct hashes and browser history without a router dependency', () => {
    expect(navigation).toContain("window.addEventListener('popstate', syncFromLocation)");
    expect(navigation).toContain("window.addEventListener('hashchange', syncFromLocation)");
    expect(navigation).toContain("window.removeEventListener('popstate', syncFromLocation)");
    expect(navigation).toContain("window.removeEventListener('hashchange', syncFromLocation)");
    expect(navigation).toContain("window.history.pushState(null, '', href)");
    expect(navigation).toContain('const locationTab = navTabFromHash(currentHash);');
  });

  it('keeps the existing central App navigation and scroll-reset contract unchanged', () => {
    expect(app).toContain('const handlePrimaryTabChange = useCallback((tab: NavTab) => {');
    expect(app).toContain('onTabChange={handlePrimaryTabChange}');
    expect(app).toContain('onNavigateToTab={handlePrimaryTabChange}');
    expect(app).toContain('onNavigate={handlePrimaryTabChange}');
    expect(app).toContain('workspace.scrollTop = 0');
    expect(app).toContain('workspace.scrollLeft = 0');
    expect(app).toContain('window.scrollTo(0, 0)');
  });

  it('closes the mobile More disclosure whenever the active destination changes', () => {
    expect(navigation).toContain("useEffect(() => {\n    setIsMoreOpen(false);\n  }, [activeTab]);");
  });
});
