import { useEffect } from 'react';
import { useRouter } from '../../lib/router';
import { track } from '../../lib/analytics';
import { SITE_URL } from '../../config/site';
import { useDocumentMeta, useStructuredData } from '../../lib/seo';
import { DealerProvider, useDealer } from './DealerProvider';
import { DEALER_BASE, parseDealerRoute, paths } from './dealer.routes';
import { ROLE_MODULES } from './dealer.selectors';
import { AppShell } from './components/AppShell';
import { Toasts } from './components/Toasts';
import { EmptyState, LinkButton } from '../shared/ui/AppUI';
import { Dashboard } from './pages/Dashboard';
import { LeadDetail, LeadsPage } from './pages/Leads';
import { CustomerDetail, CustomersPage } from './pages/Customers';
import { InventoryPage, VehicleDetail } from './pages/Inventory';
import { ReservationDetail, ReservationsPage } from './pages/Reservations';
import { DealDetail, DealsPage } from './pages/Deals';
import { FinancingDetail, FinancingPage } from './pages/Financing';
import { DocumentsPage, PaymentsPage, TasksPage } from './pages/Workspace';
import { ReportsPage } from './pages/Reports';
import { SettingsPage } from './pages/Settings';
import { DealPrint, PaymentPrint, ReservationPrint } from './pages/PrintDocument';

/**
 * Dealer Operations — application root.
 *
 * Lazy-loaded by the site router, so none of this reaches the marketing home
 * page's bundle. It parses the part of the URL below `/demos/dealer-operations`
 * itself, which keeps every screen deep-linkable and makes browser back and
 * forward work without any extra handling.
 */

function softwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Dealer Operations',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web browser',
    url: `${SITE_URL}${DEALER_BASE}`,
    description:
      'An interactive demonstration of a dealership operations platform covering vehicle inventory, leads, reservations, deals, a financing application workflow, payments, documents and delivery.',
    inLanguage: 'en-US',
    isAccessibleForFree: true,
    provider: { '@id': `${SITE_URL}/#organization` },
  };
}

function DealerRoutes() {
  const { pathname } = useRouter();
  const { role, recoveryNotice, clearRecoveryNotice, notify } = useDealer();

  const route = parseDealerRoute(pathname);

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
    if (route.module === 'reservations') return <ReservationPrint reservationId={route.recordId} />;
    if (route.module === 'deals') return <DealPrint dealId={route.recordId} />;
    if (route.module === 'payments') return <PaymentPrint paymentId={route.recordId} />;
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

function Screen({ route }: { route: ReturnType<typeof parseDealerRoute> }) {
  const { module, recordId } = route;

  switch (module) {
    case 'dashboard':
      return <Dashboard />;

    case 'leads':
      return recordId ? <LeadDetail leadId={recordId} /> : <LeadsPage />;

    case 'customers':
      return recordId ? <CustomerDetail customerId={recordId} /> : <CustomersPage />;

    case 'inventory':
      return recordId ? <VehicleDetail vehicleId={recordId} /> : <InventoryPage />;

    case 'reservations':
      return recordId ? <ReservationDetail reservationId={recordId} /> : <ReservationsPage />;

    case 'deals':
      return recordId ? <DealDetail dealId={recordId} /> : <DealsPage />;

    case 'financing':
      return recordId ? <FinancingDetail applicationId={recordId} /> : <FinancingPage />;

    case 'payments':
      return <PaymentsPage />;

    case 'documents':
      return <DocumentsPage />;

    case 'tasks':
      return <TasksPage />;

    case 'reports':
      return <ReportsPage />;

    case 'settings':
      return <SettingsPage />;

    default:
      return <Dashboard />;
  }
}

export default function DealerApp() {
  useDocumentMeta({
    title: 'Dealer Operations Demo | BriveXis',
    description:
      'An interactive demonstration of dealership operations software: vehicle inventory, leads, reservations, deals, a financing application workflow, payments, documents and delivery in one connected system.',
    path: DEALER_BASE,
  });

  useStructuredData('ld-dealer-demo', softwareApplicationSchema());

  useEffect(() => {
    track('dealer_demo_opened');
  }, []);

  return (
    <DealerProvider>
      <DealerRoutes />
    </DealerProvider>
  );
}
