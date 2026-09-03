import express from 'express';
import { createServer, type Server } from 'node:http';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { getMvFirestore } from './firestoreAdmin';
import { createFirestorePlannedFinanceRouter } from './firestorePlannedFinanceRoutes';
import { FirestoreCoreMutationStore } from './storage/coreMutations';
import { FirestoreEdgeMutationStore } from './storage/edgeMutations';
import { FirestoreHouseholdStore } from './storage/firestoreStore';
import { HOUSEHOLD_ID } from './storage/contracts';

const describeEmulator = process.env.FIRESTORE_EMULATOR_HOST
  ? describe
  : describe.skip;

describeEmulator('Firestore planned finance HTTP routes', () => {
  const db = getMvFirestore();
  const store = new FirestoreHouseholdStore(db);
  const core = new FirestoreCoreMutationStore(db, store);
  const edge = new FirestoreEdgeMutationStore(db, store);
  const householdRef = db.collection('households').doc(HOUSEHOLD_ID);
  let server: Server | null = null;
  let baseUrl = '';

  async function startApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = {
        id: 'firebase-marius',
        email: 'backtonemesis@gmail.com',
        name: 'Marius',
        role: 'owner',
      };
      next();
    });
    app.use(
      '/api',
      createFirestorePlannedFinanceRouter({
        db,
        store,
        core,
        edge,
      })
    );

    server = createServer(app);
    await new Promise<void>((resolve) => {
      server!.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Test HTTP server did not bind to a TCP port');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  async function request(
    path: string,
    method: string,
    body?: Record<string, unknown>
  ) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json();
    return { response, payload };
  }

  beforeEach(async () => {
    await db.recursiveDelete(householdRef);
    await store.ensureHousehold();

    await householdRef.collection('members').doc('firebase-marius').set({
      email: 'backtonemesis@gmail.com',
      name: 'Marius',
      role: 'owner',
      joinedAt: '2026-09-04T00:00:00.000Z',
      lastActiveAt: '2026-09-04T00:00:00.000Z',
    });

    await Promise.all([
      householdRef.collection('accounts').doc('acc-main').set({
        name: 'Marius Current',
        type: 'current',
        currency: 'GBP',
        startingBalancePence: 100000,
        currentBalancePence: 100000,
        ownerPerson: 'Marius',
        isActive: true,
        schemaVersion: 1,
      }),
      householdRef.collection('accounts').doc('acc-savings').set({
        name: 'Joint Savings',
        type: 'savings',
        currency: 'GBP',
        startingBalancePence: 20000,
        currentBalancePence: 20000,
        ownerPerson: 'Joint',
        isActive: true,
        schemaVersion: 1,
      }),
      householdRef.collection('categories').doc('cat-housing').set({
        name: 'Housing',
        group: 'Bills',
        monthlyBudgetPence: 0,
        icon: 'home',
        isArchived: false,
      }),
      householdRef.collection('categories').doc('cat-salary').set({
        name: 'Salary',
        group: 'Income',
        monthlyBudgetPence: 0,
        icon: 'wallet',
        isArchived: false,
      }),
      householdRef.collection('categories').doc('cat-transfer').set({
        name: 'Internal Transfer',
        group: 'Savings',
        monthlyBudgetPence: 0,
        icon: 'arrow-right-left',
        isArchived: false,
      }),
    ]);

    await startApp();
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve()))
      );
      server = null;
    }
  });

  afterAll(async () => {
    await db.recursiveDelete(householdRef);
  });

  it('creates, updates, toggles and pays a planned bill with exact linked expense', async () => {
    let result = await request('/api/planned-payments', 'POST', {
      expectedVersion: 1,
      name: 'Rent',
      amountPence: 50000,
      month: '2026-09',
      responsiblePerson: 'Marius',
      accountId: 'acc-main',
      dueDate: '2026-09-10',
      categoryId: 'cat-housing',
      status: 'unpaid',
      includeInTransferPlan: true,
    });
    expect(result.response.status).toBe(201);
    expect(result.payload.version).toBe(2);
    const paymentId = result.payload.id;

    result = await request(`/api/planned-payments/${paymentId}`, 'PUT', {
      expectedVersion: 2,
      name: 'Rent corrected',
      amountPence: 51000,
      month: '2026-09',
      responsiblePerson: 'Marius',
      accountId: 'acc-main',
      dueDate: '2026-09-10',
      categoryId: 'cat-housing',
      status: 'unpaid',
      includeInTransferPlan: true,
    });
    expect(result.response.status).toBe(200);
    expect(result.payload.version).toBe(3);

    result = await request('/api/planned-payments/bulk-toggle', 'POST', {
      expectedVersion: 3,
      month: '2026-09',
      include: false,
      onlyUnpaid: true,
      paymentIds: [paymentId],
    });
    expect(result.response.status).toBe(200);
    expect(result.payload.updatedCount).toBe(1);
    expect(result.payload.version).toBe(4);

    result = await request(`/api/planned-payments/${paymentId}/pay`, 'POST', {
      expectedVersion: 4,
      actualAmountPence: 50500,
      actualDate: '2026-09-10',
      accountId: 'acc-main',
    });
    expect(result.response.status).toBe(200);
    expect(result.payload).toMatchObject({
      success: true,
      paymentId,
      actualAmountPence: 50500,
      actualDate: '2026-09-10',
      version: 5,
    });

    const data = await store.getHouseholdData();
    const payment = data.plannedPayments.find((item) => item.id === paymentId);
    const actual = data.transactions.find(
      (item) => item.id === result.payload.actualTransactionId
    );

    expect(payment).toMatchObject({
      status: 'paid',
      actualAmountPence: 50500,
      actualDate: '2026-09-10',
      actualTransactionId: result.payload.actualTransactionId,
      includeInTransferPlan: false,
    });
    expect(actual).toMatchObject({
      type: 'expense',
      amountPence: 50500,
      accountId: 'acc-main',
      plannedPaymentId: paymentId,
    });
    expect(
      data.accounts.find((item) => item.id === 'acc-main')
        ?.currentBalancePence
    ).toBe(49500);
  });

  it('creates and receives planned income with exact linked account inflow', async () => {
    let result = await request('/api/planned-incomes', 'POST', {
      expectedVersion: 1,
      name: 'Marius Salary',
      expectedAmountPence: 200000,
      month: '2026-09',
      sourcePerson: 'Marius',
      accountId: 'acc-main',
      expectedDate: '2026-09-12',
      status: 'expected',
    });
    expect(result.response.status).toBe(201);
    expect(result.payload.version).toBe(2);
    const incomeId = result.payload.id;

    result = await request(`/api/planned-incomes/${incomeId}/receive`, 'POST', {
      expectedVersion: 2,
      actualAmountPence: 201000,
      actualDate: '2026-09-12',
      accountId: 'acc-main',
    });
    expect(result.response.status).toBe(200);
    expect(result.payload.version).toBe(3);

    const data = await store.getHouseholdData();
    const income = data.plannedIncomes?.find((item) => item.id === incomeId);
    const actual = data.transactions.find(
      (item) => item.id === result.payload.actualTransactionId
    );

    expect(income).toMatchObject({
      status: 'received',
      actualAmountPence: 201000,
      actualDate: '2026-09-12',
      actualTransactionId: result.payload.actualTransactionId,
    });
    expect(actual).toMatchObject({
      type: 'income',
      amountPence: 201000,
      accountId: 'acc-main',
      plannedIncomeId: incomeId,
    });
    expect(
      data.accounts.find((item) => item.id === 'acc-main')
        ?.currentBalancePence
    ).toBe(301000);
  });

  it('executes one internal transfer and moves balances exactly once', async () => {
    const result = await request('/api/transfer-plan/execute-transfer', 'POST', {
      expectedVersion: 1,
      sourceAccountId: 'acc-main',
      destinationAccountId: 'acc-savings',
      amountPence: 25000,
      description: 'Fund savings',
      date: '2026-09-04',
      payer: 'Joint',
    });
    expect(result.response.status).toBe(200);
    expect(result.payload.version).toBe(2);

    const data = await store.getHouseholdData();
    expect(
      data.accounts.find((item) => item.id === 'acc-main')
        ?.currentBalancePence
    ).toBe(75000);
    expect(
      data.accounts.find((item) => item.id === 'acc-savings')
        ?.currentBalancePence
    ).toBe(45000);
    expect(
      data.transactions.find((item) => item.id === result.payload.transactionId)
    ).toMatchObject({
      type: 'transfer',
      isTransfer: true,
      accountId: 'acc-main',
      targetAccountId: 'acc-savings',
      amountPence: 25000,
    });
  });

  it('imports selected previous-month bills once and skips equivalent duplicates on retry', async () => {
    let result = await request('/api/planned-payments', 'POST', {
      expectedVersion: 1,
      name: 'Broadband',
      amountPence: 3000,
      month: '2026-09',
      responsiblePerson: 'Vesta',
      accountId: 'acc-main',
      dueDate: '2026-09-12',
      categoryId: 'cat-housing',
      status: 'unpaid',
      includeInTransferPlan: true,
    });
    const sourceId = result.payload.id;
    expect(result.payload.version).toBe(2);

    result = await request('/api/months/import', 'POST', {
      expectedVersion: 2,
      sourceMonth: '2026-09',
      targetMonth: '2026-10',
      paymentIds: [sourceId],
    });
    expect(result.response.status).toBe(200);
    expect(result.payload).toMatchObject({
      success: true,
      importedCount: 1,
      targetMonth: '2026-10',
      version: 3,
    });

    result = await request('/api/months/import', 'POST', {
      expectedVersion: 3,
      sourceMonth: '2026-09',
      targetMonth: '2026-10',
      paymentIds: [sourceId],
    });
    expect(result.response.status).toBe(200);
    expect(result.payload).toMatchObject({
      importedCount: 0,
      version: 4,
    });

    const data = await store.getHouseholdData();
    const imported = data.plannedPayments.filter(
      (item) => item.name === 'Broadband' && item.month === '2026-10'
    );
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({
      dueDate: '2026-10-12',
      status: 'unpaid',
      includeInTransferPlan: true,
    });
  });

  it('rejects stale planned-data writes without partial link or audit changes', async () => {
    const first = await request('/api/planned-payments', 'POST', {
      expectedVersion: 1,
      name: 'Water',
      amountPence: 2000,
      month: '2026-09',
      responsiblePerson: 'Marius',
      accountId: 'acc-main',
      categoryId: 'cat-housing',
      status: 'unpaid',
      includeInTransferPlan: true,
    });
    expect(first.response.status).toBe(201);

    const stale = await request('/api/planned-incomes', 'POST', {
      expectedVersion: 1,
      name: 'Must Not Persist',
      expectedAmountPence: 10000,
      month: '2026-09',
      sourcePerson: 'Vesta',
      accountId: 'acc-main',
    });
    expect(stale.response.status).toBe(409);
    expect(stale.payload.serverVersion).toBe(2);

    const data = await store.getHouseholdData();
    expect(data.plannedIncomes).toEqual([]);
    expect(data.version).toBe(2);
  });

  it('rejects missing planned-data account references before writing', async () => {
    const result = await request('/api/planned-incomes', 'POST', {
      expectedVersion: 1,
      name: 'Invalid income',
      expectedAmountPence: 10000,
      month: '2026-09',
      sourcePerson: 'Vesta',
      accountId: 'missing-account',
    });
    expect(result.response.status).toBe(400);
    expect(result.payload.error).toBe('Validation failed');

    const data = await store.getHouseholdData();
    expect(data.plannedIncomes).toEqual([]);
    expect(data.version).toBe(1);
  });
});
