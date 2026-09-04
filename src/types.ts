export type UserRole = 'owner' | 'editor' | 'view_only' | 'pending' | 'removed';

export type Payer = 'Marius' | 'Vesta' | 'Joint';

export type AccountType = 'current' | 'joint' | 'savings' | 'credit' | 'cash';

export type TransactionType = 'expense' | 'income' | 'transfer' | 'repayment' | 'refund';

export interface HouseholdMember {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  joinedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  lastActiveAt?: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: 'GBP';
  startingBalancePence: number;
  currentBalancePence: number;
  ownerPerson?: Payer;
  isActive?: boolean;
  reconciledAt?: string;
  reconciliationDate?: string;
  reconciledBalancePence?: number;
  creditLimitPence?: number;
  balanceOwedPence?: number;
  notes?: string;
  schemaVersion?: number;
  metadata?: Record<string, any>;
}

export interface Category {
  id: string;
  name: string;
  group: string;
  monthlyBudgetPence: number;
  icon?: string;
  isArchived?: boolean;
}

export interface TransactionSplit {
  id: string;
  amountPence: number;
  categoryId: string;
  payer?: Payer;
  notes?: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amountPence: number;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  targetAccountId?: string;
  payer: Payer;
  notes?: string;
  isTransfer: boolean;
  isRepayment: boolean;
  isSavings: boolean;
  isRefund: boolean;
  originalTransactionId?: string;
  splits?: TransactionSplit[];
  plannedPaymentId?: string;
  plannedIncomeId?: string;
  idempotencyKey?: string;
  taxYear?: string;
  schemaVersion?: number;
  metadata?: Record<string, any>;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PlannedIncome {
  id: string;
  name: string;
  expectedAmountPence: number;
  actualAmountPence?: number;
  month: string;
  sourcePerson: Payer;
  accountId: string;
  expectedDate?: string;
  actualDate?: string;
  actualTransactionId?: string;
  /** Legacy aliases retained during datastore cutover. */
  receivedDate?: string;
  linkedTransactionId?: string;
  status: 'expected' | 'received' | 'partial';
  notes?: string;
  schemaVersion?: number;
  metadata?: Record<string, any>;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PlannedPayment {
  id: string;
  name: string;
  amountPence: number;
  actualAmountPence?: number;
  actualDate?: string;
  actualTransactionId?: string;
  month: string;
  responsiblePerson: Payer;
  accountId: string;
  dueDate?: string;
  categoryId?: string;
  status: 'unpaid' | 'paid';
  includeInTransferPlan: boolean;
  notes?: string;
  schemaVersion?: number;
  metadata?: Record<string, any>;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface AccountFundingRequirement {
  account: Account;
  currentBalancePence: number;
  selectedPayments: PlannedPayment[];
  unpaidPayments: PlannedPayment[];
  paidPayments: PlannedPayment[];
  fundedPayments: PlannedPayment[];
  unfundedPayments: PlannedPayment[];
  totalSelectedPaymentsPence: number;
  amountAvailablePence: number;
  transferRequiredPence: number;
  isFullyFunded: boolean;
}

export interface TransferPlanSummary {
  month: string;
  accountsNeedingFunding: AccountFundingRequirement[];
  accountsFullyFunded: AccountFundingRequirement[];
  totalTransferRequiredPence: number;
  totalSelectedPaymentsPence: number;
  totalSelectedPaymentsCount: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetPence: number;
  currentPence: number;
  targetDate?: string;
  accountId: string;
  linkedAccountId?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorEmail: string;
  action: string;
  entityType: 'member' | 'transaction' | 'account' | 'category' | 'savings' | 'planned_payment' | 'planned_income' | 'transfer_plan' | 'backup' | 'system';
  entityId: string;
  summary: string;
  details?: Record<string, any>;
}

export interface SchemaMigrationRecord {
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
  appliedMigrations: SchemaMigrationRecord[];
  isUpToDate: boolean;
}

export interface HouseholdData {
  id: string;
  name: string;
  version: number;
  schemaStatus?: SchemaStatus;
  members: HouseholdMember[];
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  savingsGoals: SavingsGoal[];
  plannedPayments: PlannedPayment[];
  plannedIncomes?: PlannedIncome[];
  auditLogs: AuditLogEntry[];
}

export interface UserSession {
  email: string;
  name: string;
  role: UserRole;
  householdId: string;
}

export interface TestResult {
  id: number;
  name: string;
  description: string;
  passed: boolean;
  details: string;
}

export type ThemePreference = 'light' | 'dark' | 'slate';
export type AccentColor =
  | 'emerald'
  | 'sapphire'
  | 'amethyst'
  | 'crimson'
  | 'amber'
  | 'teal'
  | 'indigo'
  | 'rose'
  | 'gold';

export interface UserPreferences {
  theme: ThemePreference;
  accent: AccentColor;
}

export interface MonthImportParams {
  sourceMonth: string;
  targetMonth: string;
  paymentIds?: string[];
}

export type NavTab =
  | 'dashboard'
  | 'activity'
  | 'accounts'
  | 'savings'
  | 'transfer_plan'
  | 'settings'
  | 'budget'
  | 'members'
  | 'audit'
  | 'transactions';
