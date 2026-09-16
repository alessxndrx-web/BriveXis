import type {
  Allocation,
  DistributionState,
  Invoice,
  Movement,
  Partner,
  Payment,
  Product,
  PurchaseOrder,
  Receipt,
  SalesOrder,
  Shipment,
  Warehouse,
} from './distribution.types';
import { SCHEMA_VERSION } from './distribution.storage';
import { dayOffset, startOfDay, timeOffset } from '../shared/format';

/**
 * Seed workspace for Meridian Supply Co. — a fictional wholesale distributor.
 *
 * Every date is an offset from a supplied "today", so the workspace is never
 * stale and never depends on when this file was written. The offsets are fixed
 * rather than random: a demo that reshuffles itself on each visit cannot be
 * screenshotted, tested or talked through.
 *
 * Opening stock is posted as OPENING_BALANCE movements rather than written to a
 * quantity field, because the ledger is the only source of physical stock in
 * this system — including at the very beginning.
 *
 * Nothing here describes a real business, supplier, customer or transaction.
 */

export function seedToday(): Date {
  return startOfDay(new Date());
}

const WAREHOUSES: Warehouse[] = [
  {
    id: 'dallas',
    name: 'Dallas Distribution Center',
    short: 'DAL',
    address: { line1: '4180 Example Supply Way', city: 'Dallas', state: 'TX', zip: '75201' },
  },
  {
    id: 'austin',
    name: 'Austin Warehouse',
    short: 'AUS',
    address: { line1: '915 Example Trade Lane', city: 'Austin', state: 'TX', zip: '78701' },
  },
  {
    id: 'houston',
    name: 'Houston Cross-Dock',
    short: 'HOU',
    address: { line1: '220 Example Freight Road', city: 'Houston', state: 'TX', zip: '77001' },
  },
];

/** [id, code, name, contact, phone, email, street, city, state, zip, terms, leadDays] */
type PartnerSpec = [string, string, string, string, string, string, string, string, string, string, string, number];

const SUPPLIER_SPECS: PartnerSpec[] = [
  ['supplier-1', 'SUP-1001', 'Northstar Industrial Supply', 'Jamie Reed', '(214) 555-0101', 'orders@northstar.example', '10 Example Supplier Ave', 'Dallas', 'TX', '75207', 'Net 30', 5],
  ['supplier-2', 'SUP-1002', 'Cedar Packaging Works', 'Morgan Lane', '(512) 555-0102', 'sales@cedarpackaging.example', '2200 Example Mill Road', 'Austin', 'TX', '78744', 'Net 15', 3],
  ['supplier-3', 'SUP-1003', 'Gulf Coast Fasteners', 'Priya Raman', '(713) 555-0104', 'purchasing@gulffasteners.example', '840 Example Industrial Pkwy', 'Houston', 'TX', '77029', 'Net 30', 7],
  ['supplier-4', 'SUP-1004', 'Brazos Janitorial Wholesale', 'Devon Ellis', '(254) 555-0119', 'orders@brazosjanitorial.example', '77 Example Commerce St', 'Waco', 'TX', '76701', 'Net 45', 10],
  ['supplier-5', 'SUP-1005', 'Panhandle Electrical Supply', 'Alicia Romero', '(806) 555-0133', 'sales@panhandleelectric.example', '1450 Example Grid Way', 'Amarillo', 'TX', '79101', 'Net 30', 8],
];

const CUSTOMER_SPECS: PartnerSpec[] = [
  ['customer-1', 'CUS-1001', 'Lone Star Facilities Group', 'Taylor Brooks', '(214) 555-0120', 'purchasing@lonestarfacilities.example', '40 Example Office Lane', 'Dallas', 'TX', '75204', 'Net 30', 0],
  ['customer-2', 'CUS-1002', 'Hill Country Equipment', 'Casey Ellis', '(512) 555-0130', 'office@hillcountryequip.example', '60 Example Commerce Dr', 'Austin', 'TX', '78745', 'Net 15', 0],
  ['customer-3', 'CUS-1003', 'Bayou City Maintenance', 'Rashida Kone', '(713) 555-0141', 'ap@bayoucitymaint.example', '9100 Example Port Blvd', 'Houston', 'TX', '77015', 'Net 30', 0],
  ['customer-4', 'CUS-1004', 'Alamo Property Services', 'Idris Bello', '(210) 555-0155', 'orders@alamoproperty.example', '515 Example Mission Way', 'San Antonio', 'TX', '78205', 'Net 30', 0],
  ['customer-5', 'CUS-1005', 'Permian Field Services', 'Sylvie Marchand', '(432) 555-0167', 'purchasing@permianfield.example', '3300 Example Rig Road', 'Midland', 'TX', '79701', 'Net 45', 0],
  ['customer-6', 'CUS-1006', 'Trinity Schools District Supply', 'Grady Sutton', '(817) 555-0178', 'procurement@trinityschools.example', '780 Example Campus Dr', 'Fort Worth', 'TX', '76104', 'Net 30', 0],
];

const toPartner = (spec: PartnerSpec, shipsToBilling: boolean): Partner => {
  const [id, code, name, contact, phone, email, line1, city, state, zip, terms, leadDays] = spec;
  const address = { line1, city, state, zip };
  return {
    id,
    code,
    name,
    contact,
    email,
    phone,
    address,
    shippingAddress: shipsToBilling ? address : undefined,
    terms: `${terms} (informational)`,
    leadDays,
    active: true,
  };
};

/** [id, sku, name, category, brand, unit, costCents, priceCents, reorderPoint, supplierId] */
type ProductSpec = [string, string, string, string, string, string, number, number, number, string];

const PRODUCT_SPECS: ProductSpec[] = [
  ['gloves', 'SAF-100', 'Industrial work gloves', 'Safety', 'Meridian Essentials', 'case', 2400, 4200, 25, 'supplier-1'],
  ['filters', 'MRO-220', 'Equipment air filters', 'Maintenance', 'Northstar', 'each', 1250, 2350, 40, 'supplier-1'],
  ['tape', 'PKG-310', 'Heavy-duty packing tape', 'Packaging', 'Meridian Essentials', 'case', 1800, 3200, 20, 'supplier-2'],
  ['stretch', 'PKG-315', 'Stretch wrap film', 'Packaging', 'Cedar', 'roll', 950, 1850, 30, 'supplier-2'],
  ['boxes', 'PKG-330', 'Corrugated shipping boxes', 'Packaging', 'Cedar', 'bundle', 3100, 5400, 15, 'supplier-2'],
  ['bolts', 'FAS-410', 'Grade 8 hex bolts', 'Fasteners', 'Gulf Coast', 'box', 2750, 4800, 18, 'supplier-3'],
  ['anchors', 'FAS-425', 'Concrete wedge anchors', 'Fasteners', 'Gulf Coast', 'box', 3400, 5900, 12, 'supplier-3'],
  ['degreaser', 'JAN-510', 'Industrial degreaser concentrate', 'Janitorial', 'Brazos', 'case', 4200, 7100, 10, 'supplier-4'],
  ['liners', 'JAN-520', 'Heavy-duty can liners', 'Janitorial', 'Brazos', 'case', 2100, 3650, 35, 'supplier-4'],
  ['towels', 'JAN-535', 'Shop towel rolls', 'Janitorial', 'Brazos', 'case', 1650, 2950, 28, 'supplier-4'],
  ['conduit', 'ELE-610', 'EMT conduit, 10 ft', 'Electrical', 'Panhandle', 'each', 890, 1690, 50, 'supplier-5'],
  ['wirenuts', 'ELE-625', 'Insulated wire connectors', 'Electrical', 'Panhandle', 'box', 1450, 2600, 22, 'supplier-5'],
  ['breakers', 'ELE-640', '20A single-pole breakers', 'Electrical', 'Panhandle', 'each', 1120, 2100, 24, 'supplier-5'],
  ['respirators', 'SAF-115', 'N95 respirators', 'Safety', 'Meridian Essentials', 'case', 3600, 6200, 16, 'supplier-1'],
  ['vests', 'SAF-130', 'High-visibility safety vests', 'Safety', 'Meridian Essentials', 'case', 2900, 5100, 14, 'supplier-1'],
  ['lubricant', 'MRO-240', 'Multi-purpose lubricant spray', 'Maintenance', 'Northstar', 'case', 2250, 3950, 26, 'supplier-1'],
  ['belts', 'MRO-255', 'Replacement drive belts', 'Maintenance', 'Northstar', 'each', 1680, 2980, 20, 'supplier-1'],
  ['pallets', 'PKG-350', 'Reconditioned wood pallets', 'Packaging', 'Cedar', 'each', 1150, 2050, 40, 'supplier-2'],
];

const toProduct = (spec: ProductSpec): Product => {
  const [id, sku, name, category, brand, unit, cost, price, reorderPoint, supplierId] = spec;
  return {
    id,
    sku,
    name,
    description: `${name} — wholesale ${unit} pricing. Fictional catalogue item.`,
    category,
    brand,
    unit,
    cost,
    price,
    reorderPoint,
    supplierId,
    active: true,
  };
};

/**
 * Opening stock per product and warehouse.
 *
 * A handful of products are deliberately left at or below their reorder point
 * so the low-stock views and the purchasing workflow have something real to
 * show on a first visit.
 */
const OPENING: Record<string, [number, number, number]> = {
  gloves: [140, 60, 0],
  filters: [38, 12, 0],
  tape: [96, 44, 20],
  stretch: [150, 70, 30],
  boxes: [64, 22, 0],
  bolts: [88, 30, 0],
  anchors: [10, 4, 0],
  degreaser: [46, 18, 0],
  liners: [120, 55, 25],
  towels: [24, 9, 0],
  conduit: [260, 110, 60],
  wirenuts: [74, 28, 0],
  breakers: [18, 6, 0],
  respirators: [58, 20, 0],
  vests: [12, 5, 0],
  lubricant: [82, 35, 0],
  belts: [44, 16, 0],
  pallets: [190, 80, 45],
};

export function buildSeedState(today: Date = seedToday()): DistributionState {
  const suppliers = SUPPLIER_SPECS.map((spec) => toPartner(spec, false));
  const customers = CUSTOMER_SPECS.map((spec) => toPartner(spec, true));
  const products = PRODUCT_SPECS.map(toProduct);

  const movements: Movement[] = [];
  for (const product of products) {
    const opening = OPENING[product.id] ?? [0, 0, 0];
    WAREHOUSES.forEach((warehouse, index) => {
      const quantity = opening[index];
      if (quantity <= 0) return;
      movements.push({
        id: `opening-${product.id}-${warehouse.id}`,
        productId: product.id,
        warehouseId: warehouse.id,
        type: 'OPENING_BALANCE',
        quantity,
        at: timeOffset(today, -45, 8),
        source: 'Opening inventory',
        note: 'Fictional opening balance',
      });
    });
  }

  const price = (id: string) => products.find((entry) => entry.id === id)!.price;
  const cost = (id: string) => products.find((entry) => entry.id === id)!.cost;

  // ----------------------------------------------------------- purchasing

  const purchaseOrders: PurchaseOrder[] = [
    {
      id: 'po-1', code: 'PO-1001', supplierId: 'supplier-3', warehouseId: 'dallas',
      date: dayOffset(today, -12), expectedDate: dayOffset(today, -4), notes: 'Restock fasteners before the quarter closes.',
      status: 'Approved', discount: 0, taxBps: 0, freight: 8500,
      lines: [
        { id: 'po-1-a', productId: 'anchors', quantity: 40, unitPrice: cost('anchors') },
        { id: 'po-1-b', productId: 'bolts', quantity: 30, unitPrice: cost('bolts') },
      ],
    },
    {
      id: 'po-2', code: 'PO-1002', supplierId: 'supplier-4', warehouseId: 'dallas',
      date: dayOffset(today, -6), expectedDate: dayOffset(today, 3), notes: 'Janitorial replenishment.',
      status: 'Approved', discount: 0, taxBps: 0, freight: 6200,
      lines: [
        { id: 'po-2-a', productId: 'towels', quantity: 60, unitPrice: cost('towels') },
        { id: 'po-2-b', productId: 'degreaser', quantity: 24, unitPrice: cost('degreaser') },
      ],
    },
    {
      id: 'po-3', code: 'PO-1003', supplierId: 'supplier-5', warehouseId: 'austin',
      date: dayOffset(today, -3), expectedDate: dayOffset(today, 6), notes: 'Electrical stock for the Austin branch.',
      status: 'Submitted', discount: 0, taxBps: 0, freight: 4800,
      lines: [
        { id: 'po-3-a', productId: 'breakers', quantity: 80, unitPrice: cost('breakers') },
        { id: 'po-3-b', productId: 'wirenuts', quantity: 45, unitPrice: cost('wirenuts') },
      ],
    },
    {
      id: 'po-4', code: 'PO-1004', supplierId: 'supplier-1', warehouseId: 'dallas',
      date: dayOffset(today, -1), expectedDate: dayOffset(today, 9), notes: 'Safety line replenishment. Awaiting approval.',
      status: 'Draft', discount: 0, taxBps: 0, freight: 5500,
      lines: [
        { id: 'po-4-a', productId: 'vests', quantity: 36, unitPrice: cost('vests') },
        { id: 'po-4-b', productId: 'respirators', quantity: 24, unitPrice: cost('respirators') },
      ],
    },
  ];

  // PO-1001 arrived short: 25 of 40 anchors and all 30 bolts. It stays
  // Partially Received, which is what the receiving queue should surface.
  const receipts: Receipt[] = [
    {
      id: 'receipt-1', code: 'RCV-1001', poId: 'po-1', warehouseId: 'dallas',
      date: dayOffset(today, -4), reference: 'PS-88213', notes: 'Short shipment on anchors.',
      lines: [
        { lineId: 'po-1-a', quantity: 25 },
        { lineId: 'po-1-b', quantity: 30 },
      ],
    },
  ];

  for (const receipt of receipts) {
    const po = purchaseOrders.find((entry) => entry.id === receipt.poId)!;
    for (const line of receipt.lines) {
      const ordered = po.lines.find((entry) => entry.id === line.lineId)!;
      movements.push({
        id: `${receipt.id}:${line.lineId}`,
        productId: ordered.productId,
        warehouseId: po.warehouseId,
        type: 'RECEIPT',
        quantity: line.quantity,
        at: timeOffset(today, -4, 10),
        source: receipt.code,
        note: receipt.notes,
      });
    }
  }

  // ---------------------------------------------------------------- sales

  const orders: SalesOrder[] = [
    {
      id: 'order-1', code: 'SO-1001', customerId: 'customer-1', warehouseId: 'dallas',
      date: dayOffset(today, -9), requestedDate: dayOffset(today, -5),
      shippingAddress: '40 Example Office Lane, Dallas, TX 75204',
      notes: 'Standing quarterly order.', status: 'Confirmed',
      discount: 0, taxBps: 825, freight: 4500,
      lines: [
        { id: 'order-1-a', productId: 'gloves', quantity: 20, unitPrice: price('gloves') },
        { id: 'order-1-b', productId: 'liners', quantity: 15, unitPrice: price('liners') },
      ],
    },
    {
      id: 'order-2', code: 'SO-1002', customerId: 'customer-2', warehouseId: 'dallas',
      date: dayOffset(today, -5), requestedDate: dayOffset(today, 1),
      shippingAddress: '60 Example Commerce Dr, Austin, TX 78745',
      notes: 'Partial shipment agreed with the customer.', status: 'Confirmed',
      discount: 2500, taxBps: 825, freight: 3800,
      lines: [
        { id: 'order-2-a', productId: 'tape', quantity: 24, unitPrice: price('tape') },
        { id: 'order-2-b', productId: 'stretch', quantity: 18, unitPrice: price('stretch') },
      ],
    },
    {
      id: 'order-3', code: 'SO-1003', customerId: 'customer-3', warehouseId: 'dallas',
      date: dayOffset(today, -2), requestedDate: dayOffset(today, 4),
      shippingAddress: '9100 Example Port Blvd, Houston, TX 77015',
      notes: 'Awaiting allocation.', status: 'Confirmed',
      discount: 0, taxBps: 825, freight: 5200,
      lines: [
        { id: 'order-3-a', productId: 'conduit', quantity: 60, unitPrice: price('conduit') },
        { id: 'order-3-b', productId: 'breakers', quantity: 30, unitPrice: price('breakers') },
      ],
    },
    {
      id: 'order-4', code: 'SO-1004', customerId: 'customer-4', warehouseId: 'austin',
      date: dayOffset(today, -1), requestedDate: dayOffset(today, 7),
      shippingAddress: '515 Example Mission Way, San Antonio, TX 78205',
      notes: 'Quote being finalised.', status: 'Draft',
      discount: 0, taxBps: 825, freight: 3600,
      lines: [
        { id: 'order-4-a', productId: 'pallets', quantity: 40, unitPrice: price('pallets') },
      ],
    },
    {
      id: 'order-5', code: 'SO-1005', customerId: 'customer-6', warehouseId: 'dallas',
      date: dayOffset(today, -16), requestedDate: dayOffset(today, -12),
      shippingAddress: '780 Example Campus Dr, Fort Worth, TX 76104',
      notes: 'Completed and invoiced.', status: 'Confirmed',
      discount: 0, taxBps: 825, freight: 4100,
      lines: [
        { id: 'order-5-a', productId: 'lubricant', quantity: 12, unitPrice: price('lubricant') },
        { id: 'order-5-b', productId: 'belts', quantity: 8, unitPrice: price('belts') },
      ],
    },
  ];

  // SO-1005 shipped in full a fortnight ago. SO-1002 shipped part of its tape
  // line, leaving a backorder the fulfillment queue has to finish.
  const shipments: Shipment[] = [
    {
      id: 'shipment-1', code: 'SHP-1001', orderId: 'order-5', warehouseId: 'dallas',
      date: dayOffset(today, -13), carrier: 'Regional Freight', tracking: 'RF-4471902',
      lines: [
        { lineId: 'order-5-a', quantity: 12 },
        { lineId: 'order-5-b', quantity: 8 },
      ],
    },
    {
      id: 'shipment-2', code: 'SHP-1002', orderId: 'order-2', warehouseId: 'dallas',
      date: dayOffset(today, -2), carrier: 'Lone Star Logistics', tracking: 'LSL-220841',
      lines: [{ lineId: 'order-2-a', quantity: 14 }],
    },
  ];

  for (const shipment of shipments) {
    const order = orders.find((entry) => entry.id === shipment.orderId)!;
    for (const line of shipment.lines) {
      const ordered = order.lines.find((entry) => entry.id === line.lineId)!;
      movements.push({
        id: `${shipment.id}:${line.lineId}`,
        productId: ordered.productId,
        warehouseId: shipment.warehouseId,
        type: 'SHIPMENT',
        quantity: -line.quantity,
        at: timeOffset(today, shipment.id === 'shipment-1' ? -13 : -2, 15),
        source: shipment.code,
        note: '',
      });
    }
  }

  // SO-1001 is allocated and picked, waiting to be packed and shipped. The
  // remainder of SO-1002's tape line is allocated but not yet picked.
  const allocations: Allocation[] = [
    { id: 'order-1:order-1-a', orderId: 'order-1', lineId: 'order-1-a', productId: 'gloves', warehouseId: 'dallas', quantity: 20, picked: 20, packed: 0 },
    { id: 'order-1:order-1-b', orderId: 'order-1', lineId: 'order-1-b', productId: 'liners', warehouseId: 'dallas', quantity: 15, picked: 15, packed: 0 },
    { id: 'order-2:order-2-a', orderId: 'order-2', lineId: 'order-2-a', productId: 'tape', warehouseId: 'dallas', quantity: 10, picked: 0, packed: 0 },
    { id: 'order-2:order-2-b', orderId: 'order-2', lineId: 'order-2-b', productId: 'stretch', warehouseId: 'dallas', quantity: 18, picked: 0, packed: 0 },
  ];

  // --------------------------------------------------------------- finance

  const invoices: Invoice[] = [
    {
      id: 'invoice-1', code: 'INV-1001', orderId: 'order-5', customerId: 'customer-6',
      date: dayOffset(today, -13), dueDate: dayOffset(today, 17), status: 'Sent',
      discount: 0, taxBps: 825, freight: 4100,
      lines: [
        { id: 'order-5-a', productId: 'lubricant', quantity: 12, unitPrice: price('lubricant') },
        { id: 'order-5-b', productId: 'belts', quantity: 8, unitPrice: price('belts') },
      ],
    },
  ];

  const payments: Payment[] = [
    {
      id: 'payment-1', code: 'PAY-1001', invoiceId: 'invoice-1', customerId: 'customer-6',
      date: dayOffset(today, -6), amount: 25_000, method: 'ACH', reference: 'ACH-77120',
    },
  ];

  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {
      companyName: 'Meridian Supply Co.',
      legalLine: 'Meridian Supply Co. · Wholesale distribution (demonstration workspace)',
      address: { line1: '4180 Example Supply Way', city: 'Dallas', state: 'TX', zip: '75201' },
      phone: '(214) 555-0100',
      email: 'orders@meridiansupply.example',
      defaultTaxBps: 825,
      paymentTermsDays: 30,
    },
    products,
    // Copied, not shared: buildSeedState() must hand back a workspace that
    // callers can mutate without reaching back into this module.
    warehouses: WAREHOUSES.map((warehouse) => ({ ...warehouse, address: { ...warehouse.address } })),
    suppliers,
    customers,
    movements,
    purchaseOrders,
    receipts,
    orders,
    allocations,
    shipments,
    invoices,
    payments,
    transfers: [],
    returns: [],
    activity: [],
  };
}
