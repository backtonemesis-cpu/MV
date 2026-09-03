import {
  HouseholdData,
  UserSession,
  Transaction,
  Account,
  SavingsGoal,
  PlannedPayment,
  TestResult,
  UserRole,
} from '../types';

let sessionEmail = localStorage.getItem('mv_session_email') || 'backtonemesis@gmail.com';

export function getSessionEmail(): string {
  return sessionEmail;
}

export function setSessionEmail(email: string): void {
  sessionEmail = email;
  localStorage.setItem('mv_session_email', email);
}

function getHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-user-email': sessionEmail,
  };
}

export async function fetchSession(): Promise<UserSession & { availableIdentities: { email: string; name: string; role: UserRole }[] }> {
  const res = await fetch('/api/session', { headers: getHeaders() });
  if (!res.ok) {
    throw new Error(`Failed to fetch session: ${res.statusText}`);
  }
  return res.json();
}

export async function switchSession(email: string): Promise<void> {
  const res = await fetch('/api/session/switch', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    throw new Error('Failed to switch user');
  }
  setSessionEmail(email);
}

export async function fetchHousehold(): Promise<HouseholdData> {
  const res = await fetch('/api/household', { headers: getHeaders() });
  if (res.status === 403) {
    const errorData = await res.json().catch(() => ({}));
    const err: any = new Error(errorData.error || 'Forbidden: Access denied to household data');
    err.status = 403;
    err.role = errorData.role;
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
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to create account');
  }
  return res.json();
}

export async function updateAccount(id: string, data: Partial<Account> & { reconciledBalancePence?: number }, expectedVersion: number) {
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

export async function createSavingsGoal(data: Partial<SavingsGoal>, expectedVersion: number) {
  const res = await fetch('/api/savings', {
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
  const res = await fetch(`/api/savings/${id}`, {
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

export async function approveMember(memberId: string, role: 'editor' | 'view_only') {
  const res = await fetch('/api/members/approve', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ memberId, role }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to approve member');
  }
  return res.json();
}

export async function changeMemberRole(memberId: string, newRole: UserRole) {
  const res = await fetch('/api/members/role', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ memberId, newRole }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to change role');
  }
  return res.json();
}

export async function removeMember(memberId: string) {
  const res = await fetch('/api/members/remove', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ memberId }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to remove member');
  }
  return res.json();
}

export async function fetchBackup(): Promise<any> {
  const res = await fetch('/api/backup', { headers: getHeaders() });
  if (!res.ok) {
    throw new Error('Failed to generate backup');
  }
  return res.json();
}

export async function restoreBackup(backupPayload: any) {
  const res = await fetch('/api/restore', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ backupPayload }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to restore backup');
  }
  return res.json();
}

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
