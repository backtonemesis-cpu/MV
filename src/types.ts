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
  ownerPerson?: Payer; // 'Marius' | 'Vesta' | 'Joint'
  isActive?: boolean; // Defaults to true; inactive accounts remain in history but hidden from new forms
  reconciledAt?: string; // ISO timestamp of authoritative reconciliation
  reconciliationDate?: string; // YYYY-MM-DD effective as-of date
  reconciledBalancePence?: number; // Authoritative statement balance as of reconciliationDate
  creditLimitPence?: number; // Credit card limit in pence
  balanceOwedPence?: number; // Credit card balance owed in pence
  notes?: string;
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
  amountPence: number; // In exact integer pence
  categoryId: string;
  payer?: Payer;
  notes?: string;
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amountPence: number; // Stored in minor units (pence)
  type: TransactionType;
  categoryId: string;
  accountId: string;
  targetAccountId?: string; // For transfers & repayments
  payer: Payer;
  notes?: string;
  isTransfer: boolean;
  isRepayment: boolean;
  isSavings: boolean;
  isRefund: boolean;
  originalTransactionId?: string; // For linked refunds/credits
  splits?: TransactionSplit[]; // Split transaction support
  plannedPaymentId?: string; // Linked bill obligation
  createdAt: string;
  createdBy: string; // User email
  updatedAt?: string;
  updatedBy?: string;
}

export interface PlannedIncome {
  id: string;
  name: string; // e.g. "Marius Salary", "Vesta Universal Credit", "Child Benefit"
  expectedAmountPence: number;
  actualAmountPence?: number;
  month: string; // "YYYY-MM"
  sourcePerson: Payer;
  accountId: string; // Destination account
  expectedDate?: string;
  receivedDate?: string;
  status: 'expected' | 'received' | 'partial';
  notes?: string;
  linkedTransactionId?: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PlannedPayment {
  id: string;
  name: string; // e.g. "Child Maintenance", "Rent", "Vodafone"
  amountPence: number; // Stored in minor units (pence)
  month: string; // "YYYY-MM" (e.g. "2026-09")
  responsiblePerson: Payer; // 'Marius' | 'Vesta' | 'Joint'
  accountId: string; // Payment account that must cover this bill
  dueDate?: string; // Due date where known (e.g. "2026-09-01" or "01")
  categoryId?: string;
  status: 'unpaid' | 'paid'; // Separate concept from Transfer Plan inclusion
  includeInTransferPlan: boolean; // User inclusion toggle
  notes?: string;
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

export interface HouseholdData {
  id: string;
  name: string;
  version: number; // Concurrency tracking
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

export type ThemePreference = 'light' | 'dark' | 'system';
export type AccentColor =
  | 'default'
  | 'blue'
  | 'lilac'
  | 'yellow'
  | 'red'
  | 'green'
  | 'teal'
  | 'orange'
  | 'rose'
  | 'emerald'
  | 'indigo'
  | 'slate';

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
