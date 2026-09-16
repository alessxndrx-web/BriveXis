import type { Page } from 'puppeteer-core';
import { afterAll, describe, expect, it } from 'vitest';
import { closeBrowser, withPage } from '../helpers/browser';
import { ALL_VIEWPORTS, VIEWPORTS } from '../helpers/viewport';
import {
  clickInApp,
  clickText,
  goto,
  hasText,
  pageText,
  pathname,
  wait,
} from '../helpers/navigation';
import { assertNoPageOverflow } from '../helpers/overflow';
import { assertAccessible, focusStaysInDialog } from '../helpers/accessibility';
import { setValue } from '../helpers/forms';
import { clearDemoStorage, corruptDemoStorage, readDemoStorage } from '../helpers/storage';
import {
  DIALOG,
  DISTRIBUTION,
  MAIN,
  assertDemoNotice,
  confirmDialog,
  openFirstSearchResult,
  openModule,
  openRecord,
  quickCreate,
  resetDemo,
  searchWorkspace,
  setDemoRole,
} from '../helpers/demoApp';
import { capture } from '../helpers/screenshots';

/**
 * Distribution Operations.
 *
 * The thing this product has to get right is that there is exactly one story
 * about physical stock. So the assertions here are mostly about the ledger: a
 * purchase order that is approved must not have moved anything, a receipt must
 * add exactly what was counted, an allocation must reduce what can be promised
 * without moving a unit, and a shipment must reduce the shelf exactly once.
 *
 * Each workflow reads the stored workspace directly as well as the screen,
 * because a screen can be made to say anything; the ledger cannot.
 */

const MODULES = [
  '',
  'products',
  'warehouses',
  'inventory',
  'transfers',
  'suppliers',
  'purchasing',
  'receiving',
  'customers',
  'orders',
  'fulfillment',
  'shipments',
  'returns',
  'invoices',
  'payments',
  'reports',
  'settings',
];

// ------------------------------------------------------------- workspace

interface Movement {
  productId: string;
  warehouseId: string;
  type: string;
  quantity: number;
}

interface Line {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
}

interface Doc {
  id: string;
  code: string;
  status: string;
  lines: Line[];
}

interface Workspace {
  schemaVersion: number;
  movements: Movement[];
  products: { id: string; sku: string; name: string; price: number }[];
  purchaseOrders: (Doc & { supplierId: string; warehouseId: string })[];
  receipts: { id: string; code: string; poId: string }[];
  orders: (Doc & { customerId: string; warehouseId: string })[];
  allocations: { orderId: string; lineId: string; quantity: number; picked: number; packed: number }[];
  shipments: { id: string; code: string; orderId: string; lines: { lineId: string; quantity: number }[] }[];
  invoices: { id: string; code: string; orderId: string; status: string }[];
  payments: { id: string; invoiceId: string; amount: number }[];
  transfers: { id: string; code: string; status: string; quantity: number }[];
  returns: { id: string; code: string; disposition: string; quantity: number }[];
  suppliers: { id: string; name: string }[];
  customers: { id: string; name: string }[];
}

async function workspace(page: Page): Promise<Workspace> {
  const stored = (await readDemoStorage(page, 'distribution')) as Workspace | null;
  expect(stored, 'the distribution workspace was not persisted').not.toBeNull();
  return stored as Workspace;
}

/** On-hand units, summed straight from the ledger the way the app does. */
function onHand(ws: Workspace, productId: string, warehouseId?: string): number {
  return ws.movements
    .filter((row) => row.productId === productId)
    .filter((row) => !warehouseId || row.warehouseId === warehouseId)
    .reduce((sum, row) => sum + row.quantity, 0);
}

/** Every unit in the business, across every product and warehouse. */
function globalUnits(ws: Workspace): number {
  return ws.movements.reduce((sum, row) => sum + row.quantity, 0);
}

function productBySku(ws: Workspace, sku: string) {
  const product = ws.products.find((entry) => entry.sku === sku);
  expect(product, `${sku} is not in the catalogue`).toBeTruthy();
  return product!;
}

/** Opens a fresh workspace seeded from scratch. */
async function freshWorkspace(page: Page): Promise<void> {
  await goto(page, DISTRIBUTION.base);
  await clearDemoStorage(page, 'distribution');
  await goto(page, DISTRIBUTION.base);
  await wait(500);
}

afterAll(async () => {
  await closeBrowser();
});

// ------------------------------------------------------------------ setup

describe('distribution operations — the workspace', () => {
  it('opens on the overview with its fictional-data notice and every module reachable', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await freshWorkspace(page);

      await assertDemoNotice(page, DISTRIBUTION);
      expect(await hasText(page, 'Overview')).toBe(true);
      expect(await hasText(page, 'Inventory value')).toBe(true);

      const ws = await workspace(page);
      expect(ws.schemaVersion).toBe(2);
      expect(ws.movements.length).toBeGreaterThan(0);

      for (const segment of MODULES) {
        await openModule(page, DISTRIBUTION, segment);
        const text = await pageText(page);
        expect(text, `${segment || 'overview'} rendered an error`).not.toContain(
          'That screen does not exist',
        );
        expect(text.length, `${segment || 'overview'} rendered nothing`).toBeGreaterThan(200);
        // Every module, not just the few screens the workflows happen to end
        // on: a skipped heading level or an unlabelled control is exactly the
        // kind of defect that arrives on a page nobody re-checks.
        await assertAccessible(page, `Distribution ${segment || 'overview'}`);
      }

      await openModule(page, DISTRIBUTION);
      await assertAccessible(page, 'Distribution overview');
      await capture(page, 'distribution-overview');
    });
  });

  it('keeps the marketing home page free of the demo bundle', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      const requested: string[] = [];
      page.on('request', (request) => requested.push(request.url()));

      await goto(page, '/');
      await wait(900);

      const demoChunks = requested.filter((entry) => /(Distribution|Dealer|Contractor)App/.test(entry));
      expect(demoChunks, 'a demo bundle was downloaded by the home page').toEqual([]);

      await clickInApp(page, DISTRIBUTION.base);
      await wait(900);
      expect(requested.some((entry) => /DistributionApp/.test(entry))).toBe(true);
      expect(await pathname(page)).toBe(DISTRIBUTION.base);
    });
  });
});

// -------------------------------------------------------- inbound lifecycle

describe('distribution operations — inbound', () => {
  it('runs product → supplier → purchase order → approval → short receipt → completion', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await freshWorkspace(page);

      const before = await workspace(page);
      const baselineMovements = before.movements.length;

      // --- a catalogue item ----------------------------------------------
      await quickCreate(page, 'Product');
      await setValue(page, '#product-sku', 'E2E-900');
      await setValue(page, '#product-name', 'Reinforced strapping band');
      await setValue(page, '#product-category', 'Packaging');
      await setValue(page, '#product-unit', 'case');
      await setValue(page, '#product-cost', '18.00');
      await setValue(page, '#product-price', '31.50');
      await setValue(page, '#product-reorder', '12');
      await confirmDialog(page, 'Create product');

      let ws = await workspace(page);
      const product = productBySku(ws, 'E2E-900');
      // A new catalogue item has no stock, and creating it moves nothing.
      expect(onHand(ws, product.id)).toBe(0);
      expect(ws.movements).toHaveLength(baselineMovements);

      // --- a supplier ------------------------------------------------------
      await openModule(page, DISTRIBUTION, 'suppliers');
      await clickText(page, 'New supplier', { exact: true, within: MAIN });
      await wait(400);
      await setValue(page, '#partner-name', 'Brazoria Strapping Works');
      await setValue(page, '#partner-contact', 'Dale Okonkwo');
      await setValue(page, '#partner-phone', '(713) 555-0142');
      await setValue(page, '#partner-email', 'orders@brazoria-strapping.example');
      await setValue(page, '#partner-address-line1', '2200 Example Mill Road');
      await setValue(page, '#partner-address-city', 'Houston');
      await setValue(page, '#partner-address-state', 'TX');
      await setValue(page, '#partner-address-zip', '77002');
      await confirmDialog(page, 'Create supplier');
      expect(await hasText(page, 'Brazoria Strapping Works')).toBe(true);

      ws = await workspace(page);
      const supplier = ws.suppliers.find((entry) => entry.name === 'Brazoria Strapping Works');
      expect(supplier, 'the supplier was not saved').toBeTruthy();

      // --- a purchase order for 40 cases ----------------------------------
      await openModule(page, DISTRIBUTION, 'purchasing');
      await clickText(page, 'New purchase order', { exact: true, within: MAIN });
      await wait(450);
      await setValue(page, '#po-supplier', supplier!.id);
      await setValue(page, '#po-warehouse', 'dallas');
      await setValue(page, '#line-product-0', product.id);
      await setValue(page, '#line-quantity-0', '40');
      await confirmDialog(page, 'Create purchase order');

      ws = await workspace(page);
      const po = ws.purchaseOrders.at(-1)!;
      expect(po.status).toBe('Draft');
      expect(po.lines[0].quantity).toBe(40);
      expect(ws.movements, 'a draft purchase order changed inventory').toHaveLength(
        baselineMovements,
      );

      await openRecord(page, DISTRIBUTION, 'purchasing', po.id);
      expect(await hasText(page, po.code)).toBe(true);

      // --- submit and approve: paperwork only ------------------------------
      await clickText(page, 'Submit PO', { exact: true, within: MAIN });
      await wait(500);
      ws = await workspace(page);
      expect(ws.purchaseOrders.at(-1)!.status).toBe('Submitted');
      expect(ws.movements, 'submitting moved stock').toHaveLength(baselineMovements);

      await clickText(page, 'Approve PO', { exact: true, within: MAIN });
      await wait(500);
      ws = await workspace(page);
      expect(ws.purchaseOrders.at(-1)!.status).toBe('Approved');
      expect(ws.movements, 'approving moved stock').toHaveLength(baselineMovements);
      expect(onHand(ws, product.id, 'dallas')).toBe(0);

      // --- receive 25 of 40: stock rises by what actually arrived ----------
      await openModule(page, DISTRIBUTION, 'receiving');
      expect(await hasText(page, po.code)).toBe(true);
      // The queue holds several orders, so the row is picked by the accessible
      // name rather than by whichever button happens to come first.
      await clickText(page, 'Receive goods', {
        exact: true,
        within: MAIN,
        selector: `button[aria-label="Receive goods for ${po.code}"]`,
      });
      await wait(500);
      await setValue(page, `#receipt-qty-${po.lines[0].id}`, '25');
      await setValue(page, '#receipt-reference', 'PACKING-9001');
      await confirmDialog(page, 'Post receipt');

      ws = await workspace(page);
      expect(onHand(ws, product.id, 'dallas'), 'receipt did not post the counted quantity').toBe(25);
      expect(ws.movements).toHaveLength(baselineMovements + 1);
      expect(ws.receipts.filter((entry) => entry.poId === po.id)).toHaveLength(1);

      await openRecord(page, DISTRIBUTION, 'purchasing', po.id);
      expect(await hasText(page, 'Partially Received')).toBe(true);

      // --- receive the remaining 15 ---------------------------------------
      await clickText(page, 'Receive goods', { exact: true, within: MAIN });
      await wait(500);
      await confirmDialog(page, 'Post receipt');

      ws = await workspace(page);
      expect(onHand(ws, product.id, 'dallas')).toBe(40);
      expect(ws.movements).toHaveLength(baselineMovements + 2);
      expect(await hasText(page, 'Received')).toBe(true);

      // Nothing is outstanding, so the workspace stops offering to receive.
      expect(await hasText(page, 'Receive goods')).toBe(false);

      await capture(page, 'distribution-purchase-order');
      await assertAccessible(page, 'Distribution purchase order');
      await assertNoPageOverflow(page, 'Distribution purchase order');

      // --- the printable purchase order -----------------------------------
      await goto(page, `${DISTRIBUTION.base}/purchasing/${po.id}/print`);
      await wait(600);
      const printed = await pageText(page);
      // The document heading is styled uppercase, which `innerText` reports.
      expect(printed.toLowerCase()).toContain('purchase order');
      expect(printed).toContain(DISTRIBUTION.company);
      expect(printed).toContain('E2E-900');
      expect(printed.toLowerCase()).toContain('fictional');
      await capture(page, 'distribution-purchase-order-print');
    });
  });

  it('refuses to receive more than was ordered, and keeps receipts after a cancellation', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await freshWorkspace(page);

      // The seed leaves one purchase order part-received, which is exactly the
      // situation worth protecting.
      let ws = await workspace(page);
      const po = ws.purchaseOrders.find((entry) =>
        ws.receipts.some((receipt) => receipt.poId === entry.id),
      );
      expect(po, 'the seed has no partially received purchase order').toBeTruthy();

      const unitsBefore = globalUnits(ws);

      await openRecord(page, DISTRIBUTION, 'purchasing', po!.id);
      await clickText(page, 'Receive goods', { exact: true, within: MAIN });
      await wait(500);

      // Ask for far more than is outstanding.
      await setValue(page, `#receipt-qty-${po!.lines[0].id}`, '9999');
      await clickText(page, 'Post receipt', { exact: true, within: DIALOG });
      await wait(600);

      const refusal = await pageText(page);
      expect(refusal.toLowerCase()).toMatch(/exceed|outstanding|more than/);

      ws = await workspace(page);
      expect(globalUnits(ws), 'a rejected receipt still changed stock').toBe(unitsBefore);

      // Close the dialog and cancel the order instead.
      await page.keyboard.press('Escape');
      await wait(400);
      await clickText(page, 'Cancel', { exact: true, within: MAIN });
      await wait(600);

      ws = await workspace(page);
      expect(globalUnits(ws), 'cancelling erased received stock').toBe(unitsBefore);
      expect(ws.receipts.some((receipt) => receipt.poId === po!.id)).toBe(true);
      expect(await hasText(page, 'cancelled after goods had already been received')).toBe(true);
    });
  });
});

// ------------------------------------------------------- outbound lifecycle

describe('distribution operations — outbound', () => {
  it('runs customer → order → allocate → pick → pack → partial ship → ship → invoice → paid', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await freshWorkspace(page);

      let ws = await workspace(page);
      const gloves = productBySku(ws, 'SAF-100');
      const stockBefore = onHand(ws, gloves.id, 'dallas');
      expect(stockBefore, 'the seed has no Dallas stock to sell').toBeGreaterThan(12);
      const movementsBefore = ws.movements.length;

      // --- a customer ------------------------------------------------------
      await quickCreate(page, 'Customer');
      await setValue(page, '#partner-name', 'Lakeshore Facility Services');
      await setValue(page, '#partner-contact', 'Priya Raghunathan');
      await setValue(page, '#partner-phone', '(214) 555-0188');
      await setValue(page, '#partner-email', 'ap@lakeshore-facility.example');
      await setValue(page, '#partner-address-line1', '710 Example Service Drive');
      await setValue(page, '#partner-address-city', 'Dallas');
      await setValue(page, '#partner-address-state', 'TX');
      await setValue(page, '#partner-address-zip', '75204');
      await confirmDialog(page, 'Create customer');

      ws = await workspace(page);
      const customer = ws.customers.find((entry) => entry.name === 'Lakeshore Facility Services');
      expect(customer, 'the customer was not saved').toBeTruthy();

      // --- a sales order for 10 cases --------------------------------------
      await openModule(page, DISTRIBUTION, 'orders');
      await clickText(page, 'New sales order', { exact: true, within: MAIN });
      await wait(500);
      await setValue(page, '#so-customer', customer!.id);
      await setValue(page, '#so-warehouse', 'dallas');
      await setValue(page, '#line-product-0', gloves.id);
      await setValue(page, '#line-quantity-0', '10');
      await confirmDialog(page, 'Create sales order');

      ws = await workspace(page);
      const order = ws.orders.at(-1)!;
      expect(order.status).toBe('Draft');
      expect(ws.movements, 'a draft order moved stock').toHaveLength(movementsBefore);

      await openRecord(page, DISTRIBUTION, 'orders', order.id);
      await clickText(page, 'Confirm order', { exact: true, within: MAIN });
      await wait(600);

      ws = await workspace(page);
      expect(ws.orders.at(-1)!.status).toBe('Confirmed');
      expect(ws.movements, 'confirming an order moved stock').toHaveLength(movementsBefore);

      // --- allocate: reserves without moving --------------------------------
      await openModule(page, DISTRIBUTION, 'fulfillment');
      expect(await hasText(page, order.code)).toBe(true);
      // One card per open order, so every action is addressed by its order.
      await clickText(page, 'Allocate stock', {
        exact: true,
        within: MAIN,
        selector: `button[aria-label="Allocate stock for ${order.code}"]`,
      });
      await wait(600);

      ws = await workspace(page);
      const allocation = ws.allocations.find((row) => row.orderId === order.id);
      expect(allocation?.quantity).toBe(10);
      expect(onHand(ws, gloves.id, 'dallas'), 'allocation changed physical stock').toBe(stockBefore);
      expect(ws.movements).toHaveLength(movementsBefore);

      await clickText(page, 'Mark picked', {
        exact: true,
        within: MAIN,
        selector: `button[aria-label="Mark ${order.code} picked"]`,
      });
      await wait(500);
      await clickText(page, 'Mark packed', {
        exact: true,
        within: MAIN,
        selector: `button[aria-label="Mark ${order.code} packed"]`,
      });
      await wait(500);

      ws = await workspace(page);
      const packed = ws.allocations.find((row) => row.orderId === order.id)!;
      expect(packed.picked).toBe(10);
      expect(packed.packed).toBe(10);
      expect(ws.movements, 'picking or packing moved stock').toHaveLength(movementsBefore);

      await capture(page, 'distribution-fulfillment');

      // --- ship 6 of 10 -----------------------------------------------------
      await clickText(page, 'Post shipment', {
        exact: true,
        within: MAIN,
        selector: `button[aria-label="Post shipment for ${order.code}"]`,
      });
      await wait(600);
      await setValue(page, `#shipment-qty-${order.lines[0].id}`, '6');
      await setValue(page, '#shipment-carrier', 'Lone Star Freight');
      await setValue(page, '#shipment-tracking', 'DEMO-4471120');
      await confirmDialog(page, 'Post shipment');

      ws = await workspace(page);
      expect(onHand(ws, gloves.id, 'dallas'), 'shipment did not reduce stock exactly once').toBe(
        stockBefore - 6,
      );
      expect(ws.movements).toHaveLength(movementsBefore + 1);
      const remaining = ws.allocations.find((row) => row.orderId === order.id)!;
      expect(remaining.quantity).toBe(4);
      expect(remaining.packed).toBe(4);

      await openRecord(page, DISTRIBUTION, 'orders', order.id);
      expect(await hasText(page, 'Partially Shipped')).toBe(true);

      // --- ship the rest ----------------------------------------------------
      await clickText(page, 'Post shipment', { exact: true, within: MAIN });
      await wait(600);
      await confirmDialog(page, 'Post shipment');

      ws = await workspace(page);
      expect(onHand(ws, gloves.id, 'dallas')).toBe(stockBefore - 10);
      expect(ws.movements).toHaveLength(movementsBefore + 2);
      expect(ws.allocations.some((row) => row.orderId === order.id)).toBe(false);
      expect(await hasText(page, 'Shipped')).toBe(true);

      // --- invoice the shipped units ----------------------------------------
      await clickText(page, 'Create invoice', { exact: true, within: MAIN });
      await wait(600);
      await confirmDialog(page, 'Create invoice');

      ws = await workspace(page);
      const invoice = ws.invoices.find((entry) => entry.orderId === order.id);
      expect(invoice, 'no invoice was created').toBeTruthy();
      expect(invoice!.status).toBe('Draft');

      await openRecord(page, DISTRIBUTION, 'invoices', invoice!.id);
      expect(await hasText(page, 'Demo only — no real transaction is processed.')).toBe(true);

      // A draft invoice cannot take money.
      expect(await hasText(page, 'Record payment')).toBe(false);

      await clickText(page, 'Mark as sent', { exact: true, within: MAIN });
      await wait(600);

      // --- a partial payment, then the balance -------------------------------
      await clickText(page, 'Record payment', { exact: true, within: MAIN });
      await wait(500);
      await setValue(page, '#payment-amount', '100.00');
      await setValue(page, '#payment-method', 'ACH');
      await setValue(page, '#payment-reference', 'DEMO-ACH-5512');
      await confirmDialog(page, 'Record payment');

      ws = await workspace(page);
      expect(ws.payments.filter((entry) => entry.invoiceId === invoice!.id)).toHaveLength(1);
      expect(await hasText(page, 'Partial')).toBe(true);

      await clickText(page, 'Record payment', { exact: true, within: MAIN });
      await wait(500);
      await confirmDialog(page, 'Record payment');

      ws = await workspace(page);
      const paid = ws.payments
        .filter((entry) => entry.invoiceId === invoice!.id)
        .reduce((sum, entry) => sum + entry.amount, 0);
      expect(paid).toBeGreaterThan(0);
      expect(await hasText(page, 'Paid')).toBe(true);

      // Money never moves goods.
      expect(ws.movements).toHaveLength(movementsBefore + 2);

      await capture(page, 'distribution-invoice');
      await assertAccessible(page, 'Distribution invoice');

      // --- the printable invoice and packing slip ----------------------------
      await goto(page, `${DISTRIBUTION.base}/invoices/${invoice!.id}/print`);
      await wait(600);
      let printed = await pageText(page);
      expect(printed).toContain('Invoice');
      expect(printed).toContain('Lakeshore Facility Services');
      expect(printed).toContain('no real transaction is processed');
      await capture(page, 'distribution-invoice-print');

      const shipment = ws.shipments.find((entry) => entry.orderId === order.id)!;
      await goto(page, `${DISTRIBUTION.base}/shipments/${shipment.id}/print`);
      await wait(600);
      printed = await pageText(page);
      expect(printed.toLowerCase()).toContain('packing slip');
      expect(printed).toContain('SAF-100');
      // A packing slip carries no prices at all, not merely no price column.
      expect(printed.toLowerCase()).not.toContain('unit price');
      expect(printed, 'a packing slip showed money').not.toMatch(/\$\s?\d/);
      await capture(page, 'distribution-packing-slip-print');
    });
  });

  it('backorders what it cannot allocate and allocates the rest once stock arrives', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await freshWorkspace(page);

      let ws = await workspace(page);
      // Houston holds nothing for this product in the seed, which makes it the
      // honest place to prove a backorder.
      const anchors = productBySku(ws, 'FAS-425');
      expect(onHand(ws, anchors.id, 'houston')).toBe(0);

      await openModule(page, DISTRIBUTION, 'orders');
      await clickText(page, 'New sales order', { exact: true, within: MAIN });
      await wait(500);
      await setValue(page, '#so-warehouse', 'houston');
      await setValue(page, '#line-product-0', anchors.id);
      await setValue(page, '#line-quantity-0', '5');
      expect(await hasText(page, 'short')).toBe(true);
      await confirmDialog(page, 'Create sales order');

      ws = await workspace(page);
      const order = ws.orders.at(-1)!;
      await openRecord(page, DISTRIBUTION, 'orders', order.id);
      await clickText(page, 'Confirm order', { exact: true, within: MAIN });
      await wait(600);

      expect(await hasText(page, 'backorder')).toBe(true);

      // Nothing can be allocated yet.
      await openModule(page, DISTRIBUTION, 'fulfillment');
      await clickText(page, 'Allocate stock', {
        exact: true,
        within: MAIN,
        selector: `button[aria-label="Allocate stock for ${order.code}"]`,
      });
      await wait(600);
      ws = await workspace(page);
      expect(ws.allocations.some((row) => row.orderId === order.id)).toBe(false);

      // Bring stock into Houston with an adjustment, then allocate.
      await quickCreate(page, 'Inventory Adjustment');
      await setValue(page, '#adjust-product', anchors.id);
      await setValue(page, '#adjust-warehouse', 'houston');
      // The control is a signed multiplier: 1 increases, -1 decreases.
      await setValue(page, '#adjust-direction', '1');
      await setValue(page, '#adjust-quantity', '5');
      await setValue(page, '#adjust-reason', 'Found on the dock during a cycle count');
      await confirmDialog(page, 'Post adjustment');

      ws = await workspace(page);
      expect(onHand(ws, anchors.id, 'houston')).toBe(5);

      await openModule(page, DISTRIBUTION, 'fulfillment');
      await clickText(page, 'Allocate stock', {
        exact: true,
        within: MAIN,
        selector: `button[aria-label="Allocate stock for ${order.code}"]`,
      });
      await wait(700);

      ws = await workspace(page);
      const allocation = ws.allocations.find((row) => row.orderId === order.id);
      expect(allocation?.quantity, 'the backorder did not allocate once stock arrived').toBe(5);
      // Reserving still has not moved a unit.
      expect(onHand(ws, anchors.id, 'houston')).toBe(5);
    });
  });
});

// ------------------------------------------------------ transfers, returns

describe('distribution operations — transfers and returns', () => {
  it('conserves total inventory across a transfer, counting nothing twice in transit', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await freshWorkspace(page);

      let ws = await workspace(page);
      const gloves = productBySku(ws, 'SAF-100');
      const unitsBefore = globalUnits(ws);
      const dallasBefore = onHand(ws, gloves.id, 'dallas');
      const austinBefore = onHand(ws, gloves.id, 'austin');

      await openModule(page, DISTRIBUTION, 'transfers');
      await clickText(page, 'New transfer', { exact: true, within: MAIN });
      await wait(500);
      await setValue(page, '#transfer-product', gloves.id);
      await setValue(page, '#transfer-from', 'dallas');
      await setValue(page, '#transfer-to', 'austin');
      await setValue(page, '#transfer-quantity', '12');
      await setValue(page, '#transfer-note', 'Rebalancing ahead of a promotion');
      await confirmDialog(page, 'Create transfer');

      ws = await workspace(page);
      const transfer = ws.transfers.at(-1)!;
      expect(transfer.status).toBe('Draft');
      // A draft moves nothing at all.
      expect(globalUnits(ws)).toBe(unitsBefore);
      expect(onHand(ws, gloves.id, 'dallas')).toBe(dallasBefore);

      await clickText(page, 'Ship', { exact: true, within: MAIN });
      await wait(700);

      ws = await workspace(page);
      expect(ws.transfers.at(-1)!.status).toBe('In Transit');
      expect(onHand(ws, gloves.id, 'dallas')).toBe(dallasBefore - 12);
      // In transit: gone from the source, not yet at the destination, and the
      // global figure is down by exactly the units on the truck.
      expect(onHand(ws, gloves.id, 'austin')).toBe(austinBefore);
      expect(globalUnits(ws)).toBe(unitsBefore - 12);

      await clickText(page, 'Receive', { exact: true, within: MAIN });
      await wait(700);

      ws = await workspace(page);
      expect(ws.transfers.at(-1)!.status).toBe('Received');
      expect(onHand(ws, gloves.id, 'dallas')).toBe(dallasBefore - 12);
      expect(onHand(ws, gloves.id, 'austin')).toBe(austinBefore + 12);
      expect(globalUnits(ws), 'the transfer changed total inventory').toBe(unitsBefore);

      await capture(page, 'distribution-transfers');
    });
  });

  it('restocks a sellable return once, and records a damaged return without restocking it', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await freshWorkspace(page);

      let ws = await workspace(page);
      const shipment = ws.shipments[0];
      expect(shipment, 'the seed has no shipment to return against').toBeTruthy();

      const order = ws.orders.find((entry) => entry.id === shipment.orderId)!;
      const line = order.lines.find((entry) => entry.id === shipment.lines[0].lineId)!;
      const before = onHand(ws, line.productId);
      const shipmentCount = ws.shipments.length;

      await openRecord(page, DISTRIBUTION, 'shipments', shipment.id);
      await clickText(page, 'Record return', { exact: true, within: MAIN });
      await wait(600);
      await setValue(page, '#return-reason', 'Over-ordered on the last release');
      await setValue(page, `#return-qty-${line.id}`, '1');
      await setValue(page, `#return-disposition-${line.id}`, 'Return to Stock');
      await confirmDialog(page, 'Post return');

      ws = await workspace(page);
      expect(onHand(ws, line.productId), 'a sellable return did not come back into stock').toBe(
        before + 1,
      );
      expect(ws.returns).toHaveLength(1);
      // The shipment stays posted — a return is its own event, not an undo.
      expect(ws.shipments).toHaveLength(shipmentCount);

      // --- a damaged return ------------------------------------------------
      await clickText(page, 'Record return', { exact: true, within: MAIN });
      await wait(600);
      await setValue(page, '#return-reason', 'Crushed in transit');
      await setValue(page, `#return-qty-${line.id}`, '1');
      await setValue(page, `#return-disposition-${line.id}`, 'Damaged');
      await confirmDialog(page, 'Post return');

      ws = await workspace(page);
      expect(ws.returns).toHaveLength(2);
      expect(ws.returns.some((entry) => entry.disposition === 'Damaged')).toBe(true);
      expect(onHand(ws, line.productId), 'a damaged return was made sellable again').toBe(
        before + 1,
      );

      await openModule(page, DISTRIBUTION, 'returns');
      expect(await hasText(page, 'Damaged — not restocked')).toBe(true);
      await capture(page, 'distribution-returns');
    });
  });
});

// ------------------------------------------------------------- edge cases

describe('distribution operations — refusals', () => {
  it('refuses zero, negative and excessive payments, and refuses to void a paid invoice', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await freshWorkspace(page);

      const ws = await workspace(page);
      const invoice = ws.invoices.find((entry) => entry.status === 'Sent');
      expect(invoice, 'the seed has no sent invoice').toBeTruthy();

      await openRecord(page, DISTRIBUTION, 'invoices', invoice!.id);
      expect(await hasText(page, 'no real transaction is processed')).toBe(true);

      const paymentsBefore = (await workspace(page)).payments.length;

      for (const amount of ['0', '-25.00', '9999999.00']) {
        await clickText(page, 'Record payment', { exact: true, within: MAIN });
        await wait(500);
        await setValue(page, '#payment-amount', amount);
        await clickText(page, 'Record payment', { exact: true, within: DIALOG });
        await wait(600);

        const after = await workspace(page);
        expect(after.payments.length, `${amount} was accepted as a payment`).toBe(paymentsBefore);

        await page.keyboard.press('Escape');
        await wait(350);
      }

      // Paying an invoice in full must then block voiding it.
      await clickText(page, 'Record payment', { exact: true, within: MAIN });
      await wait(500);
      await confirmDialog(page, 'Record payment');
      await wait(400);
      expect(await hasText(page, 'Paid')).toBe(true);
      expect(await hasText(page, 'Void')).toBe(false);
    });
  });

  it('never asks for card numbers or bank credentials', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await freshWorkspace(page);

      const ws = await workspace(page);
      const invoice = ws.invoices.find((entry) => entry.status === 'Sent')!;
      await openRecord(page, DISTRIBUTION, 'invoices', invoice.id);
      await clickText(page, 'Record payment', { exact: true, within: MAIN });
      await wait(600);

      const fields = await page.$$eval(`${DIALOG} input, ${DIALOG} label`, (nodes) =>
        nodes
          .map((node) => `${(node as HTMLElement).getAttribute('name') ?? ''} ${(node as HTMLElement).innerText ?? ''} ${(node as HTMLInputElement).placeholder ?? ''}`)
          .join(' ')
          .toLowerCase(),
      );

      for (const forbidden of ['card number', 'cvv', 'routing', 'account number', 'iban', 'sort code']) {
        expect(fields, `the payment dialog asked for a ${forbidden}`).not.toContain(forbidden);
      }

      const dialogText = (await pageText(page)).toLowerCase();
      expect(dialogText).toContain('demo only');
    });
  });

  it('keeps a dialog focused and closes it on Escape without saving', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await freshWorkspace(page);
      const before = (await workspace(page)).products.length;

      await quickCreate(page, 'Product');
      expect(await focusStaysInDialog(page)).toBe(true);

      await setValue(page, '#product-sku', 'E2E-ABANDON');
      await page.keyboard.press('Escape');
      await wait(500);

      expect(await hasText(page, 'E2E-ABANDON')).toBe(false);
      expect((await workspace(page)).products).toHaveLength(before);
    });
  });

  it('rejects a duplicate SKU and an adjustment that would go negative', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await freshWorkspace(page);
      const ws = await workspace(page);
      const before = ws.products.length;

      await quickCreate(page, 'Product');
      await setValue(page, '#product-sku', 'SAF-100');
      await setValue(page, '#product-name', 'Duplicate SKU attempt');
      await clickText(page, 'Create product', { exact: true, within: DIALOG });
      await wait(600);

      expect((await pageText(page)).toLowerCase()).toContain('sku is already in use');
      expect((await workspace(page)).products).toHaveLength(before);

      await page.keyboard.press('Escape');
      await wait(400);

      const gloves = productBySku(ws, 'SAF-100');
      await quickCreate(page, 'Inventory Adjustment');
      await setValue(page, '#adjust-product', gloves.id);
      await setValue(page, '#adjust-warehouse', 'dallas');
      await setValue(page, '#adjust-direction', '-1');
      await setValue(page, '#adjust-quantity', '99999');
      await setValue(page, '#adjust-reason', 'Impossible write-off');
      await clickText(page, 'Post adjustment', { exact: true, within: DIALOG });
      await wait(600);

      expect((await pageText(page)).toLowerCase()).toMatch(/negative|allocated/);
      expect(globalUnits(await workspace(page))).toBe(globalUnits(ws));
    });
  });

  it('shows a friendly screen for a link that does not resolve', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await goto(page, `${DISTRIBUTION.base}/not-a-module`);
      await wait(500);
      expect(await hasText(page, 'That screen does not exist')).toBe(true);

      await goto(page, `${DISTRIBUTION.base}/orders/no-such-order`);
      await wait(500);
      expect(await hasText(page, 'not in this workspace')).toBe(true);
    });
  });
});

// ----------------------------------------------- roles, search, persistence

describe('distribution operations — workspace behaviour', () => {
  it('scopes navigation to the demo role without hiding the data from anyone', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await freshWorkspace(page);

      await setDemoRole(page, 'sales');
      let nav = await pageText(page);
      expect(nav).toContain('Sales Orders');
      expect(nav).not.toContain('Receiving');

      // In-app navigation, because the demo role is session state that a full
      // reload deliberately discards.
      await clickInApp(page, `${DISTRIBUTION.base}/receiving`);
      await wait(500);
      // Reached by link, a module outside the role says so rather than 404ing.
      expect(await hasText(page, 'Not available for this demo role')).toBe(true);

      await setDemoRole(page, 'warehouse');
      nav = await pageText(page);
      expect(nav).toContain('Receiving');
      expect(nav).toContain('Transfers');
      expect(nav).not.toContain('Invoices');

      await setDemoRole(page, 'owner');
      expect(await pageText(page)).toContain('Invoices');
    });
  });

  it('finds a SKU and a document number through workspace search', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await freshWorkspace(page);

      expect(await searchWorkspace(page, 'SAF-100')).toBe(true);
      await openFirstSearchResult(page);
      expect(await pathname(page)).toContain('/products/');
      expect(await hasText(page, 'SAF-100')).toBe(true);

      await openModule(page, DISTRIBUTION);
      const ws = await workspace(page);
      expect(await searchWorkspace(page, ws.orders[0].code)).toBe(true);
    });
  });

  it('keeps a change across a reload of a deep link', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await freshWorkspace(page);

      await quickCreate(page, 'Product');
      await setValue(page, '#product-sku', 'E2E-PERSIST');
      await setValue(page, '#product-name', 'Persistence check case');
      await setValue(page, '#product-cost', '10.00');
      await setValue(page, '#product-price', '20.00');
      await confirmDialog(page, 'Create product');

      const ws = await workspace(page);
      const product = productBySku(ws, 'E2E-PERSIST');

      await goto(page, `${DISTRIBUTION.base}/products/${product.id}`);
      await page.reload({ waitUntil: 'networkidle0' });
      await wait(700);

      expect(await hasText(page, 'Persistence check case')).toBe(true);
      await assertAccessible(page, 'Distribution product detail');
      await assertNoPageOverflow(page, 'Distribution product detail');
    });
  });

  it('recovers from unreadable stored data and says so', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await goto(page, DISTRIBUTION.base);
      await corruptDemoStorage(page, 'distribution');
      await page.reload({ waitUntil: 'networkidle0' });
      await wait(900);

      const text = await pageText(page);
      expect(text).toContain('Overview');
      expect(text.toLowerCase()).toMatch(/could not be read|restored to its starting data/);

      const ws = await workspace(page);
      expect(ws.schemaVersion).toBe(2);
      expect(ws.products.length).toBeGreaterThan(0);
    });
  });

  it('asks before resetting, then restores the starting workspace', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await freshWorkspace(page);
      const seeded = await workspace(page);

      await quickCreate(page, 'Customer');
      await setValue(page, '#partner-name', 'Discardable Customer Co.');
      await setValue(page, '#partner-address-line1', '1 Example Way');
      await setValue(page, '#partner-address-city', 'Dallas');
      await setValue(page, '#partner-address-state', 'TX');
      await setValue(page, '#partner-address-zip', '75201');
      await confirmDialog(page, 'Create customer');
      expect((await workspace(page)).customers.length).toBe(seeded.customers.length + 1);

      await resetDemo(page);

      expect(await pathname(page)).toBe(DISTRIBUTION.base);
      expect(await hasText(page, 'Overview')).toBe(true);
      expect(await hasText(page, 'Discardable Customer Co.')).toBe(false);

      const after = await workspace(page);
      expect(after.customers).toHaveLength(seeded.customers.length);
      expect(after.movements).toHaveLength(seeded.movements.length);
    });
  });

  it('reports operations without claiming to be an accounting system', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await freshWorkspace(page);
      await openModule(page, DISTRIBUTION, 'reports');

      const text = await pageText(page);
      // The reports page styles its metric labels uppercase, and `innerText`
      // reflects that, so this one is matched case-insensitively.
      expect(await hasText(page, 'Inventory value', { ignoreCase: true })).toBe(true);
      expect(text).toContain('does not produce a profit and loss statement');

      for (const forbidden of ['Balance Sheet', 'General Ledger', 'Trial Balance']) {
        expect(text, `the reports page offered a ${forbidden}`).not.toContain(forbidden);
      }

      await clickText(page, 'Receivables', { exact: true, within: MAIN });
      await wait(600);
      expect(await hasText(page, 'Open invoice balances by age', { ignoreCase: true })).toBe(
        true,
      );

      await assertAccessible(page, 'Distribution reports');
      await capture(page, 'distribution-reports');
    });
  });
});

// --------------------------------------------------------------- responsive

describe('distribution operations — layout', () => {
  it('has no horizontal overflow on any supported width', async () => {
    for (const viewport of ALL_VIEWPORTS) {
      await withPage({ viewport }, async ({ page }) => {
        await freshWorkspace(page);

        for (const segment of ['', 'inventory', 'purchasing', 'orders', 'fulfillment', 'reports']) {
          await openModule(page, DISTRIBUTION, segment);
          await assertNoPageOverflow(page, `Distribution ${segment || 'overview'} at ${viewport.name}`);
        }

        await capture(page, `distribution-${viewport.name}`);
      });
    }
  });

  it('works through the mobile navigation drawer on a phone', async () => {
    await withPage({ viewport: VIEWPORTS.mobile }, async ({ page }) => {
      await freshWorkspace(page);

      await page.click('[aria-label="Open navigation"]');
      await wait(500);
      expect(await hasText(page, 'Sales Orders')).toBe(true);

      await clickText(page, 'Receiving', { exact: true, within: '#workspace-nav' });
      await wait(700);
      expect(await pathname(page)).toContain('/receiving');
      // Navigating dismisses the drawer rather than leaving it over the screen.
      const drawerOpen = await page.evaluate(() => !!document.querySelector('#workspace-nav'));
      expect(drawerOpen).toBe(false);

      await assertNoPageOverflow(page, 'Distribution receiving on mobile');
      await capture(page, 'distribution-mobile-receiving');
    });
  });
});
