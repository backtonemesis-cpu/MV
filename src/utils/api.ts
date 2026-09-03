import {
  HouseholdData,
  UserSession,
  Transaction,
  Account,
  SavingsGoal,
  PlannedPayment,
  PlannedIncome,
  TestResult,
  UserRole,
  UserPreferences,
} from '../types';

const TOKEN_KEY = 'mv_auth_token';
const USER_KEY = 'mv_current_user';

let currentAuthToken = localStorage.getItem(TOKEN_KEY) || '';

export function getAuthToken(): string {
  return currentAuthToken;
}

export function setAuthToken(token: string): void {
  currentAuthToken = token;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearAuthToken(): void {
  currentAuthToken = '';
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function getHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (currentAuthToken) {
    headers['Authorization'] = `Bearer ${currentAuthToken}`;
  }
  return headers;
}

// -------------------------------------------------------------
// Authentication
// -------------------------------------------------------------
export async function loginUser(email: string, password: string): Promise<{ token: string; user: any }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to sign in');
  }
  const data = await res.json();
  setAuthToken(data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
}

export async function registerUser(email: string, password: string, displayName?: string): Promise<{ token: string; user: any }> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Registration failed');
  }
  const data = await res.json();
  setAuthToken(data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: getHeaders(),
    });
  } catch (e) {
    // Ignore network failures on logout
  }
  clearAuthToken();
}

export async function fetchCurrentUser(): Promise<{ user: any; preferences: UserPreferences } | null> {
  if (!currentAuthToken) return null;
  const res = await fetch('/api/auth/me', { headers: getHeaders() });
  if (res.status === 401) {
    clearAuthToken();
    return null;
  }
  if (!res.ok) {
    throw new Error('Failed to fetch user session');
  }
  return res.json();
}

export async function saveUserPreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
  const res = await fetch('/api/user/preferences', {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(prefs),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to save appearance preferences');
  }
  const data = await res.json();
  return data.preferences;
}

export async function fetchSession(): Promise<UserSession & { availableIdentities: { email: string; name: string; role: UserRole }[] }> {
  const res = await fetch('/api/session', { headers: getHeaders() });
  if (res.status === 401) {
    throw new Error('Unauthenticated');
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch session: ${res.statusText}`);
  }
  return res.json();
}

// -------------------------------------------------------------
// Financial Data
// -------------------------------------------------------------
export async function fetchHousehold(): Promise<HouseholdData> {
  const res = await fetch('/api/household', { headers: getHeaders() });
  if (res.status === 403) {
    const errorData = await res.json().catch(() => ({}));
    const err: any = new Error(errorData.error || 'Forbidden: Access denied to household data');
    err.status = 403;
    err.role = errorData.role;
    throw err;
  }
  if (res.status === 401) {
    const err: any = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch household data: ${res.statusText}`);
  }
  return res.json();
}

export async function createTransaction(data: Partial<Transaction>, expectedVersion: number) {
  const res = await fetch('/api/transactions', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ ...data, expectedVersion }),
  });
  if (res.status === 409) {
    const errData = await res.json();
    const err: any = new Error(errData.error);
    err.status = 409;
    err.serverVersion = errData.serverVersion;
    throw err;
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to create transaction');
  }
  return res.json();
}

export async function updateTransaction(id: string, data: Partial<Transaction>, expectedVersion: number) {
  const res = await fetch(`/api/transactions/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ ...data, expectedVersion }),
  });
  if (res.status === 409) {
    const errData = await res.json();
    const err: any = new Error(errData.error);
    err.status = 409;
    err.serverVersion = errData.serverVersion;
    throw err;
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to update transaction');
  }
  return res.json();
}

export async function deleteTransaction(id: string, expectedVersion: number) {
  const res = await fetch(`/api/transactions/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
    body: JSON.stringify({ expectedVersion }),
  });
  if (res.status === 409) {
    const errData = await res.json();
    const err: any = new Error(errData.error);
    err.status = 409;
    throw err;
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to delete transaction');
  }
  return res.json();
}

export async function createAccount(data: Partial<Account>, expectedVersion: number) {
  const res = await fetch('/api/accounts', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ ...data, expectedVersion }),
  });
  if (res.status === 409) {
    const errData = await res.json();
    const err: any = new Error(errData.error);
    err.status = 409;
    throw err;
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to create account');
  }
  return res.json();
}

export async function updateAccount(id: string, data: Partial<Account>, expectedVersion: number) {
  const res = await fetch(`/api/accounts/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ ...data, expectedVersion }),
  });
  if (res.status === 409) {
    const errData = await res.json();
    const err: any = new Error(errData.error);
    err.status = 409;
    throw err;
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to update account');
  }
  return res.json();
}

export async function deleteAccount(id: string, expectedVersion: number) {
  const res = await fetch(`/api/accounts/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
    body: JSON.stringify({ expectedVersion }),
  });
  if (res.status === 409) {
    const errData = await res.json();
    const err: any = new Error(errData.error);
    err.status = 409;
    throw err;
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to delete account');
  }
  return res.json();
}

export async function reconcileAccount(
  id: string,
  reconciledBalancePence: number,
  reconciliationDate: string,
  expectedVersion: number
) {
  const res = await fetch(`/api/accounts/${id}/reconcile`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ reconciledBalancePence, reconciliationDate, expectedVersion }),
  });
  if (res.status === 409) {
    const errData = await res.json();
    const err: any = new Error(errData.error);
    err.status = 409;
    throw err;
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to reconcile account');
  }
  return res.json();
}

// -------------------------------------------------------------
// Planned Payments & Linkage
// -------------------------------------------------------------
export async function createPlannedPayment(data: Partial<PlannedPayment>, expectedVersion: number) {
  const res = await fetch('/api/planned-payments', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ ...data, expectedVersion }),
  });
  if (res.status === 409) {
    const errData = await res.json();
    const err: any = new Error(errData.error);
    err.status = 409;
    throw err;
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to create planned payment');
  }
  return res.json();
}

export async function updatePlannedPayment(id: string, data: Partial<PlannedPayment>, expectedVersion: number) {
  const res = await fetch(`/api/planned-payments/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ ...data, expectedVersion }),
  });
  if (res.status === 409) {
    const errData = await res.json();
    const err: any = new Error(errData.error);
    err.status = 409;
    throw err;
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to update planned payment');
  }
  return res.json();
}

export async function deletePlannedPayment(id: string, expectedVersion: number) {
  const res = await fetch(`/api/planned-payments/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
    body: JSON.stringify({ expectedVersion }),
  });
  if (res.status === 409) {
    const errData = await res.json();
    const err: any = new Error(errData.error);
    err.status = 409;
    throw err;
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to delete planned payment');
  }
  return res.json();
}

export async function markPaymentPaid(
  id: string,
  payload: { actualAmountPence?: number; actualDate?: string; accountId?: string; expectedVersion: number }
) {
  const res = await fetch(`/api/planned-payments/${id}/pay`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (res.status === 409) {
    const errData = await res.json();
    const err: any = new Error(errData.error);
    err.status = 409;
    throw err;
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to mark payment as paid');
  }
  return res.json();
}

// -------------------------------------------------------------
// Planned Incomes & Linkage
// -------------------------------------------------------------
export async function createPlannedIncome(data: Partial<PlannedIncome>, expectedVersion: number) {
  const res = await fetch('/api/planned-incomes', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ ...data, expectedVersion }),
  });
  if (res.status === 409) {
    const errData = await res.json();
    const err: any = new Error(errData.error);
    err.status = 409;
    throw err;
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to create planned income');
  }
  return res.json();
}

export async function updatePlannedIncome(id: string, data: Partial<PlannedIncome>, expectedVersion: number) {
  const res = await fetch(`/api/planned-incomes/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ ...data, expectedVersion }),
  });
  if (res.status === 409) {
    const errData = await res.json();
    const err: any = new Error(errData.error);
    err.status = 409;
    throw err;
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to update planned income');
  }
  return res.json();
}

export async function deletePlannedIncome(id: string, expectedVersion: number) {
  const res = await fetch(`/api/planned-incomes/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
    body: JSON.stringify({ expectedVersion }),
  });
  if (res.status === 409) {
    const errData = await res.json();
    const err: any = new Error(errData.error);
    err.status = 409;
    throw err;
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to delete planned income');
  }
  return res.json();
}

export async function markIncomeReceived(
  id: string,
  payload: { actualAmountPence?: number; actualDate?: string; accountId?: string; expectedVersion: number }
) {
  const res = await fetch(`/api/planned-incomes/${id}/receive`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (res.status === 409) {
    const errData = await res.json();
    const err: any = new Error(errData.error);
    err.status = 409;
    throw err;
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to mark income as received');
  }
  return res.json();
}

// -------------------------------------------------------------
// Month Import
// -------------------------------------------------------------
export async function importMonth(params: {
  sourceMonth: string;
  targetMonth: string;
  paymentIds?: string[];
  expectedVersion: number;
}) {
  const res = await fetch('/api/months/import', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(params),
  });
  if (res.status === 409) {
    const errData = await res.json();
    const err: any = new Error(errData.error);
    err.status = 409;
    throw err;
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to import month');
  }
  return res.json();
}

// -------------------------------------------------------------
// Savings Goals
// -------------------------------------------------------------
export async function createSavingsGoal(data: Partial<SavingsGoal>, expectedVersion: number) {
  const res = await fetch('/api/savings-goals', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ ...data, expectedVersion }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to create savings goal');
  }
  return res.json();
}

export async function updateSavingsGoal(id: string, data: Partial<SavingsGoal>, expectedVersion: number) {
  const res = await fetch(`/api/savings-goals/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ ...data, expectedVersion }),
  });
  if (res.status === 409) {
    const errData = await res.json();
    const err: any = new Error(errData.error);
    err.status = 409;
    throw err;
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to update savings goal');
  }
  return res.json();
}

export async function deleteSavingsGoal(id: string, expectedVersion: number) {
  const res = await fetch(`/api/savings-goals/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
    body: JSON.stringify({ expectedVersion }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to delete savings goal');
  }
  return res.json();
}

export async function bulkTogglePlannedPayments(
  params: { month?: string; include: boolean; onlyUnpaid?: boolean; paymentIds?: string[] },
  expectedVersion: number
) {
  const res = await fetch('/api/planned-payments/bulk-toggle', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ ...params, expectedVersion }),
  });
  if (res.status === 409) {
    const errData = await res.json();
    const err: any = new Error(errData.error);
    err.status = 409;
    throw err;
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to update planned payments');
  }
  return res.json();
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
  const res = await fetch('/api/transfer-plan/execute-transfer', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (res.status === 409) {
    const errData = await res.json();
    const err: any = new Error(errData.error);
    err.status = 409;
    throw err;
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to execute transfer');
  }
  return res.json();
}

export async function switchSession(email: string): Promise<void> {
  const res = await fetch('/api/auth/switch', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to switch user');
  }
  const data = await res.json();
  setAuthToken(data.token);
  localStorage.setItem('mv_current_user', JSON.stringify(data.user));
}

// -------------------------------------------------------------
// Member Management (Owner Only)
// -------------------------------------------------------------
export async function approveMember(memberId: string, role: 'editor' | 'view_only', expectedVersion: number) {
  const res = await fetch('/api/members/approve', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ memberId, role, expectedVersion }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to approve member');
  }
  return res.json();
}

export async function changeMemberRole(memberId: string, newRole: UserRole, expectedVersion: number) {
  const res = await fetch('/api/members/role', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ memberId, newRole, expectedVersion }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to change role');
  }
  return res.json();
}

export async function removeMember(memberId: string, expectedVersion: number) {
  const res = await fetch(`/api/members/${memberId}`, {
    method: 'DELETE',
    headers: getHeaders(),
    body: JSON.stringify({ expectedVersion }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to remove member');
  }
  return res.json();
}

// -------------------------------------------------------------
// Backup & Restore (Preflight + Secure Restore)
// -------------------------------------------------------------
export async function fetchBackup(): Promise<any> {
  const res = await fetch('/api/backup', { headers: getHeaders() });
  if (res.status === 403) {
    throw new Error('Forbidden: Only Owner and Editor can export backups.');
  }
  if (!res.ok) {
    throw new Error('Failed to generate backup');
  }
  return res.json();
}

export async function preflightRestore(backupPayload: any): Promise<{
  valid: boolean;
  counts: Record<string, number>;
  checks: string[];
  summary: string;
}> {
  const res = await fetch('/api/restore/preflight', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(backupPayload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Preflight validation failed');
  }
  return res.json();
}

export async function restoreBackup(backupPayload: any) {
  const res = await fetch('/api/restore', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(backupPayload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to restore backup');
  }
  return res.json();
}

// -------------------------------------------------------------
// Acceptance Test Suite
// -------------------------------------------------------------
export async function runAcceptanceTests(): Promise<{
  timestamp: string;
  summary: { total: number; passed: number; failed: number };
  results: TestResult[];
}> {
  const res = await fetch('/api/tests/run', { headers: getHeaders() });
  if (!res.ok) {
    throw new Error('Failed to run acceptance test suite');
  }
  return res.json();
}

// -------------------------------------------------------------
// Safe Household Reset & Sample Data Management
// -------------------------------------------------------------
export async function resetHouseholdData(): Promise<{ success: boolean; message: string; version: number }> {
  const res = await fetch('/api/household/reset', {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to reset household data');
  }
  return res.json();
}

export async function loadSampleHouseholdData(): Promise<{ success: boolean; message: string; version: number }> {
  const res = await fetch('/api/household/load-sample-data', {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to load sample household data');
  }
  return res.json();
}

// -------------------------------------------------------------
// Real-Time Server-Sent Events (SSE) Listener
// -------------------------------------------------------------
export function subscribeToHouseholdEvents(onUpdate: (version: number, actorEmail: string) => void): () => void {
  if (!currentAuthToken) return () => {};

  try {
    const eventSource = new EventSource('/api/events');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'household_updated') {
          onUpdate(data.version, data.actorEmail);
        }
      } catch (e) {
        // parse error
      }
    };

    return () => {
      eventSource.close();
    };
  } catch (err) {
    return () => {};
  }
}
