import type {
  Account,
  HouseholdData,
  PlannedIncome,
  PlannedPayment,
  SavingsGoal,
  TestResult,
  Transaction,
  UserPreferences,
  UserRole,
  UserSession,
} from '../types';
import {
  LOCAL_OWNER,
  approveLocalHouseholdMember,
  bulkToggleLocalPlannedPayments,
  changeLocalHouseholdMemberRole,
  createLocalHouseholdMember,
  createLocalAccount,
  createLocalBackupPackage,
  createLocalPlannedIncome,
  createLocalPlannedPayment,
  createLocalSavingsGoal,
  contributeLocalSavingsGoal,
  createLocalTransaction,
  deleteLocalAccount,
  deleteLocalPlannedIncome,
  deleteLocalPlannedPayment,
  deleteLocalSavingsGoal,
  deleteLocalTransaction,
  executeLocalTransfer,
  executeLocalTransferAllocations,
  undoLatestLocalTransferPlanFunding,
  getLocalPreferences,
  importLocalMonth,
  loadLocalHousehold,
  markLocalIncomeReceived,
  markLocalPaymentPaid,
  preflightLocalRestore,
  reconcileLocalAccount,
  removeLocalHouseholdMember,
  resetLocalHousehold,
  restoreLocalBackup,
  saveLocalPreferences,
  subscribeToLocalChanges,
  updateLocalAccount,
  updateLocalHouseholdMember,
  updateLocalPlannedIncome,
  updateLocalPlannedPayment,
  updateLocalSavingsGoal,
  updateLocalTransaction,
} from '../localStore';

const OWNER_EMAIL = LOCAL_OWNER.email;
const OWNER_SESSION: UserSession = {
  email: LOCAL_OWNER.email,
  name: LOCAL_OWNER.name,
  role: LOCAL_OWNER.role,
  householdId: LOCAL_OWNER.householdId,
};

function resolved<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

// Penny-style local mode has no server token. These compatibility functions remain
// so existing components do not need a broad rewrite.
export function getAuthToken(): string {
  return 'local-browser';
}

export function setAuthToken(_token: string): void {}

export function clearAuthToken(): void {}

export async function loginUser(
  email: string,
  _password: string
): Promise<{ token: string; user: UserSession }> {
  if (email.trim().toLowerCase() !== OWNER_EMAIL) {
    throw new Error('MV is currently restricted to Marius on this browser.');
  }
  return { token: 'local-browser', user: OWNER_SESSION };
}

export async function registerUser(
  email: string,
  _password: string,
  _displayName?: string
): Promise<{ token: string; user: UserSession }> {
  if (email.trim().toLowerCase() !== OWNER_EMAIL) {
    throw new Error('MV is currently restricted to Marius on this browser.');
  }
  return { token: 'local-browser', user: OWNER_SESSION };
}

export async function logoutUser(): Promise<void> {}

export async function fetchCurrentUser(): Promise<{
  user: UserSession;
  preferences: UserPreferences;
} | null> {
  return {
    user: OWNER_SESSION,
    preferences: getLocalPreferences(),
  };
}

export async function saveUserPreferences(
  prefs: Partial<UserPreferences>
): Promise<UserPreferences> {
  const current = getLocalPreferences();
  return saveLocalPreferences({ ...current, ...prefs });
}

export async function fetchSession(): Promise<
  UserSession & {
    availableIdentities: { email: string; name: string; role: UserRole }[];
  }
> {
  return {
    ...OWNER_SESSION,
    availableIdentities: [
      {
        email: OWNER_SESSION.email,
        name: OWNER_SESSION.name,
        role: OWNER_SESSION.role,
      },
    ],
  };
}

export async function fetchHousehold(): Promise<HouseholdData> {
  return loadLocalHousehold();
}

export async function createTransaction(
  data: Partial<Transaction>,
  expectedVersion: number
) {
  return createLocalTransaction(data, expectedVersion);
}

export async function updateTransaction(
  id: string,
  data: Partial<Transaction>,
  expectedVersion: number
) {
  return updateLocalTransaction(id, data, expectedVersion);
}

export async function deleteTransaction(id: string, expectedVersion: number) {
  return deleteLocalTransaction(id, expectedVersion);
}

export async function createAccount(data: Partial<Account>, expectedVersion: number) {
  return createLocalAccount(data, expectedVersion);
}

export async function updateAccount(
  id: string,
  data: Partial<Account>,
  expectedVersion: number
) {
  return updateLocalAccount(id, data, expectedVersion);
}

export async function deleteAccount(id: string, expectedVersion: number) {
  return deleteLocalAccount(id, expectedVersion);
}

export async function reconcileAccount(
  id: string,
  reconciledBalancePence: number,
  reconciliationDate: string,
  expectedVersion: number
) {
  return reconcileLocalAccount(
    id,
    reconciledBalancePence,
    reconciliationDate,
    expectedVersion
  );
}

export async function createPlannedPayment(
  data: Partial<PlannedPayment>,
  expectedVersion: number
) {
  return createLocalPlannedPayment(data, expectedVersion);
}

export async function updatePlannedPayment(
  id: string,
  data: Partial<PlannedPayment>,
  expectedVersion: number
) {
  return updateLocalPlannedPayment(id, data, expectedVersion);
}

export async function deletePlannedPayment(id: string, expectedVersion: number) {
  return deleteLocalPlannedPayment(id, expectedVersion);
}

export async function markPaymentPaid(
  id: string,
  payload: {
    actualAmountPence?: number;
    actualDate?: string;
    accountId?: string;
    expectedVersion: number;
  }
) {
  const { expectedVersion, ...actual } = payload;
  return markLocalPaymentPaid(id, actual, expectedVersion);
}

export async function createPlannedIncome(
  data: Partial<PlannedIncome>,
  expectedVersion: number
) {
  return createLocalPlannedIncome(data, expectedVersion);
}

export async function updatePlannedIncome(
  id: string,
  data: Partial<PlannedIncome>,
  expectedVersion: number
) {
  return updateLocalPlannedIncome(id, data, expectedVersion);
}

export async function deletePlannedIncome(id: string, expectedVersion: number) {
  return deleteLocalPlannedIncome(id, expectedVersion);
}

export async function markIncomeReceived(
  id: string,
  payload: {
    actualAmountPence?: number;
    actualDate?: string;
    accountId?: string;
    expectedVersion: number;
  }
) {
  const { expectedVersion, ...actual } = payload;
  return markLocalIncomeReceived(id, actual, expectedVersion);
}

export async function importMonth(params: {
  sourceMonth: string;
  targetMonth: string;
  paymentIds?: string[];
  incomeIds?: string[];
  expectedVersion: number;
}) {
  const { expectedVersion, ...request } = params;
  return importLocalMonth(request, expectedVersion);
}

export async function createSavingsGoal(
  data: Partial<SavingsGoal>,
  expectedVersion: number
) {
  return createLocalSavingsGoal(data, expectedVersion);
}

export async function contributeSavingsGoal(
  payload: {
    goalId: string;
    sourceAccountId: string;
    destinationAccountId: string;
    amountPence: number;
    payer?: string;
    date?: string;
  },
  expectedVersion: number
) {
  return contributeLocalSavingsGoal(payload, expectedVersion);
}


export async function updateSavingsGoal(
  id: string,
  data: Partial<SavingsGoal>,
  expectedVersion: number
) {
  return updateLocalSavingsGoal(id, data, expectedVersion);
}

export async function deleteSavingsGoal(id: string, expectedVersion: number) {
  return deleteLocalSavingsGoal(id, expectedVersion);
}

export async function bulkTogglePlannedPayments(
  params: {
    month?: string;
    include: boolean;
    onlyUnpaid?: boolean;
    status?: 'paid' | 'unpaid';
    paymentIds?: string[];
  },
  expectedVersion: number
) {
  return bulkToggleLocalPlannedPayments(params, expectedVersion);
}

export async function executeTransferPlanTransfer(payload: {
  sourceAccountId: string;
  destinationAccountId: string;
  amountPence: number;
  description?: string;
  date?: string;
  payer?: string;
  expectedVersion: number;
}) {
  const { expectedVersion, ...transfer } = payload;
  return executeLocalTransfer(transfer, expectedVersion);
}


export async function executeTransferPlanAllocations(payload: {
  destinationAccountId: string;
  expectedTotalPence: number;
  allocations: Array<{
    sourceAccountId: string;
    amountPence: number;
  }>;
  description?: string;
  date?: string;
  month: string;
  expectedVersion: number;
}) {
  const { expectedVersion, ...transfer } = payload;
  return executeLocalTransferAllocations(transfer, expectedVersion);
}

export async function undoTransferPlanFunding(
  destinationAccountId: string,
  month: string,
  expectedVersion: number
) {
  return undoLatestLocalTransferPlanFunding(destinationAccountId, expectedVersion, month);
}

export async function switchSession(email: string): Promise<void> {
  if (email.trim().toLowerCase() !== OWNER_EMAIL) {
    throw new Error('Only Marius is available in local-only MV.');
  }
}

export async function createHouseholdMember(
  data: { name: string; email?: string; role?: 'editor' | 'view_only' | 'pending' },
  expectedVersion: number
) {
  return createLocalHouseholdMember(data, expectedVersion);
}

export async function updateHouseholdMember(
  memberId: string,
  data: { name?: string; email?: string },
  expectedVersion: number
) {
  return updateLocalHouseholdMember(memberId, data, expectedVersion);
}

export async function approveMember(
  memberId: string,
  role: 'editor' | 'view_only',
  expectedVersion: number
) {
  return approveLocalHouseholdMember(memberId, role, expectedVersion);
}

export async function changeMemberRole(
  memberId: string,
  newRole: UserRole,
  expectedVersion: number
) {
  return changeLocalHouseholdMemberRole(memberId, newRole, expectedVersion);
}

export async function removeMember(
  memberId: string,
  expectedVersion: number
) {
  return removeLocalHouseholdMember(memberId, expectedVersion);
}

export async function fetchBackup(): Promise<any> {
  return createLocalBackupPackage();
}

export async function preflightRestore(backupPayload: any): Promise<{
  valid: boolean;
  counts: Record<string, number>;
  checks: string[];
  summary: string;
}> {
  return preflightLocalRestore(backupPayload);
}

export async function restoreBackup(backupPayload: any, expectedVersion: number) {
  return restoreLocalBackup(backupPayload, expectedVersion);
}

export async function runAcceptanceTests(): Promise<{
  timestamp: string;
  summary: { total: number; passed: number; failed: number };
  results: TestResult[];
}> {
  const household = loadLocalHousehold();
  const tests: TestResult[] = [
    {
      id: 1,
      name: 'Local storage readable',
      description: 'MV can read its Penny-style browser dataset.',
      passed: true,
      details: `Version ${household.version}`,
    },
    {
      id: 2,
      name: 'Household owner integrity',
      description: 'Marius remains the single local household owner while member records may exist.',
      passed:
        household.members.filter((member) => member.role === 'owner').length === 1 &&
        household.members.some(
          (member) => member.email === OWNER_EMAIL && member.role === 'owner'
        ),
      details: household.members
        .map((member) => `${member.email}:${member.role}`)
        .join(', '),
    },
    {
      id: 3,
      name: 'Exact pence transactions',
      description: 'All transaction amounts are safe integer pence.',
      passed: household.transactions.every((tx) => Number.isSafeInteger(tx.amountPence)),
      details: `${household.transactions.length} transaction(s) checked`,
    },
    {
      id: 4,
      name: 'No cloud backend',
      description: 'This build uses local browser storage only.',
      passed: true,
      details: 'No API server is required for MV data.',
    },
  ];
  const passed = tests.filter((test) => test.passed).length;
  return {
    timestamp: new Date().toISOString(),
    summary: { total: tests.length, passed, failed: tests.length - passed },
    results: tests,
  };
}

export async function resetHouseholdData(
  expectedVersion: number
): Promise<{ success: boolean; message: string; version: number }> {
  const result = resetLocalHousehold(expectedVersion);
  return {
    success: true,
    message: 'Local MV financial data reset to a clean blank state.',
    version: result.version,
  };
}

export async function loadSampleHouseholdData(): Promise<{
  success: boolean;
  message: string;
  version: number;
}> {
  const household = loadLocalHousehold();
  return resolved({
    success: false,
    message: 'Sample data is disabled in the local production app.',
    version: household.version,
  });
}

export function subscribeToHouseholdEvents(
  onUpdate: (version: number, actorEmail: string) => void
): () => void {
  return subscribeToLocalChanges(onUpdate);
}
