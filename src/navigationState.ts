import type { NavTab } from './types';

const NAV_HASH_BY_TAB = {
  dashboard: '#dashboard',
  activity: '#activity',
  accounts: '#accounts',
  income: '#income',
  savings: '#savings',
  transfer_plan: '#transfer-plan',
  settings: '#settings',
  budget: '#budget',
  audit: '#audit',
} as const satisfies Partial<Record<NavTab, string>>;

const NAV_TAB_BY_HASH = new Map<string, NavTab>(
  Object.entries(NAV_HASH_BY_TAB).map(([tab, hash]) => [hash, tab as NavTab])
);

export function canonicalNavTab(tab: NavTab): NavTab {
  if (tab === 'transactions') return 'activity';
  if (tab === 'members') return 'settings';
  return tab;
}

export function navHrefForTab(tab: NavTab): string {
  const canonical = canonicalNavTab(tab);
  return NAV_HASH_BY_TAB[canonical as keyof typeof NAV_HASH_BY_TAB] ?? '#dashboard';
}

export function navTabFromHash(hash: string): NavTab {
  if (!hash) return 'dashboard';

  const normalized = hash.startsWith('#') ? hash.toLowerCase() : `#${hash.toLowerCase()}`;
  if (normalized === '#transactions') return 'activity';
  if (normalized === '#members') return 'settings';

  return NAV_TAB_BY_HASH.get(normalized) ?? 'dashboard';
}
