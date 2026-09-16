import { useEffect } from 'react';
import { useRouter } from '../../lib/router';
import { track } from '../../lib/analytics';
import { SITE_URL } from '../../config/site';
import { useDocumentMeta, useStructuredData } from '../../lib/seo';
import { ContractorProvider, useContractor } from './ContractorProvider';
import { CONTRACTOR_BASE, parseContractorRoute, paths } from './contractor.routes';
import { ROLE_MODULES } from './contractor.selectors';
import { AppShell } from './components/AppShell';
import { Toasts } from './components/Toasts';
import { GuidedTour } from './components/GuidedTour';
import { EmptyState, LinkButton } from './components/AppUI';
import { Dashboard } from './pages/Dashboard';
import { LeadDetail, LeadsPage } from './pages/Leads';
import { CustomerDetail, CustomersPage } from './pages/Customers';
import { EstimateDetail, EstimatesPage } from './pages/Estimates';
import { EstimateEditor } from './pages/EstimateEditor';
import { JobDetail, JobsPage } from './pages/Jobs';
import { SchedulePage } from './pages/Schedule';
import { CrewDetail, CrewsPage } from './pages/Crews';
import { InvoiceDetail, InvoiceEditor, InvoicesPage } from './pages/Invoices';
import { PaymentsPage } from './pages/Payments';
import { ReportsPage } from './pages/Reports';
import { SettingsPage } from './pages/Settings';
import { EstimatePrint, InvoicePrint } from './pages/PrintDocument';

/**
 * Contractor Operations — application root.
 *
 * Lazy-loaded by the site router, so none of this reaches the marketing home
 * page's bundle. It parses the part of the URL below `/demos/contractor-
 * operations` itself, which keeps every screen deep-linkable and makes browser
 * back and forward work without any extra handling.
 */

function softwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Contractor Operations',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web browser',
    url: `${SITE_URL}${CONTRACTOR_BASE}`,
    description:
      'An interactive demonstration of a contractor operations platform covering leads, estimates, jobs, scheduling, crews, field records, invoicing and payments.',
    inLanguage: 'en-US',
    isAccessibleForFree: true,
    provider: { '@id': `${SITE_URL}/#organization` },
  };
}

/** Resolves the current URL to a screen. */
function ContractorRoutes() {
  const { pathname } = useRouter();
  const { role, recoveryNotice, clearRecoveryNotice, notify } = useContractor();

  const route = parseContractorRoute(pathname);

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
  if (route.module === 'estimates' && route.recordId && route.view === 'print') {
    return <EstimatePrint estimateId={route.recordId} />;
  }
  if (route.module === 'invoices' && route.recordId && route.view === 'print') {
    return <InvoicePrint invoiceId={route.recordId} />;
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
          description={`The ${role} role does not include this module. Switch the demo role in the sidebar to see it.`}
          action={<LinkButton href={paths.root}>Back to overview</LinkButton>}
        />
      ) : (
        <Screen route={route} />
      )}
      <Toasts />
    </AppShell>
  );
}

function Screen({ route }: { route: ReturnType<typeof parseContractorRoute> }) {
  const { module, recordId, view } = route;

  switch (module) {
    case 'dashboard':
      return (
        <div className="space-y-4">
          <GuidedTour />
          <Dashboard />
        </div>
      );

    case 'leads':
      return recordId ? <LeadDetail leadId={recordId} /> : <LeadsPage />;

    case 'customers':
      return recordId ? <CustomerDetail customerId={recordId} /> : <CustomersPage />;

    case 'estimates':
      if (view === 'new') return <EstimateEditor />;
      if (recordId && view === 'edit') return <EstimateEditor estimateId={recordId} />;
      return recordId ? <EstimateDetail estimateId={recordId} /> : <EstimatesPage />;

    case 'jobs':
      return recordId ? <JobDetail jobId={recordId} /> : <JobsPage />;

    case 'schedule':
      return <SchedulePage />;

    case 'crews':
      return recordId ? <CrewDetail crewId={recordId} /> : <CrewsPage />;

    case 'invoices':
      if (recordId && view === 'edit') return <InvoiceEditor invoiceId={recordId} />;
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

export default function ContractorApp() {
  useDocumentMeta({
    title: 'Contractor Operations Demo | BriveXis',
    description:
      'An interactive demonstration of contractor operations software: leads, estimates, jobs, scheduling, crews, field records, invoicing and payments in one connected system.',
    path: CONTRACTOR_BASE,
  });

  useStructuredData('ld-contractor-demo', softwareApplicationSchema());

  useEffect(() => {
    track('contractor_demo_opened');
  }, []);

  return (
    <ContractorProvider>
      <ContractorRoutes />
    </ContractorProvider>
  );
}
