import express from 'express';
import { createServer, type Server } from 'node:http';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getMvFirestore } from './firestoreAdmin';
import { createFirestorePlanningRouter } from './firestorePlanningRoutes';
import { FirestoreCoreMutationStore } from './storage/coreMutations';
import { FirestoreEdgeMutationStore } from './storage/edgeMutations';
import { FirestoreHouseholdStore } from './storage/firestoreStore';
import { HOUSEHOLD_ID } from './storage/contracts';

const describeEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

describeEmulator('Firestore planning HTTP routes', () => {
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
      createFirestorePlanningRouter({ db, store, core, edge })
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

  async function seedAccounts() {
    await Promise.all([
      householdRef.collection('accounts').doc('acc-main').set({
        name: 'Marius Current',
        type: 'current',
        currency: 'GBP',
        startingBalancePence: 100000,
        currentBalancePence: 100000,
        ownerPerson: 'Marius',
        isActive: true,
        schemaVersion: 3,
      }),
      householdRef.collection('accounts').doc('acc-savings').set({
        name: 'Joint Savings',
        type: 'savings',
        currency: 'GBP',
        startingBalancePence: 20000,
        currentBalancePence: 20000,
        ownerPerson: 'Joint',
        isActive: true,
        schemaVersion: 3,
      }),
    ]);
  }

  beforeEach(async () => {
    await db.recursiveDelete(householdRef);
    await store.ensureHousehold();
    await seedAccounts();
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

  it('boots the standard category catalogue without inventing financial records', async () => {
    const data = await store.getHouseholdData();
    expect(data.categories.map((category) => category.id)).toEqual(
      expect.arrayContaining(['cat-housing', 'cat-salary', 'cat-transfer'])
    );
    expect(data.transactions).toEqual([]);
    expect(data.plannedPayments).toEqual([]);
    expect(data.plannedIncomes).toEqual([]);
    expect(data.savingsGoals).toEqual([]);
  });

  it('creates a planned bill, links one actual expense, and rejects a second actualization', async () => {
    let result = await request('/api/planned-payments', 'POST', {
      expectedVersion: 1,
      name: 'Rent',
      amountPence: 50000,
      month: '2026-09',
      responsiblePerson: 'Marius',
      accountId: 'acc-main',
      dueDate: '2026-09-10',
      categoryId: 'cat-housing',
      includeInTransferPlan: true,
    });
    expect(result.response.status).toBe(201);
    expect(result.payload.version).toBe(2);
    const paymentId = result.payload.id;

    result = await request(`/api/planned-payments/${paymentId}/pay`, 'POST', {
      expectedVersion: 2,
      actualAmountPence: 50000,
      actualDate: '2026-09-10',
    });
    expect(result.response.status).toBe(200);
    expect(result.payload).toMatchObject({
      success: true,
      paymentId,
      actualAmountPence: 50000,
      actualDate: '2026-09-10',
      version: 3,
    });

    let data = await store.getHouseholdData();
    expect(data.plannedPayments.find((item) => item.id === paymentId)).toMatchObject({
      status: 'paid',
      actualAmountPence: 50000,
      actualDate: '2026-09-10',
      actualTransactionId: result.payload.actualTransactionId,
    });
    expect(
      data.transactions.find((item) => item.id === result.payload.actualTransactionId)
    ).toMatchObject({
      type: 'expense',
      categoryId: 'cat-housing',
      plannedPaymentId: paymentId,
      amountPence: 50000,
    });
    expect(
      data.accounts.find((account) => account.id === 'acc-main')?.currentBalancePence
    ).toBe(50000);

    result = await request(`/api/planned-payments/${paymentId}/pay`, 'POST', {
      expectedVersion: 3,
      actualAmountPence: 50000,
      actualDate: '2026-09-10',
    });
    expect(result.response.status).toBe(409);

    data = await store.getHouseholdData();
    expect(data.transactions.filter((item) => item.plannedPaymentId === paymentId)).toHaveLength(1);
    expect(data.version).toBe(3);
  });

  it('creates a planned income, links one actual inflow, and rejects a second receipt', async () => {
    let result = await request('/api/planned-incomes', 'POST', {
      expectedVersion: 1,
      name: 'Marius Salary',
      expectedAmountPence: 200000,
      month: '2026-09',
      sourcePerson: 'Marius',
      accountId: 'acc-main',
      expectedDate: '2026-09-12',
    });
    expect(result.response.status).toBe(201);
    expect(result.payload.version).toBe(2);
    const incomeId = result.payload.id;

    result = await request(`/api/planned-incomes/${incomeId}/receive`, 'POST', {
      expectedVersion: 2,
      actualAmountPence: 200000,
      actualDate: '2026-09-12',
    });
    expect(result.response.status).toBe(200);
    expect(result.payload.version).toBe(3);

    let data = await store.getHouseholdData();
    expect(data.plannedIncomes?.find((item) => item.id === incomeId)).toMatchObject({
      status: 'received',
      actualAmountPence: 200000,
      actualDate: '2026-09-12',
      actualTransactionId: result.payload.actualTransactionId,
    });
    expect(
      data.transactions.find((item) => item.id === result.payload.actualTransactionId)
    ).toMatchObject({
      type: 'income',
      categoryId: 'cat-salary',
      plannedIncomeId: incomeId,
      amountPence: 200000,
    });
    expect(
      data.accounts.find((account) => account.id === 'acc-main')?.currentBalancePence
    ).toBe(300000);

    result = await request(`/api/planned-incomes/${incomeId}/receive`, 'POST', {
      expectedVersion: 3,
      actualAmountPence: 200000,
      actualDate: '2026-09-12',
    });
    expect(result.response.status).toBe(409);

    data = await store.getHouseholdData();
    expect(data.transactions.filter((item) => item.plannedIncomeId === incomeId)).toHaveLength(1);
    expect(data.version).toBe(3);
  });

  it('updates and deletes planned bills and incomes through the Firestore HTTP routes', async () => {
    let result = await request('/api/planned-payments', 'POST', {
      expectedVersion: 1,
      name: 'Broadband',
      amountPence: 3000,
      month: '2026-09',
      responsiblePerson: 'Vesta',
      accountId: 'acc-main',
      categoryId: 'cat-internet',
    });
    const paymentId = result.payload.id;
    expect(result.payload.version).toBe(2);

    result = await request(`/api/planned-payments/${paymentId}`, 'PUT', {
      expectedVersion: 2,
      name: 'Vodafone Broadband',
      amountPence: 3250,
      month: '2026-09',
      responsiblePerson: 'Vesta',
      accountId: 'acc-main',
      dueDate: '2026-09-13',
      categoryId: 'cat-internet',
      includeInTransferPlan: false,
    });
    expect(result.response.status).toBe(200);
    expect(result.payload.version).toBe(3);

    result = await request('/api/planned-incomes', 'POST', {
      expectedVersion: 3,
      name: 'Child Benefit',
      expectedAmountPence: 10000,
      month: '2026-09',
      sourcePerson: 'Vesta',
      accountId: 'acc-main',
      expectedDate: '2026-09-18',
    });
    const incomeId = result.payload.id;
    expect(result.payload.version).toBe(4);

    result = await request(`/api/planned-incomes/${incomeId}`, 'PUT', {
      expectedVersion: 4,
      name: 'Child Benefit Updated',
      expectedAmountPence: 10500,
      month: '2026-09',
      sourcePerson: 'Vesta',
      accountId: 'acc-main',
      expectedDate: '2026-09-19',
    });
    expect(result.response.status).toBe(200);
    expect(result.payload.version).toBe(5);

    let data = await store.getHouseholdData();
    expect(data.plannedPayments.find((item) => item.id === paymentId)).toMatchObject({
      name: 'Vodafone Broadband',
      amountPence: 3250,
      includeInTransferPlan: false,
    });
    expect(data.plannedIncomes?.find((item) => item.id === incomeId)).toMatchObject({
      name: 'Child Benefit Updated',
      expectedAmountPence: 10500,
    });

    result = await request(`/api/planned-payments/${paymentId}`, 'DELETE', {
      expectedVersion: 5,
    });
    expect(result.response.status).toBe(200);
    expect(result.payload.version).toBe(6);

    result = await request(`/api/planned-incomes/${incomeId}`, 'DELETE', {
      expectedVersion: 6,
    });
    expect(result.response.status).toBe(200);
    expect(result.payload.version).toBe(7);

    data = await store.getHouseholdData();
    expect(data.plannedPayments.some((item) => item.id === paymentId)).toBe(false);
    expect(data.plannedIncomes?.some((item) => item.id === incomeId)).toBe(false);
  });

  it('executes an internal transfer exactly once across source and destination balances', async () => {
    const result = await request('/api/transfer-plan/execute-transfer', 'POST', {
      expectedVersion: 1,
      sourceAccountId: 'acc-main',
      destinationAccountId: 'acc-savings',
      amountPence: 25000,
      date: '2026-09-13',
    });
    expect(result.response.status).toBe(200);
    expect(result.payload.version).toBe(2);

    const data = await store.getHouseholdData();
    expect(
      data.accounts.find((account) => account.id === 'acc-main')?.currentBalancePence
    ).toBe(75000);
    expect(
      data.accounts.find((account) => account.id === 'acc-savings')?.currentBalancePence
    ).toBe(45000);
    expect(data.transactions.find((item) => item.id === result.payload.transactionId)).toMatchObject({
      type: 'transfer',
      categoryId: 'cat-transfer',
      isTransfer: true,
      accountId: 'acc-main',
      targetAccountId: 'acc-savings',
      amountPence: 25000,
    });
  });

  it('bulk toggles selected unpaid bills and imports the next month without duplicates', async () => {
    const payments = householdRef.collection('plannedPayments');
    await Promise.all([
      payments.doc('bill-rent').set({
        name: 'Rent',
        amountPence: 50000,
        month: '2026-09',
        responsiblePerson: 'Marius',
        accountId: 'acc-main',
        dueDate: '2026-09-05',
        categoryId: 'cat-housing',
        status: 'unpaid',
        includeInTransferPlan: true,
        schemaVersion: 3,
      }),
      payments.doc('bill-broadband').set({
        name: 'Broadband',
        amountPence: 3000,
        month: '2026-09',
        responsiblePerson: 'Vesta',
        accountId: 'acc-main',
        dueDate: '2026-09-12',
        categoryId: 'cat-internet',
        status: 'unpaid',
        includeInTransferPlan: true,
        schemaVersion: 3,
      }),
      payments.doc('bill-water-paid').set({
        name: 'Water',
        amountPence: 2000,
        month: '2026-09',
        responsiblePerson: 'Marius',
        accountId: 'acc-main',
        dueDate: '2026-09-15',
        categoryId: 'cat-water',
        status: 'paid',
        includeInTransferPlan: true,
        schemaVersion: 3,
      }),
      payments.doc('bill-oct-rent').set({
        name: 'Rent',
        amountPence: 50000,
        month: '2026-10',
        responsiblePerson: 'Marius',
        accountId: 'acc-main',
        dueDate: '2026-10-05',
        categoryId: 'cat-housing',
        status: 'unpaid',
        includeInTransferPlan: true,
        schemaVersion: 3,
      }),
    ]);

    let result = await request('/api/planned-payments/bulk-toggle', 'POST', {
      expectedVersion: 1,
      month: '2026-09',
      include: false,
      onlyUnpaid: true,
      paymentIds: ['bill-rent', 'bill-water-paid'],
    });
    expect(result.response.status).toBe(200);
    expect(result.payload).toMatchObject({
      success: true,
      updatedCount: 1,
      version: 2,
    });

    result = await request('/api/months/import', 'POST', {
      expectedVersion: 2,
      sourceMonth: '2026-09',
      targetMonth: '2026-10',
      paymentIds: ['bill-rent', 'bill-broadband'],
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
      paymentIds: ['bill-rent', 'bill-broadband'],
    });
    expect(result.response.status).toBe(200);
    expect(result.payload.importedCount).toBe(0);
    expect(result.payload.version).toBe(4);

    const data = await store.getHouseholdData();
    expect(
      data.plannedPayments.filter(
        (item) => item.name === 'Broadband' && item.month === '2026-10'
      )
    ).toHaveLength(1);
    expect(
      data.plannedPayments.find((item) => item.id === 'bill-rent')?.includeInTransferPlan
    ).toBe(false);
    expect(
      data.plannedPayments.find((item) => item.id === 'bill-water-paid')?.includeInTransferPlan
    ).toBe(true);
  });

  it('rejects stale planning writes without partial data or audit inflation', async () => {
    let result = await request('/api/planned-payments', 'POST', {
      expectedVersion: 1,
      name: 'Council Tax',
      amountPence: 12000,
      month: '2026-09',
      responsiblePerson: 'Marius',
      accountId: 'acc-main',
      categoryId: 'cat-council-tax',
    });
    expect(result.response.status).toBe(201);
    expect(result.payload.version).toBe(2);

    result = await request('/api/planned-incomes', 'POST', {
      expectedVersion: 1,
      name: 'Must Not Persist',
      expectedAmountPence: 10000,
      month: '2026-09',
      sourcePerson: 'Vesta',
      accountId: 'acc-main',
    });
    expect(result.response.status).toBe(409);
    expect(result.payload.serverVersion).toBe(2);

    const data = await store.getHouseholdData();
    expect(data.plannedIncomes).toEqual([]);
    expect(data.version).toBe(2);
    expect(data.auditLogs).toHaveLength(1);
  });

  it('rejects a planned bill that references a missing explicit category', async () => {
    const result = await request('/api/planned-payments', 'POST', {
      expectedVersion: 1,
      name: 'Unknown category bill',
      amountPence: 1000,
      month: '2026-09',
      responsiblePerson: 'Marius',
      accountId: 'acc-main',
      categoryId: 'cat-does-not-exist',
    });
    expect(result.response.status).toBe(400);
    expect(result.payload.error).toBe('Validation failed');

    const data = await store.getHouseholdData();
    expect(data.plannedPayments).toEqual([]);
    expect(data.version).toBe(1);
  });
});
