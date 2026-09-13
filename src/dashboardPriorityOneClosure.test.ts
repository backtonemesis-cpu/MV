import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Account, HouseholdData, Transaction } from './types';
import {
  assessDashboardIntegrity,
  classifyDashboardAccountState,
} from './utils/dashboardState';

const src = path.resolve(process.cwd(), 'src');
const dashboard = fs.readFileSync(
  path.join(src, 'components', 'Dashboard.tsx'),
  'utf8'
);
const navigation = fs.readFileSync(
  path.join(src, 'components', 'Navigation.tsx'),
  'utf8'
);
const closureCss = fs.readFileSync(
  path.join(src, 'dashboardPriorityOneClosure.css'),
  'utf8'
);
const main = fs.readFileSync(path.join(src, 'main.tsx'), 'utf8');

function household(overrides: Partial<HouseholdData> = {}): HouseholdData {
  return {
    dataSchemaVersion: 2,
    categoryGroups: [],
    monthlyCategoryBudgets: [],
    id: 'household-test',
    name: 'Test household',
    version: 1,
    members: [],
    accounts: [],
    categories: [],
    transactions: [],
    savingsGoals: [],
    plannedPayments: [],
    plannedIncomes: [],
    auditLogs: [],
    ...overrides,
  };
}

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'account-1',
    name: 'Current account',
    type: 'current',
    currency: 'GBP',
    startingBalancePence: 0,
    currentBalancePence: 0,
    ownerPerson: 'Marius',
    isActive: true,
    ...overrides,
  };
}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    date: '2026-09-10',
    description: 'Test transaction',
    amountPence: 100,
    type: 'expense',
    categoryId: 'expense-category',
    accountId: 'account-1',
    payer: 'Marius',
    isTransfer: false,
    isRepayment: false,
    isSavings: false,
    isRefund: false,
    createdAt: '2026-09-10T12:00:00.000Z',
    createdBy: 'test',
    ...overrides,
  };
}

describe('Dashboard Priority-One account-state contract', () => {
  it('treats a truly blank household as first setup', () => {
    expect(classifyDashboardAccountState(household())).toBe('first_setup');
  });

  it('keeps an active configured zero-balance liquid account as a valid liquid state', () => {
    const state = household({ accounts: [account({ currentBalancePence: 0 })] });
    expect(classifyDashboardAccountState(state)).toBe('liquid');
    expect(assessDashboardIntegrity(state, '2026-09').isCritical).toBe(false);
  });

  it('distinguishes an active credit-only household from first setup and valid liquid zero', () => {
    const state = household({
      accounts: [
        account({
          id: 'credit-1',
          name: 'Credit card',
          type: 'credit',
          currentBalancePence: -25000,
        }),
      ],
    });
    expect(classifyDashboardAccountState(state)).toBe('credit_only');
    expect(assessDashboardIntegrity(state, '2026-09').isCritical).toBe(false);
  });

  it('distinguishes archived account history from first setup', () => {
    const archived = account({ isActive: false });
    const state = household({
      accounts: [archived],
      transactions: [transaction()],
    });
    expect(classifyDashboardAccountState(state)).toBe('no_active_accounts');
    expect(assessDashboardIntegrity(state, '2026-09').isCritical).toBe(false);
  });
});

describe('Dashboard Priority-One fail-closed integrity contract', () => {
  it('fails closed when financial records reference a missing account', () => {
    const state = household({
      transactions: [transaction({ accountId: 'missing-account' })],
    });
    const result = assessDashboardIntegrity(state, '2026-09');
    expect(result.isCritical).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'missing_account_reference')).toBe(true);
  });

  it('fails closed on duplicated account identity', () => {
    const state = household({
      accounts: [account(), account({ name: 'Duplicate identity' })],
    });
    const result = assessDashboardIntegrity(state, '2026-09');
    expect(result.isCritical).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'duplicate_account_id')).toBe(true);
  });

  it('fails closed when individually safe balances overflow an aggregate total', () => {
    const state = household({
      accounts: [
        account({ id: 'account-max', currentBalancePence: Number.MAX_SAFE_INTEGER }),
        account({ id: 'account-one', currentBalancePence: 1 }),
      ],
    });
    const result = assessDashboardIntegrity(state, '2026-09');
    expect(result.isCritical).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'unsafe_money_total')).toBe(true);
  });

  it('accepts exact safe-integer headline inputs', () => {
    const state = household({
      accounts: [account({ currentBalancePence: 12345 })],
      transactions: [transaction({ amountPence: 2345 })],
    });
    expect(assessDashboardIntegrity(state, '2026-09').isCritical).toBe(false);
  });
});

describe('Dashboard Priority-One source contract', () => {
  it('implements the v4.31 true-blank state without normal Add or Prepare actions', () => {
    expect(dashboard).toContain("accountState === 'first_setup'");
    expect(dashboard).toContain('No accounts yet');
    expect(dashboard).toContain('Set up an account before recording household money.');
    expect(dashboard).toContain('Open Accounts');
    expect(dashboard).toContain('canEdit && !suppressFinancialCalculations');
  });

  it('keeps valid zero, credit-only and no-active-account states semantically distinct', () => {
    expect(dashboard).toContain("accountState === 'liquid'");
    expect(dashboard).toContain("accountState === 'credit_only'");
    expect(dashboard).toContain('No active cash/savings accounts');
    expect(dashboard).toContain('No active accounts');
    expect(dashboard).not.toContain('<strong>Unavailable</strong>');
  });

  it('renders a page-wide critical integrity state before unsafe headline values', () => {
    expect(dashboard).toContain('assessDashboardIntegrity(household, selectedMonth)');
    expect(dashboard).toContain('role="alert"');
    expect(dashboard).toContain('Dashboard totals unavailable');
    expect(dashboard).toContain('Headline money is hidden');
    expect(dashboard).toContain('Review data');
  });

  it('uses intrinsic labelled navigation fallback and publishes actual nav height', () => {
    expect(navigation).toContain("querySelectorAll<HTMLElement>('.mv-mobile-nav-label')");
    expect(navigation).toContain('label.scrollWidth');
    expect(navigation).toContain('new ResizeObserver');
    expect(navigation).toContain("'--mv-mobile-nav-height'");
    expect(navigation).toContain("isTwoRowMobileNav ? 'is-two-row' : ''");
    expect(navigation).toContain("data-nav-layout={isTwoRowMobileNav ? 'two-row' : 'one-row'}");
  });

  it('provides the balanced two-row layout and dynamic workspace clearance after all legacy CSS', () => {
    expect(main).toContain("import './dashboardPriorityOneClosure.css';");
    expect(main.indexOf("import './dashboardPriorityOneClosure.css';")).toBeGreaterThan(
      main.indexOf("import './dashboard.css';")
    );
    expect(closureCss).toContain('--mv-mobile-nav-height');
    expect(closureCss).toContain('.mv-mobile-nav-grid.is-two-row');
    expect(closureCss).toContain('grid-template-columns: repeat(6, minmax(0, 1fr)) !important;');
    expect(closureCss).toContain(':nth-child(-n + 3)');
    expect(closureCss).toContain(':nth-child(n + 4)');
    expect(closureCss).toContain('padding-bottom: calc(');
    expect(closureCss).toContain('var(--mv-mobile-nav-height)');
  });
});
