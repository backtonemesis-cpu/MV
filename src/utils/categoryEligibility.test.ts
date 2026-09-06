import { describe, expect, it } from 'vitest';
import type { Category } from '../types';
import {
  getBillCategoryOptions,
  isBillCategorySelectionAllowed,
  isBillEligibleCategory,
} from './categoryEligibility';

const category = (id: string, name: string, group: string): Category => ({
  id,
  name,
  group,
  monthlyBudgetPence: 0,
});

const housing = category('housing', 'Rent / Mortgage', 'Housing');
const living = category('living', 'Groceries & Food', 'Living');
const utilities = category('utilities', 'Gas & Electricity', 'Utilities');
const family = category('family', 'Child Maintenance / Care', 'Family');
const personal = category('personal', 'Health & Pharmacy', 'Personal');
const discretionary = category('discretionary', 'Entertainment & Subs', 'Discretionary');
const income = category('income', 'Salary & Earnings', 'Income');
const benefits = category('benefits', 'State Benefits / Universal Credit', 'Income');
const transfer = category('transfer', 'Internal Transfer', 'Transfers');
const savings = category('savings', 'Savings Allocation', 'Savings');

const categories = [
  housing,
  living,
  utilities,
  family,
  personal,
  discretionary,
  income,
  benefits,
  transfer,
  savings,
];

describe('bill category eligibility', () => {
  it('allows legitimate spending groups and excludes Income, Transfers and Savings', () => {
    for (const item of [housing, living, utilities, family, personal, discretionary]) {
      expect(isBillEligibleCategory(item)).toBe(true);
    }
    for (const item of [income, benefits, transfer, savings]) {
      expect(isBillEligibleCategory(item)).toBe(false);
    }
  });

  it('uses group metadata rather than category names', () => {
    expect(isBillEligibleCategory(category('x', 'Salary & Earnings', 'Housing'))).toBe(true);
    expect(isBillEligibleCategory(category('y', 'Ordinary Bill', 'Income'))).toBe(false);
  });

  it('filters excluded groups from a new bill', () => {
    expect(getBillCategoryOptions(categories).map((item) => item.id)).toEqual([
      'housing',
      'living',
      'utilities',
      'family',
      'personal',
      'discretionary',
    ]);
  });

  it('preserves only the currently linked excluded category during edit', () => {
    const options = getBillCategoryOptions(categories, 'income').map((item) => item.id);
    expect(options).toContain('income');
    expect(options).not.toContain('benefits');
    expect(options).not.toContain('transfer');
    expect(options).not.toContain('savings');
  });

  it('rejects newly assigning excluded categories but allows the unchanged historical category', () => {
    expect(isBillCategorySelectionAllowed(categories, 'housing')).toBe(true);
    expect(isBillCategorySelectionAllowed(categories, 'income')).toBe(false);
    expect(isBillCategorySelectionAllowed(categories, 'transfer')).toBe(false);
    expect(isBillCategorySelectionAllowed(categories, 'savings')).toBe(false);
    expect(isBillCategorySelectionAllowed(categories, 'income', 'income')).toBe(true);
    expect(isBillCategorySelectionAllowed(categories, 'benefits', 'income')).toBe(false);
    expect(isBillCategorySelectionAllowed(categories, '', 'income')).toBe(true);
  });

  it('rejects an unknown category id instead of silently accepting it', () => {
    expect(isBillCategorySelectionAllowed(categories, 'missing')).toBe(false);
  });
});
