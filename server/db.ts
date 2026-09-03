import { createRequire } from 'module';
import type { DatabaseSync } from 'node:sqlite';
const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync: SqliteDatabaseSync } = nodeRequire('node:sqlite');
import path from 'path';
import fs from 'fs';
import {
  HouseholdData,
  HouseholdMember,
  Account,
  Category,
  Transaction,
  TransactionSplit,
  PlannedPayment,
  PlannedIncome,
  SavingsGoal,
  AuditLogEntry,
  UserRole,
  UserPreferences,
} from '../src/types';

let dbInstance: DatabaseSync | null = null;
let currentDbPath = '';

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    throw new Error('Database has not been initialized. Call initDb() first.');
  }
  return dbInstance;
}

export function initDb(dbPath?: string): DatabaseSync {
  const targetPath = dbPath || path.join(process.cwd(), 'data', 'mv_household.sqlite');
  currentDbPath = targetPath;

  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new SqliteDatabaseSync(targetPath);

  // Enable WAL mode for high concurrency and crash resilience
  if (targetPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec('PRAGMA foreign_keys = ON;');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner', 'editor', 'view_only', 'pending', 'removed')),
      joined_at TEXT NOT NULL,
      approved_at TEXT,
      approved_by TEXT,
      last_active_at TEXT
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY,
      theme TEXT NOT NULL DEFAULT 'system',
      accent_color TEXT NOT NULL DEFAULT 'default',
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS household_meta (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'GBP',
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('current', 'joint', 'savings', 'credit', 'cash')),
      currency TEXT NOT NULL DEFAULT 'GBP',
      starting_balance_pence INTEGER NOT NULL DEFAULT 0,
      current_balance_pence INTEGER NOT NULL DEFAULT 0,
      owner_person TEXT NOT NULL CHECK(owner_person IN ('Marius', 'Vesta', 'Joint')),
      is_active INTEGER NOT NULL DEFAULT 1,
      reconciled_at TEXT,
      reconciliation_date TEXT,
      reconciled_balance_pence INTEGER,
      credit_limit_pence INTEGER,
      balance_owed_pence INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      group_name TEXT NOT NULL,
      monthly_budget_pence INTEGER NOT NULL DEFAULT 0,
      icon TEXT,
      is_archived INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount_pence INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('expense', 'income', 'transfer', 'repayment', 'refund')),
      category_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      target_account_id TEXT,
      payer TEXT NOT NULL CHECK(payer IN ('Marius', 'Vesta', 'Joint')),
      notes TEXT,
      is_transfer INTEGER NOT NULL DEFAULT 0,
      is_repayment INTEGER NOT NULL DEFAULT 0,
      is_savings INTEGER NOT NULL DEFAULT 0,
      is_refund INTEGER NOT NULL DEFAULT 0,
      original_transaction_id TEXT,
      planned_payment_id TEXT,
      planned_income_id TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_at TEXT,
      updated_by TEXT,
      FOREIGN KEY(account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS transaction_splits (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      amount_pence INTEGER NOT NULL,
      payer TEXT,
      notes TEXT,
      FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS planned_incomes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      expected_amount_pence INTEGER NOT NULL,
      actual_amount_pence INTEGER,
      month TEXT NOT NULL,
      source_person TEXT NOT NULL CHECK(source_person IN ('Marius', 'Vesta', 'Joint')),
      account_id TEXT NOT NULL,
      expected_date TEXT,
      actual_date TEXT,
      status TEXT NOT NULL CHECK(status IN ('expected', 'received', 'partial')),
      notes TEXT,
      actual_transaction_id TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_at TEXT,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS planned_payments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      amount_pence INTEGER NOT NULL,
      actual_amount_pence INTEGER,
      actual_date TEXT,
      actual_transaction_id TEXT,
      month TEXT NOT NULL,
      responsible_person TEXT NOT NULL CHECK(responsible_person IN ('Marius', 'Vesta', 'Joint')),
      account_id TEXT NOT NULL,
      due_date TEXT,
      category_id TEXT,
      status TEXT NOT NULL CHECK(status IN ('unpaid', 'paid')),
      include_in_transfer_plan INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_at TEXT,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS savings_goals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      target_pence INTEGER NOT NULL,
      current_pence INTEGER NOT NULL DEFAULT 0,
      target_date TEXT,
      account_id TEXT NOT NULL,
      linked_account_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      actor_email TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      details_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_planned_payments_month ON planned_payments(month);
    CREATE INDEX IF NOT EXISTS idx_planned_incomes_month ON planned_incomes(month);
  `);

  // Ensure household_meta exists
  const metaRow = db.prepare('SELECT * FROM household_meta WHERE id = ?').get('household-mv') as any;
  if (!metaRow) {
    db.prepare('INSERT INTO household_meta (id, name, currency, version, updated_at) VALUES (?, ?, ?, ?, ?)').run(
      'household-mv',
      'Marius & Vesta Household',
      'GBP',
      1,
      new Date().toISOString()
    );
  }

  // Ensure standard budget category structure exists (categories with 0 budget, ready for real entries)
  const catCount = (db.prepare('SELECT count(*) as count FROM categories').get() as any).count;
  if (catCount === 0) {
    const defaultCategories = [
      { id: 'cat-housing', name: 'Rent / Mortgage', group_name: 'Housing', monthly_budget_pence: 0 },
      { id: 'cat-council-tax', name: 'Council Tax', group_name: 'Housing', monthly_budget_pence: 0 },
      { id: 'cat-groceries', name: 'Groceries & Food', group_name: 'Living', monthly_budget_pence: 0 },
      { id: 'cat-utilities', name: 'Gas & Electricity', group_name: 'Utilities', monthly_budget_pence: 0 },
      { id: 'cat-water', name: 'Water Rates', group_name: 'Utilities', monthly_budget_pence: 0 },
      { id: 'cat-internet', name: 'Broadband & Mobile', group_name: 'Utilities', monthly_budget_pence: 0 },
      { id: 'cat-transport', name: 'Transport & Fuel', group_name: 'Living', monthly_budget_pence: 0 },
      { id: 'cat-childcare', name: 'Child Maintenance / Care', group_name: 'Family', monthly_budget_pence: 0 },
      { id: 'cat-health', name: 'Health & Pharmacy', group_name: 'Personal', monthly_budget_pence: 0 },
      { id: 'cat-dining', name: 'Dining & Takeaway', group_name: 'Discretionary', monthly_budget_pence: 0 },
      { id: 'cat-entertainment', name: 'Entertainment & Subs', group_name: 'Discretionary', monthly_budget_pence: 0 },
      { id: 'cat-savings', name: 'Savings Allocation', group_name: 'Savings', monthly_budget_pence: 0 },
      { id: 'cat-salary', name: 'Salary & Earnings', group_name: 'Income', monthly_budget_pence: 0 },
      { id: 'cat-benefits', name: 'State Benefits / Universal Credit', group_name: 'Income', monthly_budget_pence: 0 },
      { id: 'cat-child-benefit', name: 'Child Benefit', group_name: 'Income', monthly_budget_pence: 0 },
    ];
    const catInsert = db.prepare('INSERT INTO categories (id, name, group_name, monthly_budget_pence, icon, is_archived) VALUES (?, ?, ?, ?, ?, 0)');
    for (const c of defaultCategories) {
      catInsert.run(c.id, c.name, c.group_name, c.monthly_budget_pence, null);
    }
  }

  dbInstance = db;
  return db;
}

// Bump version and log audit trail inside an existing transaction or standalone
export function bumpVersionAndLog(
  db: DatabaseSync,
  actorEmail: string,
  action: string,
  entityType: string,
  entityId: string,
  summary: string,
  details?: Record<string, any>
): number {
  const currentMeta = db.prepare('SELECT version FROM household_meta WHERE id = ?').get('household-mv') as any;
  const newVersion = ((currentMeta?.version || 0) + 1);
  const now = new Date().toISOString();

  db.prepare('UPDATE household_meta SET version = ?, updated_at = ? WHERE id = ?').run(
    newVersion,
    now,
    'household-mv'
  );

  const logId = 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  db.prepare(`
    INSERT INTO audit_logs (id, timestamp, actor_email, action, entity_type, entity_id, summary, details_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    logId,
    now,
    actorEmail,
    action,
    entityType,
    entityId,
    summary,
    details ? JSON.stringify(details) : null
  );

  return newVersion;
}

export function checkVersionConflict(expectedVersion: number | undefined): void {
  const db = getDb();
  const currentMeta = db.prepare('SELECT version FROM household_meta WHERE id = ?').get('household-mv') as any;
  const currentVersion = currentMeta?.version || 1;

  if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
    const error: any = new Error(
      `Concurrent modification conflict: submitted version ${expectedVersion}, but server is at version ${currentVersion}. Refresh to load latest state.`
    );
    error.status = 409;
    error.serverVersion = currentVersion;
    throw error;
  }
}

/**
 * Recalculates current balance of an account using the authoritative reconciliation anchor model:
 *
 * If reconciled:
 *   currentBalance = reconciled_balance_pence + post_reconciliation_inflows - post_reconciliation_outflows
 *
 * If not reconciled:
 *   currentBalance = starting_balance_pence + all_inflows - all_outflows
 */
export function recalculateAccountBalance(db: DatabaseSync, accountId: string): number {
  const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;
  if (!acc) return 0;

  let baseBalance = acc.starting_balance_pence;
  let filterDate = '';

  if (acc.reconciliation_date && acc.reconciled_balance_pence !== null && acc.reconciled_balance_pence !== undefined) {
    baseBalance = acc.reconciled_balance_pence;
    filterDate = acc.reconciliation_date;
  }

  // Get transactions on this account
  let txQuery = 'SELECT * FROM transactions WHERE account_id = ?';
  const params: any[] = [accountId];

  if (filterDate) {
    txQuery += ' AND date > ?';
    params.push(filterDate);
  }

  const txs = db.prepare(txQuery).all(...params) as any[];

  // Also account for incoming transfers where target_account_id == accountId
  let incomingQuery = 'SELECT * FROM transactions WHERE target_account_id = ? AND is_transfer = 1';
  const incomingParams: any[] = [accountId];
  if (filterDate) {
    incomingQuery += ' AND date > ?';
    incomingParams.push(filterDate);
  }
  const incomingTransfers = db.prepare(incomingQuery).all(...incomingParams) as any[];

  let calculated = baseBalance;

  for (const tx of txs) {
    if (tx.type === 'income') {
      calculated += tx.amount_pence;
    } else if (tx.type === 'expense' || tx.type === 'repayment') {
      calculated -= tx.amount_pence;
    } else if (tx.type === 'transfer' && tx.is_transfer) {
      // Outgoing transfer from this account
      calculated -= tx.amount_pence;
    } else if (tx.type === 'refund' || tx.is_refund) {
      // Refund credited back into this account
      calculated += tx.amount_pence;
    }
  }

  for (const inTx of incomingTransfers) {
    calculated += inTx.amount_pence;
  }

  db.prepare('UPDATE accounts SET current_balance_pence = ?, updated_at = ? WHERE id = ?').run(
    calculated,
    new Date().toISOString(),
    accountId
  );

  return calculated;
}

export function recalculateAllBalances(db: DatabaseSync): void {
  const accounts = db.prepare('SELECT id FROM accounts').all() as any[];
  for (const a of accounts) {
    recalculateAccountBalance(db, a.id);
  }
}

/**
 * Returns the full household dataset, computing current balances on demand.
 */
export function getHouseholdData(): HouseholdData {
  const db = getDb();
  recalculateAllBalances(db);

  const meta = db.prepare('SELECT * FROM household_meta WHERE id = ?').get('household-mv') as any;
  const rawMembers = db.prepare('SELECT id, email, display_name as name, role, joined_at as joinedAt, approved_at as approvedAt, approved_by as approvedBy, last_active_at as lastActiveAt FROM users ORDER BY joined_at ASC').all() as any[];
  const rawAccounts = db.prepare('SELECT * FROM accounts WHERE is_active = 1 ORDER BY name ASC').all() as any[];
  const rawCategories = db.prepare('SELECT id, name, group_name as "group", monthly_budget_pence as monthlyBudgetPence, icon, is_archived as isArchived FROM categories WHERE is_archived = 0 ORDER BY group_name ASC, name ASC').all() as any[];
  const rawTransactions = db.prepare('SELECT * FROM transactions ORDER BY date DESC, created_at DESC').all() as any[];
  const rawSplits = db.prepare('SELECT * FROM transaction_splits').all() as any[];
  const rawPlannedPayments = db.prepare('SELECT * FROM planned_payments ORDER BY month DESC, due_date ASC').all() as any[];
  const rawPlannedIncomes = db.prepare('SELECT * FROM planned_incomes ORDER BY month DESC, expected_date ASC').all() as any[];
  const rawSavingsGoals = db.prepare('SELECT * FROM savings_goals ORDER BY target_date ASC').all() as any[];
  const rawAuditLogs = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 200').all() as any[];

  // Group splits by transaction ID
  const splitsMap = new Map<string, TransactionSplit[]>();
  for (const s of rawSplits) {
    if (!splitsMap.has(s.transaction_id)) {
      splitsMap.set(s.transaction_id, []);
    }
    splitsMap.get(s.transaction_id)!.push({
      id: s.id,
      categoryId: s.category_id,
      amountPence: s.amount_pence,
      payer: s.payer || undefined,
      notes: s.notes || undefined,
    });
  }

  const transactions: Transaction[] = rawTransactions.map((tx) => ({
    id: tx.id,
    date: tx.date,
    description: tx.description,
    amountPence: tx.amount_pence,
    type: tx.type,
    categoryId: tx.category_id,
    accountId: tx.account_id,
    targetAccountId: tx.target_account_id || undefined,
    payer: tx.payer,
    notes: tx.notes || undefined,
    isTransfer: Boolean(tx.is_transfer),
    isRepayment: Boolean(tx.is_repayment),
    isSavings: Boolean(tx.is_savings),
    isRefund: Boolean(tx.is_refund),
    originalTransactionId: tx.original_transaction_id || undefined,
    plannedPaymentId: tx.planned_payment_id || undefined,
    plannedIncomeId: tx.planned_income_id || undefined,
    splits: splitsMap.get(tx.id) || undefined,
    createdAt: tx.created_at,
    createdBy: tx.created_by,
    updatedAt: tx.updated_at || undefined,
    updatedBy: tx.updated_by || undefined,
  }));

  const accounts: Account[] = rawAccounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    currency: a.currency,
    startingBalancePence: a.starting_balance_pence,
    currentBalancePence: a.current_balance_pence,
    ownerPerson: a.owner_person,
    isActive: Boolean(a.is_active),
    reconciledAt: a.reconciled_at || undefined,
    reconciliationDate: a.reconciliation_date || undefined,
    reconciledBalancePence: a.reconciled_balance_pence !== null ? a.reconciled_balance_pence : undefined,
    creditLimitPence: a.credit_limit_pence !== null ? a.credit_limit_pence : undefined,
    balanceOwedPence: a.balance_owed_pence !== null ? a.balance_owed_pence : undefined,
    notes: a.notes || undefined,
  }));

  const plannedPayments: PlannedPayment[] = rawPlannedPayments.map((p) => ({
    id: p.id,
    name: p.name,
    amountPence: p.amount_pence,
    actualAmountPence: p.actual_amount_pence !== null ? p.actual_amount_pence : undefined,
    actualDate: p.actual_date || undefined,
    actualTransactionId: p.actual_transaction_id || undefined,
    month: p.month,
    responsiblePerson: p.responsible_person,
    accountId: p.account_id,
    dueDate: p.due_date || undefined,
    categoryId: p.category_id || undefined,
    status: p.status,
    includeInTransferPlan: Boolean(p.include_in_transfer_plan),
    notes: p.notes || undefined,
    createdAt: p.created_at,
    createdBy: p.created_by,
    updatedAt: p.updated_at || undefined,
    updatedBy: p.updated_by || undefined,
  }));

  const plannedIncomes: PlannedIncome[] = rawPlannedIncomes.map((i) => ({
    id: i.id,
    name: i.name,
    expectedAmountPence: i.expected_amount_pence,
    actualAmountPence: i.actual_amount_pence !== null ? i.actual_amount_pence : undefined,
    month: i.month,
    sourcePerson: i.source_person,
    accountId: i.account_id,
    expectedDate: i.expected_date || undefined,
    actualDate: i.actual_date || undefined,
    status: i.status,
    notes: i.notes || undefined,
    actualTransactionId: i.actual_transaction_id || undefined,
    createdAt: i.created_at,
    createdBy: i.created_by,
    updatedAt: i.updated_at || undefined,
    updatedBy: i.updated_by || undefined,
  }));

  const savingsGoals: SavingsGoal[] = rawSavingsGoals.map((s) => ({
    id: s.id,
    name: s.name,
    targetPence: s.target_pence,
    currentPence: s.current_pence,
    targetDate: s.target_date || undefined,
    accountId: s.account_id,
    linkedAccountId: s.linked_account_id || undefined,
  }));

  const auditLogs: AuditLogEntry[] = rawAuditLogs.map((l) => ({
    id: l.id,
    timestamp: l.timestamp,
    actorEmail: l.actor_email,
    action: l.action,
    entityType: l.entity_type,
    entityId: l.entity_id,
    summary: l.summary,
    details: l.details_json ? JSON.parse(l.details_json) : undefined,
  }));

  return {
    id: meta?.id || 'household-mv',
    name: meta?.name || 'Marius & Vesta Household',
    version: meta?.version || 1,
    members: rawMembers,
    accounts,
    categories: rawCategories,
    transactions,
    savingsGoals,
    plannedPayments,
    plannedIncomes,
    auditLogs,
  };
}
