import type { HouseholdData, PlannedIncome, PlannedPayment, Transaction } from '../types';

export const LEGACY_CATEGORY_MIGRATION_ID = 'legacy-source-category-specificity-v1';
export const LEGACY_CATEGORY_BACKUP_KEY = 'mv_local_state_before_legacy_category_migration_v1';
const STORAGE_KEY = 'mv_local_state_v1';

export type CategoryMigrationConfidence = 'DETERMINISTIC' | 'AMBIGUOUS' | 'NO CHANGE REQUIRED';

export interface CategoryMigrationAuditRow {
  transactionId: string;
  transactionName: string;
  date: string;
  amountPence: number;
  payer: string;
  accountId: string;
  currentCategoryId: string;
  plannedPaymentId?: string;
  plannedIncomeId?: string;
  proposedCategoryId?: string;
  reason: string;
  confidence: CategoryMigrationConfidence;
}

interface LegacyLineageRule {
  lineageId: string;
  legacyCategoryId: string;
  canonicalCategoryId: string;
  reason: string;
}

// These rules are grounded in the stable IDs written by the audited September
// source-budget import. They deliberately do not use free-text name guessing.
const PAYMENT_RULES: readonly LegacyLineageRule[] = [
  { lineageId: 'src-payment-row-6', legacyCategoryId: 'src-cat-fixed', canonicalCategoryId: 'cat-housing', reason: 'Source row 6 is the linked Rent planned bill; canonical category is Rent / Mortgage.' },
  { lineageId: 'src-payment-row-7', legacyCategoryId: 'src-cat-fixed', canonicalCategoryId: 'cat-utilities', reason: 'Source row 7 is the linked Electric planned bill; canonical category is Gas & Electricity.' },
  { lineageId: 'src-payment-row-8', legacyCategoryId: 'src-cat-fixed', canonicalCategoryId: 'cat-council-tax', reason: 'Source row 8 is the linked Council tax planned bill; canonical category is Council Tax.' },
  { lineageId: 'src-payment-row-9', legacyCategoryId: 'src-cat-fixed', canonicalCategoryId: 'cat-internet', reason: 'Source row 9 is the linked Vodafone internet planned bill; canonical category is Broadband & Mobile.' },
  { lineageId: 'src-payment-row-17', legacyCategoryId: 'src-cat-emma', canonicalCategoryId: 'cat-childcare', reason: 'Source row 17 is Child Maintenance paid; canonical category is Child Maintenance / Care.' },
  { lineageId: 'src-payment-row-24', legacyCategoryId: 'src-cat-subscriptions', canonicalCategoryId: 'cat-entertainment', reason: 'Source row 24 is Netflix; canonical subscription category is Entertainment & Subs.' },
  { lineageId: 'src-payment-row-25', legacyCategoryId: 'src-cat-phones', canonicalCategoryId: 'cat-internet', reason: 'Source row 25 is a phone bill; canonical category is Broadband & Mobile.' },
  { lineageId: 'src-payment-row-26', legacyCategoryId: 'src-cat-phones', canonicalCategoryId: 'cat-internet', reason: 'Source row 26 is a phone bill; canonical category is Broadband & Mobile.' },
  { lineageId: 'src-payment-row-27', legacyCategoryId: 'src-cat-subscriptions', canonicalCategoryId: 'cat-entertainment', reason: 'Source row 27 is Google One; canonical subscription category is Entertainment & Subs.' },
  { lineageId: 'src-payment-row-28', legacyCategoryId: 'src-cat-subscriptions', canonicalCategoryId: 'cat-entertainment', reason: 'Source row 28 is ChatGPT; canonical subscription category is Entertainment & Subs.' },
  { lineageId: 'src-payment-row-29', legacyCategoryId: 'src-cat-subscriptions', canonicalCategoryId: 'cat-entertainment', reason: 'Source row 29 is National Trust; canonical subscription category is Entertainment & Subs.' },
] as const;

const INCOME_RULES: readonly LegacyLineageRule[] = [
  { lineageId: 'src-planned-income-row-5', legacyCategoryId: 'src-cat-employment', canonicalCategoryId: 'cat-salary', reason: 'Source row 5 is Paycheck employment income; canonical category is Salary & Earnings.' },
  { lineageId: 'src-planned-income-row-6', legacyCategoryId: 'src-cat-benefits', canonicalCategoryId: 'cat-benefits', reason: 'Source row 6 is Universal Credit; canonical category is State Benefits / Universal Credit.' },
  { lineageId: 'src-planned-income-row-8', legacyCategoryId: 'src-cat-c-benefit', canonicalCategoryId: 'cat-child-benefit', reason: 'Source row 8 is Child Benefit; canonical category is Child Benefit.' },
  { lineageId: 'src-planned-income-row-9', legacyCategoryId: 'src-cat-employment', canonicalCategoryId: 'cat-salary', reason: 'Source row 9 is Paycheck employment income; canonical category is Salary & Earnings.' },
] as const;

export const RETIRED_LEGACY_CATEGORY_IDS = new Set([
  'src-cat-fixed',
  'src-cat-emma',
  'src-cat-subscriptions',
  'src-cat-phones',
  'src-cat-employment',
  'src-cat-benefits',
  'src-cat-c-benefit',
]);

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function lineageId(record: PlannedPayment | PlannedIncome): string {
  return String(record.metadata?.copiedFromId || record.id);
}

function ruleForPayment(payment: PlannedPayment): LegacyLineageRule | undefined {
  const id = lineageId(payment);
  return PAYMENT_RULES.find((rule) => rule.lineageId === id);
}

function ruleForIncome(income: PlannedIncome): LegacyLineageRule | undefined {
  const id = lineageId(income);
  return INCOME_RULES.find((rule) => rule.lineageId === id);
}

function sourceRow(transaction: Transaction): number | undefined {
  const value = transaction.metadata?.sourceRow;
  return Number.isInteger(value) ? Number(value) : undefined;
}

function classifyUnlinked(transaction: Transaction): Pick<CategoryMigrationAuditRow, 'proposedCategoryId' | 'reason' | 'confidence'> {
  const row = sourceRow(transaction);
  if (transaction.categoryId === 'src-cat-variable-household' && row === 44) {
    return {
      reason: 'Source row 44 is Variable Household / Food and shopping; the source does not prove one canonical modern category.',
      confidence: 'AMBIGUOUS',
    };
  }
  if (transaction.categoryId === 'src-cat-bank-fees') {
    return {
      reason: 'Bank Fees is already specific and there is no canonical Bank Fees ID in the current standard taxonomy.',
      confidence: 'NO CHANGE REQUIRED',
    };
  }
  if (transaction.categoryId === 'src-cat-c-maintenance') {
    return {
      reason: 'Child maintenance received is already specifically identified and the current standard taxonomy has no dedicated maintenance-income category.',
      confidence: 'NO CHANGE REQUIRED',
    };
  }
  return {
    reason: 'No deterministic legacy lineage rule applies.',
    confidence: 'NO CHANGE REQUIRED',
  };
}

export interface LegacyCategoryMigrationReport {
  auditedTransactions: number;
  legacyFixedTransactions: number;
  deterministicTransactions: number;
  ambiguousTransactions: number;
  alreadyCorrectTransactions: number;
  changedTransactions: number;
  changedPlannedPayments: number;
  changedPlannedIncomes: number;
  rows: CategoryMigrationAuditRow[];
}

export function migrateLegacySourceCategories(input: HouseholdData): {
  state: HouseholdData;
  report: LegacyCategoryMigrationReport;
  changed: boolean;
} {
  const state = clone(input);
  const categoryIds = new Set(state.categories.map((category) => category.id));
  const paymentRules = new Map<string, LegacyLineageRule>();
  const incomeRules = new Map<string, LegacyLineageRule>();
  let changedPlannedPayments = 0;
  let changedPlannedIncomes = 0;

  for (const payment of state.plannedPayments) {
    const rule = ruleForPayment(payment);
    if (!rule || !categoryIds.has(rule.canonicalCategoryId)) continue;
    paymentRules.set(payment.id, rule);
    if (payment.categoryId === rule.legacyCategoryId) {
      payment.categoryId = rule.canonicalCategoryId;
      changedPlannedPayments += 1;
    }
  }

  for (const income of state.plannedIncomes || []) {
    const rule = ruleForIncome(income);
    if (!rule || !categoryIds.has(rule.canonicalCategoryId)) continue;
    incomeRules.set(income.id, rule);
    if (income.categoryId === rule.legacyCategoryId) {
      income.categoryId = rule.canonicalCategoryId;
      changedPlannedIncomes += 1;
    }
  }

  const rows: CategoryMigrationAuditRow[] = [];
  let changedTransactions = 0;
  let legacyFixedTransactions = 0;
  let deterministicTransactions = 0;
  let ambiguousTransactions = 0;
  let alreadyCorrectTransactions = 0;

  for (const transaction of state.transactions) {
    const rule = transaction.plannedPaymentId
      ? paymentRules.get(transaction.plannedPaymentId)
      : transaction.plannedIncomeId
        ? incomeRules.get(transaction.plannedIncomeId)
        : undefined;

    let confidence: CategoryMigrationConfidence;
    let reason: string;
    let proposedCategoryId: string | undefined;

    if (rule) {
      proposedCategoryId = rule.canonicalCategoryId;
      reason = rule.reason;
      if (transaction.categoryId === rule.legacyCategoryId) {
        confidence = 'DETERMINISTIC';
        transaction.categoryId = rule.canonicalCategoryId;
        changedTransactions += 1;
        deterministicTransactions += 1;
      } else if (transaction.categoryId === rule.canonicalCategoryId) {
        confidence = 'NO CHANGE REQUIRED';
        alreadyCorrectTransactions += 1;
      } else {
        confidence = 'AMBIGUOUS';
        reason = `${rule.reason} Current category '${transaction.categoryId}' is neither the legacy nor canonical ID, so it is preserved as a possible deliberate override.`;
        ambiguousTransactions += 1;
      }
    } else {
      const classification = classifyUnlinked(transaction);
      confidence = classification.confidence;
      reason = classification.reason;
      proposedCategoryId = classification.proposedCategoryId;
      if (confidence === 'AMBIGUOUS') ambiguousTransactions += 1;
      else alreadyCorrectTransactions += 1;
    }

    if (transaction.categoryId === 'src-cat-fixed' || (rule?.legacyCategoryId === 'src-cat-fixed' && proposedCategoryId)) {
      legacyFixedTransactions += 1;
    }

    rows.push({
      transactionId: transaction.id,
      transactionName: transaction.description,
      date: transaction.date,
      amountPence: transaction.amountPence,
      payer: transaction.payer,
      accountId: transaction.accountId,
      currentCategoryId: input.transactions.find((item) => item.id === transaction.id)?.categoryId || transaction.categoryId,
      plannedPaymentId: transaction.plannedPaymentId,
      plannedIncomeId: transaction.plannedIncomeId,
      proposedCategoryId,
      reason,
      confidence,
    });
  }

  const changed = changedTransactions > 0 || changedPlannedPayments > 0 || changedPlannedIncomes > 0;
  return {
    state,
    changed,
    report: {
      auditedTransactions: state.transactions.length,
      legacyFixedTransactions,
      deterministicTransactions,
      ambiguousTransactions,
      alreadyCorrectTransactions,
      changedTransactions,
      changedPlannedPayments,
      changedPlannedIncomes,
      rows,
    },
  };
}

function ensureMigrationRecord(state: HouseholdData, appliedAt: string): void {
  const schema = state.schemaStatus || {
    currentSchemaVersion: 1,
    minSupportedClientVersion: 1,
    latestAppliedVersion: 1,
    appliedMigrations: [],
    isUpToDate: true,
  };
  if (!schema.appliedMigrations.some((entry) => entry.name === LEGACY_CATEGORY_MIGRATION_ID)) {
    schema.appliedMigrations = [
      ...schema.appliedMigrations,
      {
        version: schema.currentSchemaVersion,
        name: LEGACY_CATEGORY_MIGRATION_ID,
        appliedAt,
        executionTimeMs: 0,
        checksum: 'stable-source-lineage-only',
      },
    ];
  }
  state.schemaStatus = schema;
}

export function migrateLegacyCategoriesInBrowserStorage(): LegacyCategoryMigrationReport | null {
  let storage: Storage;
  try {
    storage = globalThis.localStorage;
  } catch {
    return null;
  }
  if (!storage) return null;
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;

  let parsed: HouseholdData;
  try {
    parsed = JSON.parse(raw) as HouseholdData;
  } catch {
    return null;
  }
  if (!parsed || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.categories)) return null;

  const result = migrateLegacySourceCategories(parsed);
  if (!result.changed) return result.report;

  // Rollback safety: preserve the exact pre-migration browser state before the
  // first deterministic category-only repair.
  if (!storage.getItem(LEGACY_CATEGORY_BACKUP_KEY)) {
    storage.setItem(LEGACY_CATEGORY_BACKUP_KEY, raw);
  }

  const appliedAt = new Date().toISOString();
  result.state.version = parsed.version + 1;
  ensureMigrationRecord(result.state, appliedAt);
  result.state.auditLogs = [
    {
      id: `audit-${LEGACY_CATEGORY_MIGRATION_ID}`,
      timestamp: appliedAt,
      actorEmail: 'marius@local.invalid',
      action: 'legacy_category_migration',
      entityType: 'system',
      entityId: LEGACY_CATEGORY_MIGRATION_ID,
      summary: `Corrected ${result.report.changedTransactions} linked transaction categories, ${result.report.changedPlannedPayments} planned bill categories, and ${result.report.changedPlannedIncomes} planned income categories using stable source lineage.`,
      details: {
        changedTransactions: result.report.changedTransactions,
        changedPlannedPayments: result.report.changedPlannedPayments,
        changedPlannedIncomes: result.report.changedPlannedIncomes,
        ambiguousTransactions: result.report.ambiguousTransactions,
      },
    },
    ...(result.state.auditLogs || []),
  ].slice(0, 500);
  storage.setItem(STORAGE_KEY, JSON.stringify(result.state));
  return result.report;
}
