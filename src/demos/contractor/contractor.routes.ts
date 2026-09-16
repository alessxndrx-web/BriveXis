import type { Id } from './contractor.types';

/**
 * Route table for the contractor demo.
 *
 * The site router owns the pathname; this module only interprets the part of
 * it that belongs to the demo. Keeping the parsing here means deep links,
 * sidebar highlighting and breadcrumbs all read from one source.
 */

export const CONTRACTOR_BASE = '/demos/contractor-operations';

export type ModuleId =
  | 'dashboard'
  | 'leads'
  | 'customers'
  | 'estimates'
  | 'jobs'
  | 'schedule'
  | 'crews'
  | 'invoices'
  | 'payments'
  | 'reports'
  | 'settings';

export interface ModuleDefinition {
  id: ModuleId;
  label: string;
  /** Path segment. Empty for the dashboard, which is the demo root. */
  segment: string;
  /** Sidebar group heading. 'Overview' is rendered without one. */
  group: 'Overview' | 'Sales' | 'Operations' | 'Financial' | 'Workspace';
}

export const MODULES: ModuleDefinition[] = [
  { id: 'dashboard', label: 'Overview', segment: '', group: 'Overview' },
  { id: 'leads', label: 'Leads', segment: 'leads', group: 'Sales' },
  { id: 'customers', label: 'Customers', segment: 'customers', group: 'Sales' },
  { id: 'estimates', label: 'Estimates', segment: 'estimates', group: 'Sales' },
  { id: 'jobs', label: 'Jobs', segment: 'jobs', group: 'Operations' },
  { id: 'schedule', label: 'Schedule', segment: 'schedule', group: 'Operations' },
  { id: 'crews', label: 'Crews', segment: 'crews', group: 'Operations' },
  { id: 'invoices', label: 'Invoices', segment: 'invoices', group: 'Financial' },
  { id: 'payments', label: 'Payments', segment: 'payments', group: 'Financial' },
  { id: 'reports', label: 'Reports', segment: 'reports', group: 'Workspace' },
  { id: 'settings', label: 'Settings', segment: 'settings', group: 'Workspace' },

];

export const MODULE_GROUPS: ModuleDefinition['group'][] = [
  'Overview',
  'Sales',
  'Operations',
  'Financial',
  'Workspace',
];

/** A parsed demo location: which module, and which record inside it. */
export interface ContractorRoute {
  module: ModuleId;
  /** Record id for a detail view, when the path carries one. */
  recordId?: Id;
  /** Trailing verb such as `edit`, `new` or `print`. */
  view?: string;
  /** True when the path did not match any module. */
  unknown: boolean;
}

const SEGMENT_TO_MODULE = new Map<string, ModuleId>(
  MODULES.filter((module) => module.segment).map((module) => [module.segment, module.id]),
);

export function parseContractorRoute(pathname: string): ContractorRoute {
  const relative = pathname.startsWith(CONTRACTOR_BASE)
    ? pathname.slice(CONTRACTOR_BASE.length)
    : pathname;

  const segments = relative.split('/').filter(Boolean);

  if (segments.length === 0) return { module: 'dashboard', unknown: false };

  // `/dashboard` is accepted as an explicit alias for the demo root.
  if (segments[0] === 'dashboard') {
    return { module: 'dashboard', unknown: false };
  }

  const module = SEGMENT_TO_MODULE.get(segments[0]);
  if (!module) return { module: 'dashboard', unknown: true };

  const [, second, third] = segments;

  // `/estimates/new` is a view, not a record id.
  if (second && (second === 'new' || second === 'print')) {
    return { module, view: second, unknown: false };
  }

  return { module, recordId: second, view: third, unknown: false };
}

// ------------------------------------------------------------------- links

const join = (...parts: (string | undefined)[]) =>
  [CONTRACTOR_BASE, ...parts.filter(Boolean)].join('/').replace(/\/+$/, '') || CONTRACTOR_BASE;

export const paths = {
  root: CONTRACTOR_BASE,
  module: (module: ModuleId) => {
    const definition = MODULES.find((candidate) => candidate.id === module);
    return join(definition?.segment);
  },
  lead: (id: Id) => join('leads', id),
  customer: (id: Id) => join('customers', id),
  estimate: (id: Id) => join('estimates', id),
  estimateNew: () => join('estimates', 'new'),
  estimateEdit: (id: Id) => join('estimates', id, 'edit'),
  estimatePrint: (id: Id) => join('estimates', id, 'print'),
  job: (id: Id) => join('jobs', id),
  crew: (id: Id) => join('crews', id),
  invoice: (id: Id) => join('invoices', id),
  invoiceEdit: (id: Id) => join('invoices', id, 'edit'),
  invoicePrint: (id: Id) => join('invoices', id, 'print'),
  payment: (id: Id) => join('payments', id),
};

/** Title shown in the top bar and the document title for a module. */
export const MODULE_TITLES: Record<ModuleId, string> = {
  dashboard: 'Overview',
  leads: 'Leads',
  customers: 'Customers',
  estimates: 'Estimates',
  jobs: 'Jobs',
  schedule: 'Schedule',
  crews: 'Crews',
  invoices: 'Invoices',
  payments: 'Payments',
  reports: 'Reports',
  settings: 'Settings',
};
