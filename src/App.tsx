import { lazy, Suspense } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { Privacy } from './pages/Privacy';
import { NotFound } from './pages/NotFound';
import { Router, useRouteTransition, useRouter } from './lib/router';
import { routes } from './config/site';
import { CONTRACTOR_BASE } from './demos/contractor/contractor.routes';
import { DEALER_BASE } from './demos/dealer/dealer.routes';
import { DISTRIBUTION_BASE } from './demos/distribution/distribution.routes';

/**
 * Each demo is a full application. Loading them lazily keeps them out of the
 * marketing site's bundle entirely — a visitor who never opens a demo never
 * downloads one, and opening one does not pull in the others.
 */
const ContractorApp = lazy(() => import('./demos/contractor/ContractorApp'));
const DealerApp = lazy(() => import('./demos/dealer/DealerApp'));
const DistributionApp = lazy(() => import('./demos/distribution/DistributionApp'));

function DemoLoading({ name }: { name: string }) {
  return (
    <div className="min-h-screen bg-midnight flex items-center justify-center px-6">
      <p role="status" className="text-[0.875rem] text-muted-dark">
        Loading {name}…
      </p>
    </div>
  );
}

/** True for the demo's own root and every screen below it. */
const isWithin = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

function SitePage() {
  const { pathname } = useRouter();

  switch (pathname) {
    case routes.home:
      return <Home />;
    case routes.privacy:
      return <Privacy />;
    default:
      return <NotFound />;
  }
}

function Shell() {
  const { pathname, hash } = useRouter();
  useRouteTransition(pathname, hash);

  // Demos run as standalone applications: their own shell, no marketing header
  // or footer wrapped around them.
  if (isWithin(pathname, CONTRACTOR_BASE)) {
    return (
      <Suspense fallback={<DemoLoading name="Contractor Operations" />}>
        <ContractorApp />
      </Suspense>
    );
  }

  if (isWithin(pathname, DEALER_BASE)) {
    return (
      <Suspense fallback={<DemoLoading name="Dealer Operations" />}>
        <DealerApp />
      </Suspense>
    );
  }

  if (isWithin(pathname, DISTRIBUTION_BASE)) {
    return (
      <Suspense fallback={<DemoLoading name="Distribution Operations" />}>
        <DistributionApp />
      </Suspense>
    );
  }

  return (
    <div id="top" className="min-h-screen bg-ivory text-charcoal font-sans">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:bg-ivory focus:text-midnight focus:px-4 focus:py-2 focus:rounded-[2px]"
      >
        Skip to content
      </a>

      <Header />

      <main id="main">
        <SitePage />
      </main>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Shell />
    </Router>
  );
}
