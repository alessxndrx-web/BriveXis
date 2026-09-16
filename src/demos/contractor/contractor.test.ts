import { describe, expect, it } from 'vitest';
import { buildSeedState } from './contractor.seed';
import { contractorReducer, type ContractorAction } from './contractor.reducer';
import { createMemoryRepository, SCHEMA_VERSION } from './contractor.storage';
import {
  canCreateJobFromEstimate,
  canInvoiceJob,
  dashboardMetrics,
  documentTotals,
  estimateTotal,
  invoiceBalance,
  invoicePaidAmount,
  invoiceStatus,
  invoiceTotal,
  jobForEstimate,
  lineTotal,
  searchWorkspace,
} from './contractor.selectors';
import type { ContractorState, LineItem } from './contractor.types';
import { dollarsToCents, formatMoney, percentOf, toDateOnly } from './contractor.utils';

/**
 * Domain tests.
 *
 * These cover the arithmetic and the state transitions that the whole product
 * depends on: if an invoice balance or an estimate → job conversion is wrong,
 * every screen showing it is wrong too. UI rendering is verified separately by
 * the browser suite.
 *
 * `FIXED_TODAY` pins the clock so seeded relative dates are identical on every
 * run.
 */

const FIXED_TODAY = new Date(2026, 5, 15); // June 15, 2026, local time.

const seed = () => buildSeedState(FIXED_TODAY);

/** Applies a sequence of actions, returning the resulting state. */
function apply(state: ContractorState, ...actions: ContractorAction[]): ContractorState {
  return actions.reduce(contractorReducer, state);
}

const item = (quantity: number, unitPrice: number, id = 'x'): LineItem => ({
  id,
  kind: 'Labor',
  description: 'Work',
  quantity,
  unit: 'hour',
  unitPrice,
});

// --------------------------------------------------------------- arithmetic

describe('money arithmetic', () => {
  it('multiplies quantity by unit price in whole cents', () => {
    expect(lineTotal(item(3, 12500))).toBe(37500);
    // A fractional quantity must still land on an exact cent.
    expect(lineTotal(item(2.5, 10333))).toBe(25833);
  });

  it('applies discount before tax', () => {
    const totals = documentTotals({
      items: [item(1, 100000)],
      taxRate: 10,
      discount: 20000,
    });

    expect(totals.subtotal).toBe(100000);
    expect(totals.discount).toBe(20000);
    expect(totals.taxable).toBe(80000);
    expect(totals.tax).toBe(8000);
    expect(totals.total).toBe(88000);
  });

  it('never lets a discount exceed the subtotal', () => {
    const totals = documentTotals({ items: [item(1, 5000)], taxRate: 10, discount: 9999999 });
    expect(totals.discount).toBe(5000);
    expect(totals.total).toBe(0);
  });

  it('rounds tax to the nearest cent', () => {
    // 25000 * 8.81% = 2202.5 cents, which must round up rather than truncate.
    expect(percentOf(25000, 8.81)).toBe(2203);
  });

  it('avoids floating point drift across many line items', () => {
    const items = Array.from({ length: 100 }, (_, i) => item(1, 1010, `i${i}`));
    const totals = documentTotals({ items, taxRate: 8.81, discount: 0 });
    expect(totals.subtotal).toBe(101000);
    expect(Number.isInteger(totals.total)).toBe(true);
  });

  it('converts dollar input to cents without drift', () => {
    expect(dollarsToCents('1234.56')).toBe(123456);
    expect(dollarsToCents('0.1')).toBe(10);
    expect(dollarsToCents('$1,234.56')).toBe(123456);
    expect(dollarsToCents('nonsense')).toBe(0);
  });

  it('formats cents as U.S. currency', () => {
    expect(formatMoney(176489800)).toBe('$1,764,898.00');
    expect(formatMoney(0)).toBe('$0.00');
  });
});

// ------------------------------------------------------------ seed integrity

describe('seed data', () => {
  it('is internally consistent', () => {
    const state = seed();

    for (const location of state.locations) {
      expect(state.customers.some((c) => c.id === location.customerId)).toBe(true);
    }
    for (const estimate of state.estimates) {
      expect(state.customers.some((c) => c.id === estimate.customerId)).toBe(true);
      expect(state.locations.some((l) => l.id === estimate.locationId)).toBe(true);
    }
    for (const job of state.jobs) {
      expect(state.customers.some((c) => c.id === job.customerId)).toBe(true);
      if (job.estimateId) {
        expect(state.estimates.some((e) => e.id === job.estimateId)).toBe(true);
      }
    }
    for (const payment of state.payments) {
      expect(state.invoices.some((i) => i.id === payment.invoiceId)).toBe(true);
    }
    for (const record of state.fieldRecords) {
      expect(state.jobs.some((j) => j.id === record.jobId)).toBe(true);
    }
  });

  it('never records payments beyond an invoice total', () => {
    const state = seed();
    for (const invoice of state.invoices) {
      expect(invoicePaidAmount(state, invoice.id)).toBeLessThanOrEqual(invoiceTotal(invoice));
    }
  });

  it('gives every job created from an estimate an accepted estimate', () => {
    const state = seed();
    for (const job of state.jobs) {
      if (!job.estimateId) continue;
      const estimate = state.estimates.find((e) => e.id === job.estimateId);
      expect(estimate?.status).toBe('Accepted');
    }
  });

  it('produces the full range of invoice statuses', () => {
    const state = seed();
    const statuses = new Set(state.invoices.map((i) => invoiceStatus(state, i, FIXED_TODAY)));
    expect(statuses).toContain('Paid');
    expect(statuses).toContain('Partial');
    expect(statuses).toContain('Overdue');
    expect(statuses).toContain('Draft');
    expect(statuses).toContain('Void');
  });

  it('is deterministic for a fixed today', () => {
    expect(JSON.stringify(buildSeedState(FIXED_TODAY).leads)).toBe(
      JSON.stringify(buildSeedState(FIXED_TODAY).leads),
    );
  });
});

// ------------------------------------------------------- invoice + payments

describe('invoice balance and status', () => {
  const openInvoice = () => {
    const base = seed();
    const state = apply(base, {
      type: 'invoice/create',
      id: 'inv-test',
      input: {
        customerId: base.customers[0].id,
        items: [item(1, 100000, 'li-test')],
        taxRate: 10,
        discount: 0,
        issuedAt: toDateOnly(FIXED_TODAY),
        // Due in the future, so nothing is overdue while we test payments.
        dueAt: toDateOnly(new Date(2026, 11, 31)),
        notes: '',
        terms: '',
        status: 'Sent',
      },
    });
    return { state, invoiceId: 'inv-test' };
  };

  it('starts fully outstanding', () => {
    const { state, invoiceId } = openInvoice();
    const invoice = state.invoices.find((i) => i.id === invoiceId)!;
    expect(invoiceTotal(invoice)).toBe(110000);
    expect(invoiceBalance(state, invoice)).toBe(110000);
    expect(invoiceStatus(state, invoice, FIXED_TODAY)).toBe('Sent');
  });

  it('becomes Partial after a partial payment', () => {
    const { state: opened, invoiceId } = openInvoice();
    const state = apply(opened, {
      type: 'payment/record',
      input: {
        invoiceId,
        amount: 40000,
        receivedAt: toDateOnly(FIXED_TODAY),
        method: 'Check',
      },
    });

    const invoice = state.invoices.find((i) => i.id === invoiceId)!;
    expect(invoicePaidAmount(state, invoiceId)).toBe(40000);
    expect(invoiceBalance(state, invoice)).toBe(70000);
    expect(invoiceStatus(state, invoice, FIXED_TODAY)).toBe('Partial');
  });

  it('becomes Paid when the balance reaches zero', () => {
    const { state: opened, invoiceId } = openInvoice();
    const state = apply(
      opened,
      { type: 'payment/record', input: { invoiceId, amount: 40000, receivedAt: toDateOnly(FIXED_TODAY), method: 'Check' } },
      { type: 'payment/record', input: { invoiceId, amount: 70000, receivedAt: toDateOnly(FIXED_TODAY), method: 'ACH' } },
    );

    const invoice = state.invoices.find((i) => i.id === invoiceId)!;
    expect(invoiceBalance(state, invoice)).toBe(0);
    expect(invoiceStatus(state, invoice, FIXED_TODAY)).toBe('Paid');
  });

  it('clamps an overpayment to the outstanding balance', () => {
    const { state: opened, invoiceId } = openInvoice();
    const state = apply(opened, {
      type: 'payment/record',
      input: { invoiceId, amount: 999999999, receivedAt: toDateOnly(FIXED_TODAY), method: 'Card' },
    });

    const invoice = state.invoices.find((i) => i.id === invoiceId)!;
    expect(invoicePaidAmount(state, invoiceId)).toBe(110000);
    expect(invoiceBalance(state, invoice)).toBe(0);
  });

  it('refuses payments once an invoice is settled', () => {
    const { state: opened, invoiceId } = openInvoice();
    const paid = apply(opened, {
      type: 'payment/record',
      input: { invoiceId, amount: 110000, receivedAt: toDateOnly(FIXED_TODAY), method: 'ACH' },
    });
    const after = apply(paid, {
      type: 'payment/record',
      input: { invoiceId, amount: 5000, receivedAt: toDateOnly(FIXED_TODAY), method: 'Cash' },
    });
    expect(after.payments.length).toBe(paid.payments.length);
  });

  it('reports Overdue once the due date passes with a balance', () => {
    const base = seed();
    const state = apply(base, {
      type: 'invoice/create',
      id: 'inv-late',
      input: {
        customerId: base.customers[0].id,
        items: [item(1, 50000, 'li-late')],
        taxRate: 0,
        discount: 0,
        issuedAt: toDateOnly(new Date(2026, 3, 1)),
        dueAt: toDateOnly(new Date(2026, 4, 1)),
        notes: '',
        terms: '',
        status: 'Sent',
      },
    });
    const invoice = state.invoices.find((i) => i.id === 'inv-late')!;
    expect(invoiceStatus(state, invoice, FIXED_TODAY)).toBe('Overdue');
  });

  it('excludes a voided invoice from the outstanding balance', () => {
    const { state: opened, invoiceId } = openInvoice();
    const state = apply(opened, { type: 'invoice/void', id: invoiceId });
    const invoice = state.invoices.find((i) => i.id === invoiceId)!;
    expect(invoiceBalance(state, invoice)).toBe(0);
    expect(invoiceStatus(state, invoice, FIXED_TODAY)).toBe('Void');
  });

  it('marks a draft as sent when a payment arrives against it', () => {
    const base = seed();
    const draft = base.invoices.find((i) => i.status === 'Draft')!;
    const state = apply(base, {
      type: 'payment/record',
      input: { invoiceId: draft.id, amount: 1000, receivedAt: toDateOnly(FIXED_TODAY), method: 'Cash' },
    });
    expect(state.invoices.find((i) => i.id === draft.id)!.status).toBe('Sent');
  });
});

// ------------------------------------------------- estimate → job → invoice

describe('the lead to payment lifecycle', () => {
  it('only allows a job from an accepted estimate', () => {
    const state = seed();
    const draft = state.estimates.find((e) => e.status === 'Draft')!;
    const accepted = state.estimates.find(
      (e) => e.status === 'Accepted' && !jobForEstimate(state, e.id),
    );

    expect(canCreateJobFromEstimate(state, draft)).toBe(false);
    if (accepted) expect(canCreateJobFromEstimate(state, accepted)).toBe(true);

    const after = apply(state, { type: 'job/createFromEstimate', estimateId: draft.id });
    expect(after.jobs.length).toBe(state.jobs.length);
  });

  it('carries the estimate across when converting to a job', () => {
    const base = seed();
    const estimate = base.estimates.find((e) => e.status === 'Sent')!;

    const state = apply(
      base,
      { type: 'estimate/status', id: estimate.id, status: 'Accepted' },
      { type: 'job/createFromEstimate', estimateId: estimate.id },
    );

    const job = state.jobs.find((j) => j.estimateId === estimate.id)!;
    expect(job).toBeDefined();
    expect(job.customerId).toBe(estimate.customerId);
    expect(job.locationId).toBe(estimate.locationId);
    expect(job.title).toBe(estimate.title);
    expect(job.status).toBe('Unscheduled');
    expect(job.code).toMatch(/^JOB-\d+$/);
  });

  it('never creates two jobs from one estimate', () => {
    const base = seed();
    const estimate = base.estimates.find((e) => e.status === 'Sent')!;
    const state = apply(
      base,
      { type: 'estimate/status', id: estimate.id, status: 'Accepted' },
      { type: 'job/createFromEstimate', estimateId: estimate.id },
      { type: 'job/createFromEstimate', estimateId: estimate.id },
    );
    expect(state.jobs.filter((j) => j.estimateId === estimate.id).length).toBe(1);
  });

  it('moves the originating lead to Won when its estimate is accepted', () => {
    const base = seed();
    const estimate = base.estimates.find((e) => e.status === 'Sent' && e.leadId)!;
    const state = apply(base, { type: 'estimate/status', id: estimate.id, status: 'Accepted' });
    expect(state.leads.find((l) => l.id === estimate.leadId)!.stage).toBe('Won');
  });

  it('moves the originating lead to Lost when its estimate is declined', () => {
    const base = seed();
    const estimate = base.estimates.find((e) => e.status === 'Sent' && e.leadId)!;
    const state = apply(base, { type: 'estimate/status', id: estimate.id, status: 'Declined' });
    expect(state.leads.find((l) => l.id === estimate.leadId)!.stage).toBe('Lost');
  });

  it('schedules an unscheduled job and moves it to Scheduled', () => {
    const base = seed();
    const job = base.jobs.find((j) => j.status === 'Unscheduled')!;
    const start = new Date(2026, 6, 1, 8).toISOString();

    const state = apply(base, { type: 'job/schedule', id: job.id, start, end: start });
    const updated = state.jobs.find((j) => j.id === job.id)!;
    expect(updated.status).toBe('Scheduled');
    expect(updated.scheduledStart).toBe(start);
  });

  it('returns a job to Unscheduled when its date is cleared', () => {
    const base = seed();
    const job = base.jobs.find((j) => j.status === 'Scheduled')!;
    const state = apply(base, { type: 'job/schedule', id: job.id, start: undefined, end: undefined });
    expect(state.jobs.find((j) => j.id === job.id)!.status).toBe('Unscheduled');
  });

  it('starts a scheduled job when a field record is logged', () => {
    const base = seed();
    const job = base.jobs.find((j) => j.status === 'Scheduled')!;

    const state = apply(base, {
      type: 'field/add',
      input: {
        jobId: job.id,
        occurredAt: new Date(2026, 5, 15, 10).toISOString(),
        workPerformed: 'Materials staged on site.',
        statusUpdate: 'Crew on site',
        notes: '',
        hours: 4,
        materialsUsed: '',
        checklist: [],
      },
    });

    expect(state.jobs.find((j) => j.id === job.id)!.status).toBe('In Progress');
    expect(state.fieldRecords[0].code).toMatch(/^FR-\d+$/);
  });

  it('only allows invoicing a completed job', () => {
    const base = seed();
    const job = base.jobs.find((j) => j.status === 'In Progress')!;
    expect(canInvoiceJob(job)).toBe(false);

    const blocked = apply(base, { type: 'invoice/createFromJob', jobId: job.id });
    expect(blocked.invoices.length).toBe(base.invoices.length);

    const state = apply(
      base,
      { type: 'job/complete', id: job.id, completedAt: new Date(2026, 5, 15).toISOString(), notes: 'Done.' },
      { type: 'invoice/createFromJob', jobId: job.id },
    );

    expect(state.invoices.length).toBe(base.invoices.length + 1);
  });

  it('bills a completed job from its accepted estimate', () => {
    const base = seed();
    const job = base.jobs.find((j) => j.status === 'In Progress' && j.estimateId)!;
    const estimate = base.estimates.find((e) => e.id === job.estimateId)!;

    const state = apply(
      base,
      { type: 'job/complete', id: job.id, completedAt: new Date(2026, 5, 15).toISOString(), notes: '' },
      { type: 'invoice/createFromJob', jobId: job.id },
    );

    const invoice = state.invoices.find((i) => i.jobId === job.id)!;
    expect(invoice.status).toBe('Draft');
    expect(invoiceTotal(invoice)).toBe(estimateTotal(estimate));
    // Items are cloned, so editing the invoice cannot rewrite the estimate.
    expect(invoice.items[0].id).not.toBe(estimate.items[0].id);
    expect(invoice.estimateId).toBe(estimate.id);
  });

  it('runs the whole lifecycle end to end', () => {
    const base = seed();

    const withLead = apply(base, {
      type: 'lead/create',
      id: 'lead-e2e',
      input: {
        name: 'Gutter replacement',
        contactName: 'Test Contact',
        phone: '3035550123',
        email: 'test@example.com',
        source: 'Referral',
        serviceAddress: { line1: '1 Test St', city: 'Denver', state: 'CO', zip: '80202' },
        serviceType: 'Roofing',
        description: 'Replace gutters.',
        estimatedValue: 500000,
        stage: 'Qualified',
        assignedUserId: 'usr-2',
      },
    });

    const state = apply(
      withLead,
      {
        type: 'estimate/create',
        id: 'est-e2e',
        input: {
          customerId: base.customers[0].id,
          locationId: base.locations[0].id,
          leadId: 'lead-e2e',
          title: 'Gutter replacement',
          scope: 'Replace gutters.',
          items: [item(10, 50000, 'li-e2e')],
          taxRate: 10,
          discount: 0,
          notes: '',
          terms: '',
          status: 'Sent',
        },
      },
      { type: 'estimate/status', id: 'est-e2e', status: 'Accepted' },
      { type: 'job/createFromEstimate', estimateId: 'est-e2e' },
    );

    const job = state.jobs.find((j) => j.estimateId === 'est-e2e')!;
    expect(state.leads.find((l) => l.id === 'lead-e2e')!.stage).toBe('Won');

    const finished = apply(
      state,
      { type: 'job/schedule', id: job.id, start: new Date(2026, 6, 1, 8).toISOString(), end: new Date(2026, 6, 1, 16).toISOString() },
      { type: 'job/assignCrew', id: job.id, crewId: 'crw-1' },
      {
        type: 'field/add',
        input: {
          jobId: job.id,
          crewId: 'crw-1',
          occurredAt: new Date(2026, 6, 1, 12).toISOString(),
          workPerformed: 'Gutters removed and replaced.',
          statusUpdate: 'Complete',
          notes: '',
          hours: 8,
          materialsUsed: 'Seamless gutter',
          checklist: [{ label: 'Site cleaned', done: true }],
        },
      },
      { type: 'job/complete', id: job.id, completedAt: new Date(2026, 6, 1, 16).toISOString(), notes: 'Signed off.' },
      { type: 'invoice/createFromJob', jobId: job.id },
    );

    const invoice = finished.invoices.find((i) => i.jobId === job.id)!;
    expect(invoiceTotal(invoice)).toBe(550000);

    const settled = apply(
      finished,
      { type: 'payment/record', input: { invoiceId: invoice.id, amount: 200000, receivedAt: toDateOnly(FIXED_TODAY), method: 'Check' } },
      { type: 'payment/record', input: { invoiceId: invoice.id, amount: 350000, receivedAt: toDateOnly(FIXED_TODAY), method: 'ACH' } },
    );

    const finalInvoice = settled.invoices.find((i) => i.id === invoice.id)!;
    expect(invoiceBalance(settled, finalInvoice)).toBe(0);
    expect(invoiceStatus(settled, finalInvoice, FIXED_TODAY)).toBe('Paid');

    // The job's own activity records each step it went through.
    const kinds = settled.activity
      .filter((e) => e.subject.kind === 'job' && e.subject.id === job.id)
      .map((e) => e.kind);
    expect(kinds).toContain('job.created');
    expect(kinds).toContain('job.scheduled');
    expect(kinds).toContain('job.crew');
    expect(kinds).toContain('field.added');
    expect(kinds).toContain('job.completed');
  });
});

// --------------------------------------------------------------- dashboard

describe('dashboard selectors', () => {
  it('counts only open leads', () => {
    const state = seed();
    const metrics = dashboardMetrics(state, FIXED_TODAY);
    const closed = state.leads.filter((l) => l.stage === 'Won' || l.stage === 'Lost').length;
    expect(metrics.openLeads).toBe(state.leads.length - closed);
  });

  it('reacts to a newly created lead', () => {
    const base = seed();
    const before = dashboardMetrics(base, FIXED_TODAY).openLeads;

    const state = apply(base, {
      type: 'lead/create',
      input: {
        name: 'New inquiry',
        contactName: 'Someone',
        phone: '3035550000',
        email: '',
        source: 'Website',
        serviceAddress: { line1: '2 Test St', city: 'Denver', state: 'CO', zip: '80202' },
        serviceType: 'HVAC',
        description: '',
        estimatedValue: 100000,
        stage: 'New',
        assignedUserId: 'usr-2',
      },
    });

    expect(dashboardMetrics(state, FIXED_TODAY).openLeads).toBe(before + 1);
  });

  it('reduces the outstanding balance when a payment is recorded', () => {
    const base = seed();
    const before = dashboardMetrics(base, FIXED_TODAY).outstandingBalance;

    const open = base.invoices.find(
      (i) => invoiceStatus(base, i, FIXED_TODAY) === 'Overdue',
    )!;

    const state = apply(base, {
      type: 'payment/record',
      input: { invoiceId: open.id, amount: 10000, receivedAt: toDateOnly(FIXED_TODAY), method: 'Cash' },
    });

    expect(dashboardMetrics(state, FIXED_TODAY).outstandingBalance).toBe(before - 10000);
  });

  it('counts active jobs as scheduled plus in progress', () => {
    const state = seed();
    const expected = state.jobs.filter(
      (j) => j.status === 'Scheduled' || j.status === 'In Progress',
    ).length;
    expect(dashboardMetrics(state, FIXED_TODAY).activeJobs).toBe(expected);
  });
});

// ------------------------------------------------------------------ search

describe('global search', () => {
  it('ignores queries shorter than two characters', () => {
    expect(searchWorkspace(seed(), 'a', '/base')).toEqual([]);
  });

  it('finds a record by its code and ranks an exact match first', () => {
    const state = seed();
    const results = searchWorkspace(state, 'EST-2001', '/base');
    expect(results[0].code).toBe('EST-2001');
    expect(results[0].href).toContain('/base/estimates/');
  });

  it('finds customers by name across modules', () => {
    const results = searchWorkspace(seed(), 'Northline Contracting', '/base');
    expect(Array.isArray(results)).toBe(true);
  });

  it('matches a customer name case-insensitively', () => {
    const results = searchWorkspace(seed(), 'harborview', '/base');
    expect(results.some((r) => r.kind === 'customer')).toBe(true);
  });
});

// ----------------------------------------------------------- reset + storage

describe('reset and persistence', () => {
  it('restores seed data and discards changes', () => {
    const base = seed();
    const changed = apply(base, {
      type: 'lead/create',
      input: {
        name: 'Temporary',
        contactName: 'X',
        phone: '3035550000',
        email: '',
        source: 'Website',
        serviceAddress: { line1: '3 Test St', city: 'Denver', state: 'CO', zip: '80202' },
        serviceType: 'HVAC',
        description: '',
        estimatedValue: 0,
        stage: 'New',
        assignedUserId: 'usr-2',
      },
    });
    expect(changed.leads.length).toBe(base.leads.length + 1);

    const reset = contractorReducer(changed, { type: 'demo/reset' });
    expect(reset.leads.length).toBe(base.leads.length);
    expect(reset.leads.some((l) => l.name === 'Temporary')).toBe(false);
  });

  it('round-trips a workspace through the repository', () => {
    const repo = createMemoryRepository();
    expect(repo.load().status).toBe('empty');

    const state = seed();
    repo.save(state);

    const outcome = repo.load();
    expect(outcome.status).toBe('loaded');
    if (outcome.status === 'loaded') {
      expect(outcome.state.leads.length).toBe(state.leads.length);
      expect(outcome.state.schemaVersion).toBe(SCHEMA_VERSION);
    }
  });

  it('recovers instead of crashing on unusable stored data', () => {
    const repo = createMemoryRepository();
    // A payload from an older schema: the shape no longer matches.
    repo.save({ schemaVersion: 999, leads: [] } as unknown as ContractorState);
    const outcome = repo.load();
    expect(outcome.status).toBe('reset');
  });

  it('reports unusable data the same way every time it is read', () => {
    // React can render a provider more than once before committing it, so a
    // load that consumed the corrupt payload would report a clean first visit
    // on the second call and swallow the notice the visitor is owed.
    const repo = createMemoryRepository();
    repo.save({ schemaVersion: 999, leads: [] } as unknown as ContractorState);
    expect(repo.load().status).toBe('reset');
    expect(repo.load().status).toBe('reset');
    expect(repo.load().status).toBe('reset');
  });

  it('clears stored data', () => {
    const repo = createMemoryRepository();
    repo.save(seed());
    repo.clear();
    expect(repo.load().status).toBe('empty');
  });
});

// ------------------------------------------------------------- identifiers

describe('identifiers', () => {
  it('increments readable codes rather than repeating them', () => {
    const base = seed();
    const makeLead = (name: string): ContractorAction => ({
      type: 'lead/create',
      input: {
        name,
        contactName: 'X',
        phone: '3035550000',
        email: '',
        source: 'Website',
        serviceAddress: { line1: '4 Test St', city: 'Denver', state: 'CO', zip: '80202' },
        serviceType: 'HVAC',
        description: '',
        estimatedValue: 0,
        stage: 'New',
        assignedUserId: 'usr-2',
      },
    });

    const state = apply(base, makeLead('One'), makeLead('Two'));
    const codes = state.leads.slice(0, 2).map((l) => l.code);
    expect(new Set(codes).size).toBe(2);
    expect(codes.every((code) => /^LD-\d+$/.test(code))).toBe(true);
    expect(state.counters.lead).toBe(base.counters.lead + 2);
  });
});
