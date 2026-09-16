/**
 * Route table for the distribution demo.
 *
 * The site router owns the pathname; this module only interprets the part of it
 * that belongs to the demo. Keeping the parsing here means deep links, sidebar
 * highlighting and role gating all read from one source.
 */

export const DISTRIBUTION_BASE = '/demos/distribution-operations';

export type ModuleId =
  | 'dashboard'
  | 'products'
  | 'warehouses'
  | 'inventory'
  | 'suppliers'
  | 'purchasing'
  | 'receiving'
  | 'customers'
  | 'orders'
  | 'fulfillment'
  | 'shipments'
  | 'transfers'
  | 'returns'
  | 'invoices'
  | 'payments'
  | 'reports'
  | 'settings';

export interface ModuleDefinition {
  id: ModuleId;
  label: string;
  /** Path segment. Empty for the dashboard, which is the demo root. */
  segment: string;
  group: 'Overview' | 'Catalog' | 'Inbound' | 'Outbound' | 'Financial' | 'Workspace';
}

export const MODULES: ModuleDefinition[] = [
  { id: 'dashboard', label: 'Overview', segment: '', group: 'Overview' },

  { id: 'products', label: 'Products', segment: 'products', group: 'Catalog' },
  { id: 'warehouses', label: 'Warehouses', segment: 'warehouses', group: 'Catalog' },
  { id: 'inventory', label: 'Inventory', segment: 'inventory', group: 'Catalog' },
  { id: 'transfers', label: 'Transfers', segment: 'transfers', group: 'Catalog' },

  { id: 'suppliers', label: 'Suppliers', segment: 'suppliers', group: 'Inbound' },
  { id: 'purchasing', label: 'Purchasing', segment: 'purchasing', group: 'Inbound' },
  { id: 'receiving', label: 'Receiving', segment: 'receiving', group: 'Inbound' },

  { id: 'customers', label: 'Customers', segment: 'customers', group: 'Outbound' },
  { id: 'orders', label: 'Sales Orders', segment: 'orders', group: 'Outbound' },
  { id: 'fulfillment', label: 'Fulfillment', segment: 'fulfillment', group: 'Outbound' },
  { id: 'shipments', label: 'Shipments', segment: 'shipments', group: 'Outbound' },
  { id: 'returns', label: 'Returns', segment: 'returns', group: 'Outbound' },

  { id: 'invoices', label: 'Invoices', segment: 'invoices', group: 'Financial' },
  { id: 'payments', label: 'Payments', segment: 'payments', group: 'Financial' },

  { id: 'reports', label: 'Reports', segment: 'reports', group: 'Workspace' },
  { id: 'settings', label: 'Settings', segment: 'settings', group: 'Workspace' },
];

export const MODULE_GROUPS: ModuleDefinition['group'][] = [
  'Overview',
  'Catalog',
  'Inbound',
  'Outbound',
  'Financial',
  'Workspace',
];

export interface DistributionRoute {
  module: ModuleId;
  /** Record id for a detail view, when the path carries one. */
  recordId?: string;
  /** Trailing verb such as `print`. */
  view?: string;
  /** True when the path did not match any module. */
  unknown: boolean;
}

const SEGMENT_TO_MODULE = new Map<string, ModuleId>(
  MODULES.filter((module) => module.segment).map((module) => [module.segment, module.id]),
);

const VERBS = new Set(['print', 'new']);

export function parseDistributionRoute(pathname: string): DistributionRoute {
  const relative = pathname.startsWith(DISTRIBUTION_BASE)
    ? pathname.slice(DISTRIBUTION_BASE.length)
    : pathname;
  const segments = relative.split('/').filter(Boolean);

  if (segments.length === 0) return { module: 'dashboard', unknown: false };
  if (segments[0] === 'dashboard') return { module: 'dashboard', unknown: false };

  const module = SEGMENT_TO_MODULE.get(segments[0]);
  if (!module) return { module: 'dashboard', unknown: true };

  const [, second, third] = segments;
  if (second && VERBS.has(second)) return { module, view: second, unknown: false };

  return { module, recordId: second, view: third, unknown: false };
}

// ------------------------------------------------------------------- links

const join = (...parts: (string | undefined)[]) =>
  [DISTRIBUTION_BASE, ...parts.filter(Boolean)].join('/').replace(/\/+$/, '') || DISTRIBUTION_BASE;

export const paths = {
  root: DISTRIBUTION_BASE,
  module: (module: ModuleId) => {
    const definition = MODULES.find((candidate) => candidate.id === module);
    return join(definition?.segment);
  },
  product: (id: string) => join('products', id),
  warehouse: (id: string) => join('warehouses', id),
  supplier: (id: string) => join('suppliers', id),
  purchaseOrder: (id: string) => join('purchasing', id),
  purchaseOrderPrint: (id: string) => join('purchasing', id, 'print'),
  receipt: (id: string) => join('receiving', id),
  customer: (id: string) => join('customers', id),
  order: (id: string) => join('orders', id),
  shipment: (id: string) => join('shipments', id),
  shipmentPrint: (id: string) => join('shipments', id, 'print'),
  invoice: (id: string) => join('invoices', id),
  invoicePrint: (id: string) => join('invoices', id, 'print'),
};

export const MODULE_TITLES: Record<ModuleId, string> = {
  dashboard: 'Overview',
  products: 'Products',
  warehouses: 'Warehouses',
  inventory: 'Inventory',
  suppliers: 'Suppliers',
  purchasing: 'Purchasing',
  receiving: 'Receiving',
  customers: 'Customers',
  orders: 'Sales Orders',
  fulfillment: 'Fulfillment',
  shipments: 'Shipments',
  transfers: 'Transfers',
  returns: 'Returns',
  invoices: 'Invoices',
  payments: 'Payments',
  reports: 'Reports',
  settings: 'Settings',
};

// -------------------------------------------------------------- demo roles

export type DemoRole = 'owner' | 'operations' | 'purchasing' | 'warehouse' | 'sales' | 'finance';

export const DEMO_ROLES: { id: DemoRole; label: string; description: string }[] = [
  { id: 'owner', label: 'Owner', description: 'Every module.' },
  { id: 'operations', label: 'Operations Manager', description: 'Broad operational access.' },
  { id: 'purchasing', label: 'Purchasing', description: 'Suppliers, purchase orders and inbound goods.' },
  { id: 'warehouse', label: 'Warehouse', description: 'Inventory, receiving, fulfillment, shipments, transfers.' },
  { id: 'sales', label: 'Sales', description: 'Customers and sales orders.' },
  { id: 'finance', label: 'Finance', description: 'Invoices, payments and reporting.' },
];

/**
 * Which modules each demo role can reach.
 *
 * Not authentication — a label on a control that changes the navigation, so a
 * visitor can see how the same workspace looks to each part of a distributor.
 */
export const ROLE_MODULES: Record<DemoRole, ModuleId[]> = {
  owner: MODULES.map((module) => module.id),
  operations: [
    'dashboard', 'products', 'warehouses', 'inventory', 'transfers',
    'suppliers', 'purchasing', 'receiving',
    'customers', 'orders', 'fulfillment', 'shipments', 'returns',
    'reports', 'settings',
  ],
  purchasing: [
    'dashboard', 'products', 'inventory', 'suppliers', 'purchasing', 'receiving', 'reports', 'settings',
  ],
  warehouse: [
    'dashboard', 'products', 'warehouses', 'inventory', 'transfers',
    'receiving', 'fulfillment', 'shipments', 'returns', 'settings',
  ],
  sales: ['dashboard', 'products', 'inventory', 'customers', 'orders', 'settings'],
  finance: ['dashboard', 'customers', 'orders', 'invoices', 'payments', 'reports', 'settings'],
};
