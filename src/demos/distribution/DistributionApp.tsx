import { useEffect } from 'react';
import { useRouter } from '../../lib/router';
import { track } from '../../lib/analytics';
import { SITE_URL } from '../../config/site';
import { useDocumentMeta, useStructuredData } from '../../lib/seo';
import { DistributionProvider, useDistribution } from './DistributionProvider';
import {
  DISTRIBUTION_BASE,
  ROLE_MODULES,
  parseDistributionRoute,
  paths,
} from './distribution.routes';
import { AppShell } from './components/AppShell';
import { Toasts } from './components/Toasts';
import { EmptyState, LinkButton } from '../shared/ui/AppUI';
import { Dashboard } from './pages/Dashboard';
import {
  InventoryPage,
  ProductDetail,
  ProductsPage,
  WarehouseDetail,
  WarehousesPage,
} from './pages/Catalog';
import {
  PurchaseOrderDetail,
  PurchasingPage,
  ReceivingPage,
  SupplierDetail,
  SuppliersPage,
} from './pages/Purchasing';
import { CustomerDetail, CustomersPage, OrderDetail, OrdersPage } from './pages/Sales';
import {
  FulfillmentPage,
  ReturnsPage,
  ShipmentDetail,
  ShipmentsPage,
} from './pages/Fulfillment';
import { TransfersPage } from './pages/Logistics';
import { InvoiceDetail, InvoicesPage, PaymentsPage } from './pages/Finance';
import { ReportsPage } from './pages/Reports';
import { SettingsPage } from './pages/Settings';
import { InvoicePrint, PackingSlipPrint, PurchaseOrderPrint } from './pages/PrintDocument';

/**
 * Distribution Operations — application root.
 *
 * Lazy-loaded by the site router, so none of this reaches the marketing home
 * page's bundle. It parses the part of the URL below
 * `/demos/distribution-operations` itself, which keeps every screen
 * deep-linkable and makes browser back and forward work without extra handling.
 */

function softwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Distribution Operations',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web browser',
    url: `${SITE_URL}${DISTRIBUTION_BASE}`,
    description:
      'An interactive demonstration of a wholesale distribution platform covering suppliers, products, multi-warehouse inventory, purchasing, receiving, sales orders, stock allocation, fulfillment, shipments, invoices, payments, transfers and returns.',
    inLanguage: 'en-US',
    isAccessibleForFree: true,
    provider: { '@id': `${SITE_URL}/#organization` },
  };
}

function DistributionRoutes() {
  const { pathname } = useRouter();
  const { role, recoveryNotice, clearRecoveryNotice, notify } = useDistribution();

  const route = parseDistributionRoute(pathname);

  // Corrupt or outdated stored data is reported once, after the workspace has
  // already been restored from the seed, so the visitor is never left guessing
  // why their changes are gone.
  useEffect(() => {
    if (!recoveryNotice) return;
    notify(recoveryNotice, 'warning');
    clearRecoveryNotice();
  }, [recoveryNotice, notify, clearRecoveryNotice]);

  // Print views take the whole screen: no sidebar, no top bar, nothing that
  // would end up on paper.
  if (route.view === 'print' && route.recordId) {
    if (route.module === 'purchasing') return <PurchaseOrderPrint purchaseOrderId={route.recordId} />;
    if (route.module === 'shipments') return <PackingSlipPrint shipmentId={route.recordId} />;
    if (route.module === 'invoices') return <InvoicePrint invoiceId={route.recordId} />;
  }

  const accessible = ROLE_MODULES[role].includes(route.module);

  return (
    <AppShell activeModule={route.module}>
      {route.unknown ? (
        <EmptyState
          title="That screen does not exist"
          description="The link may be out of date. Everything is reachable from the overview."
          action={<LinkButton href={paths.root}>Back to overview</LinkButton>}
        />
      ) : !accessible ? (
        <EmptyState
          title="Not available for this demo role"
          description="This module is not part of that role's workspace. Switch the demo role in the sidebar to see it."
          action={<LinkButton href={paths.root}>Back to overview</LinkButton>}
        />
      ) : (
        <Screen route={route} />
      )}
      <Toasts />
    </AppShell>
  );
}

function Screen({ route }: { route: ReturnType<typeof parseDistributionRoute> }) {
  const { module, recordId } = route;

  switch (module) {
    case 'dashboard':
      return <Dashboard />;

    case 'products':
      return recordId ? <ProductDetail productId={recordId} /> : <ProductsPage />;

    case 'warehouses':
      return recordId ? <WarehouseDetail warehouseId={recordId} /> : <WarehousesPage />;

    case 'inventory':
      return <InventoryPage />;

    case 'transfers':
      return <TransfersPage />;

    case 'suppliers':
      return recordId ? <SupplierDetail supplierId={recordId} /> : <SuppliersPage />;

    case 'purchasing':
      return recordId ? <PurchaseOrderDetail purchaseOrderId={recordId} /> : <PurchasingPage />;

    case 'receiving':
      return <ReceivingPage />;

    case 'customers':
      return recordId ? <CustomerDetail customerId={recordId} /> : <CustomersPage />;

    case 'orders':
      return recordId ? <OrderDetail orderId={recordId} /> : <OrdersPage />;

    case 'fulfillment':
      return <FulfillmentPage />;

    case 'shipments':
      return recordId ? <ShipmentDetail shipmentId={recordId} /> : <ShipmentsPage />;

    case 'returns':
      return <ReturnsPage />;

    case 'invoices':
      return recordId ? <InvoiceDetail invoiceId={recordId} /> : <InvoicesPage />;

    case 'payments':
      return <PaymentsPage />;

    case 'reports':
      return <ReportsPage />;

    case 'settings':
      return <SettingsPage />;

    default:
      return <Dashboard />;
  }
}

export default function DistributionApp() {
  useDocumentMeta({
    title: 'Distribution Operations Demo | BriveXis',
    description:
      'An interactive demonstration of wholesale distribution software: suppliers, products, multi-warehouse inventory, purchasing, receiving, sales orders, allocation, fulfillment, shipments, invoices and payments in one connected system.',
    path: DISTRIBUTION_BASE,
  });

  useStructuredData('ld-distribution-demo', softwareApplicationSchema());

  useEffect(() => {
    track('distribution_demo_opened');
  }, []);

  return (
    <DistributionProvider>
      <DistributionRoutes />
    </DistributionProvider>
  );
}
