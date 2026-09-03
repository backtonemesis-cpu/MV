import { createRequire } from 'module';
import type { DatabaseSync } from 'node:sqlite';
import { Request, Response, NextFunction } from 'express';

export interface Migration {
  version: number;
  name: string;
  description: string;
  up: (db: DatabaseSync) => void;
  down?: (db: DatabaseSync) => void;
}

export interface MigrationRecord {
  version: number;
  name: string;
  appliedAt: string;
  executionTimeMs: number;
  checksum?: string;
}

export interface SchemaStatus {
  currentSchemaVersion: number;
  minSupportedClientVersion: number;
  latestAppliedVersion: number;
  appliedMigrations: MigrationRecord[];
  isUpToDate: boolean;
}

// Current authoritative backend schema version
export const CURRENT_SCHEMA_VERSION = 3;

// Minimum client schema version that is permitted to write financial mutations.
// Clients on older versions (e.g. v1) are prevented from writing to safeguard data integrity.
export const MIN_SUPPORTED_CLIENT_SCHEMA_VERSION = 2;

// Utility to check if a column exists in SQLite table
export function hasColumn(db: DatabaseSync, tableName: string, columnName: string): boolean {
  try {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    return columns.some((c) => c.name.toLowerCase() === columnName.toLowerCase());
  } catch {
    return false;
  }
}

// Ensure the schema_migrations tracking table exists
export function ensureMigrationsTable(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      execution_time_ms INTEGER NOT NULL,
      checksum TEXT
    );
  `);
}

// Query applied migrations
export function getAppliedMigrations(db: DatabaseSync): MigrationRecord[] {
  ensureMigrationsTable(db);
  const rows = db.prepare(`
    SELECT version, name, applied_at as appliedAt, execution_time_ms as executionTimeMs, checksum
    FROM schema_migrations
    ORDER BY version ASC
  `).all() as any[];

  return rows.map((r) => ({
    version: Number(r.version),
    name: String(r.name),
    appliedAt: String(r.appliedAt),
    executionTimeMs: Number(r.executionTimeMs),
    checksum: r.checksum ? String(r.checksum) : undefined,
  }));
}

// -------------------------------------------------------------
// Sequential Migration Registry
// -------------------------------------------------------------
export const MIGRATIONS: Migration[] = [
  // Version 1: Baseline Architecture & Financial Core
  {
    version: 1,
    name: '001_baseline_schema',
    description: 'Initial relational schema for users, sessions, accounts, transactions, and transfer plans',
    up: (db: DatabaseSync) => {
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

      // Ensure default household meta
      const metaRow = db.prepare('SELECT id FROM household_meta WHERE id = ?').get('household-mv');
      if (!metaRow) {
        db.prepare('INSERT INTO household_meta (id, name, currency, version, updated_at) VALUES (?, ?, ?, ?, ?)').run(
          'household-mv',
          'Marius & Vesta Household',
          'GBP',
          1,
          new Date().toISOString()
        );
      }

      // Ensure default standard budget category structure exists
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
    },
  },

  // Version 2: Per-Record Data Versioning & Extensible Metadata
  {
    version: 2,
    name: '002_record_data_versioning_and_metadata',
    description: 'Adds schema_version tracking and metadata_json column to financial entity records',
    up: (db: DatabaseSync) => {
      // Safely add schema_version and metadata_json to financial entity tables
      const financialTables = [
        'accounts',
        'transactions',
        'planned_payments',
        'planned_incomes',
        'savings_goals',
      ];

      for (const table of financialTables) {
        if (!hasColumn(db, table, 'schema_version')) {
          db.exec(`ALTER TABLE ${table} ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1;`);
        }
        if (!hasColumn(db, table, 'metadata_json')) {
          db.exec(`ALTER TABLE ${table} ADD COLUMN metadata_json TEXT;`);
        }
      }

      // Backfill any null schema_versions
      for (const table of financialTables) {
        db.exec(`UPDATE ${table} SET schema_version = 1 WHERE schema_version IS NULL;`);
      }
    },
  },

  // Version 3: Idempotency Keys, Fiscal Audit Locking & Tax Year Categorization
  {
    version: 3,
    name: '003_idempotency_and_fiscal_locking',
    description: 'Introduces transaction idempotency keys, financial year tags, and fiscal locking state',
    up: (db: DatabaseSync) => {
      // Add idempotency_key to transactions to prevent duplicate submissions
      if (!hasColumn(db, 'transactions', 'idempotency_key')) {
        db.exec(`ALTER TABLE transactions ADD COLUMN idempotency_key TEXT;`);
      }

      // Add tax_year to transactions for financial reporting
      if (!hasColumn(db, 'transactions', 'tax_year')) {
        db.exec(`ALTER TABLE transactions ADD COLUMN tax_year TEXT;`);
      }

      // Add fiscal locking columns to household_meta
      if (!hasColumn(db, 'household_meta', 'is_locked')) {
        db.exec(`ALTER TABLE household_meta ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0;`);
      }
      if (!hasColumn(db, 'household_meta', 'closed_at')) {
        db.exec(`ALTER TABLE household_meta ADD COLUMN closed_at TEXT;`);
      }

      // Unique index on idempotency_key (where not null)
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_idempotency_key
        ON transactions(idempotency_key)
        WHERE idempotency_key IS NOT NULL;
      `);
    },
  },
];

// -------------------------------------------------------------
// Migration Execution Engine
// -------------------------------------------------------------
export function runMigrations(
  db: DatabaseSync,
  targetVersion: number = CURRENT_SCHEMA_VERSION
): { appliedCount: number; currentVersion: number } {
  ensureMigrationsTable(db);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations').all() as any[];
  const appliedSet = new Set<number>(appliedRows.map((r) => Number(r.version)));

  const pendingMigrations = MIGRATIONS
    .filter((m) => m.version <= targetVersion && !appliedSet.has(m.version))
    .sort((a, b) => a.version - b.version);

  let appliedCount = 0;

  for (const migration of pendingMigrations) {
    const startTime = Date.now();
    try {
      db.exec('BEGIN TRANSACTION;');

      migration.up(db);

      const elapsed = Date.now() - startTime;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO schema_migrations (version, name, applied_at, execution_time_ms, checksum)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        migration.version,
        migration.name,
        now,
        elapsed,
        `v${migration.version}-${migration.name}`
      );

      db.exec('COMMIT;');
      appliedCount++;
    } catch (err: any) {
      db.exec('ROLLBACK;');
      throw new Error(`Migration ${migration.version} (${migration.name}) failed: ${err.message || String(err)}`);
    }
  }

  const latestRow = db.prepare('SELECT MAX(version) as max_v FROM schema_migrations').get() as any;
  const currentVersion = latestRow?.max_v ? Number(latestRow.max_v) : 0;

  return { appliedCount, currentVersion };
}

export function getSchemaStatus(db: DatabaseSync): SchemaStatus {
  const applied = getAppliedMigrations(db);
  const latestApplied = applied.length > 0 ? Math.max(...applied.map((m) => m.version)) : 0;

  return {
    currentSchemaVersion: CURRENT_SCHEMA_VERSION,
    minSupportedClientVersion: MIN_SUPPORTED_CLIENT_SCHEMA_VERSION,
    latestAppliedVersion: latestApplied,
    appliedMigrations: applied,
    isUpToDate: latestApplied >= CURRENT_SCHEMA_VERSION,
  };
}

// -------------------------------------------------------------
// Client Schema Compatibility Verification Middleware
// -------------------------------------------------------------
export function enforceClientSchemaCompatibility(req: Request, res: Response, next: NextFunction): void {
  // Always emit current schema capabilities in response headers
  res.setHeader('X-Server-Schema-Version', CURRENT_SCHEMA_VERSION.toString());
  res.setHeader('X-Min-Client-Schema-Version', MIN_SUPPORTED_CLIENT_SCHEMA_VERSION.toString());

  // Extract client schema version header
  const rawClientVersion = req.headers['x-client-schema-version'] || req.headers['x-schema-version'] || req.query._schemaVersion;
  const clientVersion = rawClientVersion ? parseInt(String(rawClientVersion), 10) : undefined;

  const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());

  // Whitelist read-only or auth/system endpoints from write blockage
  const isExemptPath =
    req.path.startsWith('/api/auth/') ||
    req.path === '/api/session' ||
    req.path === '/api/events' ||
    req.path === '/api/health' ||
    req.path.startsWith('/api/system/') ||
    req.path.startsWith('/api/diagnostics/') ||
    req.path === '/api/preferences';

  // For financial and operational mutations, enforce schema compatibility
  if (isWriteMethod && req.path.startsWith('/api/') && !isExemptPath) {
    if (clientVersion === undefined || isNaN(clientVersion)) {
      res.status(426).json({
        error: 'INCOMPATIBLE_CLIENT_SCHEMA_VERSION',
        code: 'SCHEMA_VERSION_REQUIRED',
        message: `Client schema version is required for financial writes. Server requires client version >= v${MIN_SUPPORTED_CLIENT_SCHEMA_VERSION}. Please reload the application.`,
        clientSchemaVersion: null,
        serverSchemaVersion: CURRENT_SCHEMA_VERSION,
        minSupportedSchemaVersion: MIN_SUPPORTED_CLIENT_SCHEMA_VERSION,
      });
      return;
    }

    if (clientVersion < MIN_SUPPORTED_CLIENT_SCHEMA_VERSION) {
      res.status(426).json({
        error: 'INCOMPATIBLE_CLIENT_SCHEMA_VERSION',
        code: 'UPGRADE_REQUIRED',
        message: `Your client application schema version (v${clientVersion}) is outdated and incompatible with current server schema (v${CURRENT_SCHEMA_VERSION}). Minimum supported version is v${MIN_SUPPORTED_CLIENT_SCHEMA_VERSION}. Please reload your browser or update the app to prevent financial data corruption.`,
        clientSchemaVersion: clientVersion,
        serverSchemaVersion: CURRENT_SCHEMA_VERSION,
        minSupportedSchemaVersion: MIN_SUPPORTED_CLIENT_SCHEMA_VERSION,
      });
      return;
    }

    if (clientVersion > CURRENT_SCHEMA_VERSION) {
      res.status(400).json({
        error: 'UNSUPPORTED_CLIENT_SCHEMA_VERSION',
        code: 'CLIENT_TOO_NEW',
        message: `Client schema version (v${clientVersion}) is higher than server schema version (v${CURRENT_SCHEMA_VERSION}). Please update the server.`,
        clientSchemaVersion: clientVersion,
        serverSchemaVersion: CURRENT_SCHEMA_VERSION,
        minSupportedSchemaVersion: MIN_SUPPORTED_CLIENT_SCHEMA_VERSION,
      });
      return;
    }
  }

  // For GET requests, if client provided an old version, add recommendation header
  if (!isWriteMethod && clientVersion !== undefined && clientVersion < MIN_SUPPORTED_CLIENT_SCHEMA_VERSION) {
    res.setHeader('X-Client-Upgrade-Recommended', 'true');
  }

  (req as any).clientSchemaVersion = clientVersion;
  next();
}
