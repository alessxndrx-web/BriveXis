import type { Id } from './dealer.types';

/**
 * Route table for the dealer demo.
 *
 * The site router owns the pathname; this module only interprets the part of it
 * that belongs to the demo. Keeping the parsing here means deep links, sidebar
 * highlighting and role gating all read from one source.
 */

export const DEALER_BASE = '/demos/dealer-operations';

export type ModuleId =
  | 'dashboard'
  | 'leads'
  | 'customers'
  | 'inventory'
  | 'reservations'
  | 'deals'
  | 'financing'
  | 'payments'
  | 'documents'
  | 'tasks'
  | 'reports'
  | 'settings';

export interface ModuleDefinition {
  id: ModuleId;
  label: string;
  /** Path segment. Empty for the dashboard, which is the demo root. */
  segment: string;
  group: 'Overview' | 'Sales' | 'Inventory' | 'Finance' | 'Workspace';
}

export const MODULES: ModuleDefinition[] = [
  { id: 'dashboard', label: 'Overview', segment: '', group: 'Overview' },
  { id: 'leads', label: 'Leads', segment: 'leads', group: 'Sales' },
  { id: 'customers', label: 'Customers', segment: 'customers', group: 'Sales' },
  { id: 'inventory', label: 'Inventory', segment: 'inventory', group: 'Inventory' },
  { id: 'reservations', label: 'Reservations', segment: 'reservations', group: 'Inventory' },
  { id: 'deals', label: 'Deals', segment: 'deals', group: 'Finance' },
  { id: 'financing', label: 'Financing', segment: 'financing', group: 'Finance' },
  { id: 'payments', label: 'Payments', segment: 'payments', group: 'Finance' },
  { id: 'documents', label: 'Documents', segment: 'documents', group: 'Workspace' },
  { id: 'tasks', label: 'Tasks', segment: 'tasks', group: 'Workspace' },
  { id: 'reports', label: 'Reports', segment: 'reports', group: 'Workspace' },
  { id: 'settings', label: 'Settings', segment: 'settings', group: 'Workspace' },
];

export const MODULE_GROUPS: ModuleDefinition['group'][] = [
  'Overview',
  'Sales',
  'Inventory',
  'Finance',
  'Workspace',
];

/** A parsed demo location: which module, and which record inside it. */
export interface DealerRoute {
  module: ModuleId;
  recordId?: Id;
  /** Trailing verb such as `new`, `edit` or `print`. */
  view?: string;
  /** True when the path did not match any module. */
  unknown: boolean;
}

const SEGMENT_TO_MODULE = new Map<string, ModuleId>(
  MODULES.filter((module) => module.segment).map((module) => [module.segment, module.id]),
);

const VERBS = new Set(['new', 'print', 'edit']);

export function parseDealerRoute(pathname: string): DealerRoute {
  const relative = pathname.startsWith(DEALER_BASE) ? pathname.slice(DEALER_BASE.length) : pathname;
  const segments = relative.split('/').filter(Boolean);

  if (segments.length === 0) return { module: 'dashboard', unknown: false };

  // `/dashboard` is accepted as an explicit alias for the demo root.
  if (segments[0] === 'dashboard') return { module: 'dashboard', unknown: false };

  const module = SEGMENT_TO_MODULE.get(segments[0]);
  if (!module) return { module: 'dashboard', unknown: true };

  const [, second, third] = segments;

  if (second && VERBS.has(second)) return { module, view: second, unknown: false };

  return { module, recordId: second, view: third, unknown: false };
}

// ------------------------------------------------------------------- links

const join = (...parts: (string | undefined)[]) =>
  [DEALER_BASE, ...parts.filter(Boolean)].join('/').replace(/\/+$/, '') || DEALER_BASE;

export const paths = {
  root: DEALER_BASE,
  module: (module: ModuleId) => {
    const definition = MODULES.find((candidate) => candidate.id === module);
    return join(definition?.segment);
  },
  lead: (id: Id) => join('leads', id),
  customer: (id: Id) => join('customers', id),
  vehicle: (id: Id) => join('inventory', id),
  vehicleNew: () => join('inventory', 'new'),
  reservation: (id: Id) => join('reservations', id),
  reservationPrint: (id: Id) => join('reservations', id, 'print'),
  deal: (id: Id) => join('deals', id),
  dealPrint: (id: Id) => join('deals', id, 'print'),
  financingApplication: (id: Id) => join('financing', id),
  payment: (id: Id) => join('payments', id),
  paymentPrint: (id: Id) => join('payments', id, 'print'),
};

export const MODULE_TITLES: Record<ModuleId, string> = {
  dashboard: 'Overview',
  leads: 'Leads',
  customers: 'Customers',
  inventory: 'Inventory',
  reservations: 'Reservations',
  deals: 'Deals',
  financing: 'Financing',
  payments: 'Payments',
  documents: 'Documents',
  tasks: 'Tasks',
  reports: 'Reports',
  settings: 'Settings',
};
