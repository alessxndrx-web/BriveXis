/**
 * Demo catalogue — the single source of truth for the three product demos.
 *
 * Everything a demo page needs is modelled here: when one ships, set
 * `status: 'live'` and the Demos section switches from "Preview coming soon" to
 * a working Launch Demo action pointing at `route`. No component changes, no
 * redesign.
 */

export type DemoStatus = 'preview' | 'live';

/** Structural layout used by the preview frame. Never renders business data. */
export type DemoPreviewVariant = 'board' | 'table' | 'record';

export interface DemoProduct {
  id: string;
  /** Stable URL segment. Reserved now so links never have to change later. */
  slug: string;
  /** Absolute in-app path of the future demo page. */
  route: string;
  title: string;
  industry: string;
  shortDescription: string;
  /** Longer positioning copy for the future demo page. */
  longDescription: string;
  /** Module navigation shown in the preview frame and in the future app shell. */
  modules: string[];
  workflow: string[];
  preview: {
    variant: DemoPreviewVariant;
    /** Screen name shown inside the frame. */
    screen: string;
    /** Column or stage labels. Structural labels only. */
    labels: string[];
  };
  status: DemoStatus;
  /** Static preview image path. Set once a real screenshot exists. */
  thumbnail?: string;
  /** Screenshot gallery for the future demo page. */
  screenshots?: string[];
  /** Feature list shown alongside the launch action once the demo is live. */
  features?: string[];
}

export const demos: DemoProduct[] = [
  {
    id: 'contractor-operations',
    slug: 'contractor-operations',
    route: '/demos/contractor-operations',
    title: 'Contractor Operations',
    industry: 'Contractors & Field Services',
    shortDescription:
      'A single workspace for leads, estimates, scheduled jobs, crew assignment, invoicing and customer follow-up.',
    longDescription:
      'Contractors win work in the office and deliver it in the field, which is where job information usually splits apart. This system keeps the estimate, the scheduled job, the assigned crew, the field record and the invoice attached to the same customer, so nothing has to be reassembled by hand at the end of the week.',
    modules: ['Leads', 'Estimates', 'Jobs', 'Crews', 'Invoices', 'Reports'],
    workflow: ['Lead', 'Estimate', 'Job', 'Crew', 'Invoice', 'Follow-up'],
    preview: {
      variant: 'board',
      screen: 'Job scheduling',
      labels: ['Estimated', 'Scheduled', 'In progress'],
    },
    status: 'live',
    // A real screenshot of the running application, not an illustration.
    thumbnail: '/demo-contractor-operations.png',
    features: [
      'Lead pipeline, estimates and customer records in one place',
      'Jobs, scheduling, crew assignment and field reporting',
      'Invoicing and payment tracking from the accepted estimate',
    ],
  },
  {
    id: 'dealer-operations',
    slug: 'dealer-operations',
    route: '/demos/dealer-operations',
    title: 'Dealer Operations',
    industry: 'Dealers & Automotive Businesses',
    shortDescription:
      'Inventory, incoming leads, customer records, reservations and sales handled inside one connected platform.',
    longDescription:
      'Dealer inventory and customer interest both change daily, and they rarely live in the same place. This system connects each unit to the inquiries about it, the reservation holding it and the sale that closes it, so the team is working from one status instead of three.',
    modules: ['Inventory', 'Leads', 'Customers', 'Reservations', 'Sales', 'Reports'],
    workflow: ['Lead', 'Customer', 'Inventory', 'Reservation', 'Sale'],
    preview: {
      variant: 'record',
      screen: 'Unit record',
      labels: ['Identification', 'Status', 'Assigned to', 'Reservation', 'History'],
    },
    status: 'live',
    // A real screenshot of the running application, not an illustration.
    thumbnail: '/demo-dealer-operations.png',
    features: [
      'Vehicle inventory with stock numbers, status and aging',
      'Leads, reservations and deposits that hold a vehicle',
      'Deals, a financing application tracker, payments and delivery',
    ],
  },
  {
    id: 'distribution-operations',
    slug: 'distribution-operations',
    route: '/demos/distribution-operations',
    title: 'Distribution Operations',
    industry: 'Distribution & Wholesale',
    shortDescription:
      'Purchasing, stock control, customer orders and operational reporting for businesses that move volume every day.',
    longDescription:
      'In distribution, purchasing, stock and customer orders all depend on each other, so one unreliable number affects every step downstream. This system records movements as they happen and checks orders against real stock, which is what keeps fulfillment and reporting trustworthy.',
    modules: ['Products', 'Inventory', 'Purchasing', 'Orders', 'Customers', 'Reports'],
    workflow: ['Purchasing', 'Receiving', 'Inventory', 'Order', 'Fulfillment', 'Reporting'],
    preview: {
      variant: 'table',
      screen: 'Order queue',
      labels: ['Order', 'Customer', 'Stage', 'Status'],
    },
    status: 'live',
    // A real screenshot of the running application, not an illustration.
    thumbnail: '/demo-distribution-operations.png',
    features: [
      'Products, multi-warehouse inventory and an immutable movement ledger',
      'Purchase orders, partial receiving and supplier records',
      'Sales orders, stock allocation, picking, shipments and backorders',
      'Invoices for shipped units, payments, returns and warehouse transfers',
    ],
  },
];
