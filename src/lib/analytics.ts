/**
 * Conversion analytics.
 *
 * Vendor-agnostic on purpose: components call `track(...)` and never import a
 * provider. Until one is configured this is a no-op, so nothing is collected
 * and no consent banner is owed. To connect a provider, load its script in
 * `index.html` and expose a `window.analytics.track(event, props)` shim — or
 * replace the single `deliver` function below.
 *
 * Only anonymous interaction counts are sent. Never pass form contents,
 * email addresses or anything else a visitor typed.
 */

export type AnalyticsEvent =
  | 'cta_hero_click'
  | 'cta_header_click'
  | 'industry_select'
  | 'demo_preview_interact'
  | 'faq_open'
  | 'inquiry_start'
  | 'inquiry_submit_success'
  | 'inquiry_submit_error'
  // Contractor Operations demo. Categorical metadata only — never record
  // contents, names, addresses or anything a visitor typed.
  | 'contractor_demo_opened'
  | 'contractor_demo_reset'
  | 'contractor_demo_cta_clicked'
  | 'lead_created'
  | 'estimate_created'
  | 'estimate_accepted'
  | 'job_created'
  | 'job_scheduled'
  | 'job_completed'
  | 'field_record_added'
  | 'invoice_created'
  | 'demo_payment_recorded'
  // Dealer Operations demo. Same rule: categorical metadata only — never a
  // name, a VIN, an address, an amount, a note or a document's contents.
  | 'dealer_demo_opened'
  | 'dealer_demo_reset'
  | 'dealer_demo_cta_clicked'
  | 'vehicle_viewed'
  | 'reservation_created'
  | 'reservation_confirmed'
  | 'deal_created'
  | 'financing_status_changed'
  | 'deal_closed'
  | 'vehicle_delivered'
  // Distribution Operations demo. Same rule: categorical metadata only — never
  // a SKU, a product or partner name, an address, an amount, a tracking number
  // or any record contents.
  | 'distribution_demo_opened'
  | 'distribution_demo_reset'
  | 'distribution_demo_cta_clicked'
  | 'purchase_order_created'
  | 'receipt_posted'
  | 'sales_order_created'
  | 'stock_allocated'
  | 'shipment_posted'
  | 'invoice_created'
  | 'inventory_adjusted'
  | 'inventory_transfer_completed'
  | 'customer_return_posted';

type Props = Record<string, string | number | boolean>;

interface AnalyticsSink {
  track: (event: string, props?: Props) => void;
}

declare global {
  interface Window {
    analytics?: AnalyticsSink;
  }
}

function deliver(event: AnalyticsEvent, props?: Props) {
  window.analytics?.track(event, props);
}

/** Records a conversion event. Safe to call before any provider exists. */
export function track(event: AnalyticsEvent, props?: Props) {
  if (typeof window === 'undefined') return;
  try {
    deliver(event, props);
  } catch {
    // Analytics must never take the page down with it.
  }
}

/**
 * Fires once per page load for the given event. Used for milestones like
 * "the visitor started filling in the inquiry form", which would otherwise
 * fire on every keystroke.
 */
export function createOnceTracker() {
  const fired = new Set<AnalyticsEvent>();
  return (event: AnalyticsEvent, props?: Props) => {
    if (fired.has(event)) return;
    fired.add(event);
    track(event, props);
  };
}
