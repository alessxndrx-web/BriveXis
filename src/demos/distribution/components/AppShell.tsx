import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  Banknote,
  Boxes,
  Building2,
  ClipboardList,
  Factory,
  FileText,
  Gauge,
  Menu,
  PackageCheck,
  PackageOpen,
  PieChart,
  Settings as SettingsIcon,
  ShoppingCart,
  Truck,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import { useRouter } from '../../../lib/router';
import { track } from '../../../lib/analytics';
import { CONTACT_ANCHOR } from '../../../config/site';
import { BriveXisLogo } from '../../../components/ui/BriveXisLogo';
import {
  DEMO_ROLES,
  MODULES,
  MODULE_GROUPS,
  ROLE_MODULES,
  paths,
  type DemoRole,
  type ModuleId,
} from '../distribution.routes';
import { useDistribution } from '../DistributionProvider';
import { Button } from '../../shared/ui/AppUI';
import { ConfirmDialog } from '../../shared/ui/Dialog';
import { GlobalSearch } from './GlobalSearch';
import { QuickCreate } from './QuickCreate';

/**
 * Application shell: sidebar, top bar and the demo-specific controls.
 *
 * It shares its structure with the other two demos — the same navigation
 * behaviour, the same demo banner, the same reset flow — because they are one
 * product family. What differs is the navigation itself, grouped the way a
 * distributor's work actually divides: what comes in, what goes out, and what
 * is on the shelf between the two.
 */

const MODULE_ICONS: Record<ModuleId, typeof Gauge> = {
  dashboard: Gauge,
  products: Boxes,
  warehouses: Building2,
  inventory: PackageOpen,
  transfers: ArrowLeftRight,
  suppliers: Factory,
  purchasing: ClipboardList,
  receiving: PackageCheck,
  customers: Users,
  orders: ShoppingCart,
  fulfillment: PackageOpen,
  shipments: Truck,
  returns: Undo2,
  invoices: FileText,
  payments: Banknote,
  reports: PieChart,
  settings: SettingsIcon,
};

interface AppShellProps {
  activeModule: ModuleId;
  children: ReactNode;
}

export function AppShell({ activeModule, children }: AppShellProps) {
  const { state, role, setRole, resetDemo, notify } = useDistribution();
  const { pathname, navigate } = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  // Navigating always dismisses the mobile panel, whether the visitor tapped a
  // link, used the back button or followed a search result.
  useEffect(() => setMobileNavOpen(false), [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileNavOpen]);

  const allowed = ROLE_MODULES[role];
  const visibleModules = MODULES.filter((module) => allowed.includes(module.id));

  const confirmReset = () => {
    resetDemo();
    setResetOpen(false);
    navigate(paths.root);
    track('distribution_demo_reset');
    notify('Demo workspace reset to its starting data.', 'success');
  };

  const navigation = (
    <nav aria-label="Workspace" className="py-2">
      {MODULE_GROUPS.map((group) => {
        const modules = visibleModules.filter((module) => module.group === group);
        if (modules.length === 0) return null;

        return (
          <div key={group} className="mb-1 last:mb-0">
            {group !== 'Overview' && (
              <h2 className="px-3 pt-3 pb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-dark/60">
                {group}
              </h2>
            )}
            <ul>
              {modules.map((module) => {
                const Icon = MODULE_ICONS[module.id];
                const active = module.id === activeModule;
                return (
                  <li key={module.id}>
                    <a
                      href={paths.module(module.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`relative flex items-center gap-2.5 px-3 py-[0.4375rem] text-[0.875rem] transition-colors ${
                        active
                          ? 'text-white-surface bg-white/[0.06] font-medium'
                          : 'text-muted-dark hover:text-white-surface hover:bg-white/[0.03]'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute left-0 top-1 bottom-1 w-[2px] ${
                          active ? 'bg-copper' : 'bg-transparent'
                        }`}
                      />
                      <Icon size={15} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
                      {module.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const sidebarFooter = (
    <div className="border-t border-dark-border px-3 py-3 space-y-3">
      <div>
        <label
          htmlFor="demo-role"
          className="block text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-dark/60 mb-1.5"
        >
          Demo role
        </label>
        <select
          id="demo-role"
          value={role}
          onChange={(event) => {
            const next = event.target.value as DemoRole;
            setRole(next);
            // A role that cannot see the current module would otherwise be left
            // staring at a screen its own menu no longer offers.
            if (!ROLE_MODULES[next].includes(activeModule)) navigate(paths.root);
          }}
          className="w-full h-8 bg-dark-surface border border-dark-border rounded-[2px] px-2 text-[0.8125rem] text-white-surface focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper"
        >
          {DEMO_ROLES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[0.6875rem] leading-snug text-muted-dark/70">
          Changes which modules are shown. Not real authentication.
        </p>
      </div>

      <a
        href={CONTACT_ANCHOR}
        onClick={() => track('distribution_demo_cta_clicked')}
        className="block border border-dark-border rounded-[2px] px-3 py-2.5 transition-colors hover:border-copper/50 hover:bg-white/[0.03]"
      >
        <span className="block text-[0.8125rem] font-medium text-white-surface">
          Build a system like this
        </span>
        <span className="mt-0.5 block text-[0.6875rem] leading-snug text-muted-dark/80">
          Talk to BriveXis about your workflow
        </span>
      </a>
    </div>
  );

  return (
    <div className="min-h-screen bg-app-bg">
      {/* ------------------------------------------------------- top bar */}
      <header
        data-print="hide"
        className="fixed top-0 inset-x-0 z-40 h-14 bg-midnight border-b border-dark-border"
      >
        <div className="flex h-full items-center gap-2 sm:gap-3 px-3 sm:px-4">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-expanded={mobileNavOpen}
            aria-controls="workspace-nav"
            aria-label="Open navigation"
            className="lg:hidden -ml-1 p-2 text-white-surface rounded-[2px]"
          >
            <Menu size={19} strokeWidth={1.75} aria-hidden="true" />
          </button>

          <a
            href={paths.root}
            className="hidden lg:flex items-center shrink-0 w-[13.5rem] -ml-1 pl-3"
            aria-label="Distribution Operations — overview"
          >
            <BriveXisLogo variant="mark" theme="dark" size={18} />
            <span className="ml-2 font-heading font-semibold text-[0.875rem] text-white-surface">
              Distribution Ops
            </span>
          </a>

          <div className="lg:hidden flex items-center min-w-0">
            <BriveXisLogo variant="mark" theme="dark" size={17} />
            <span className="ml-1.5 font-heading font-semibold text-[0.8125rem] text-white-surface truncate">
              Distribution
            </span>
          </div>

          <div className="flex-1 min-w-0 max-w-md">
            <GlobalSearch />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <QuickCreate />

            <button
              type="button"
              onClick={() => setResetOpen(true)}
              className="hidden sm:inline-flex items-center h-8 px-2.5 border border-dark-border rounded-[2px] text-[0.8125rem] text-muted-dark transition-colors hover:text-white-surface hover:border-muted-dark/50"
            >
              Reset demo
            </button>

            <a
              href="/"
              className="inline-flex items-center gap-1.5 h-8 px-2 sm:px-2.5 text-[0.8125rem] text-muted-dark transition-colors hover:text-white-surface"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              <span className="hidden md:inline">Back to BriveXis</span>
            </a>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------ desktop sidebar */}
      <aside
        data-print="hide"
        className="hidden lg:flex fixed top-14 bottom-0 left-0 w-[13.5rem] flex-col bg-midnight border-r border-dark-border overflow-y-auto"
      >
        <div className="flex-1">{navigation}</div>
        {sidebarFooter}
      </aside>

      {/* -------------------------------------------------- mobile drawer */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50" data-print="hide">
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-midnight/60 cursor-default"
          />
          <div
            id="workspace-nav"
            className="absolute inset-y-0 left-0 w-[17rem] max-w-[85vw] flex flex-col bg-midnight border-r border-dark-border overflow-y-auto"
          >
            <div className="flex items-center justify-between gap-2 h-14 px-3 border-b border-dark-border">
              <span className="flex items-center">
                <BriveXisLogo variant="mark" theme="dark" size={18} />
                <span className="ml-2 font-heading font-semibold text-[0.875rem] text-white-surface">
                  Distribution Ops
                </span>
              </span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation"
                className="-mr-1 p-2 text-white-surface"
              >
                <X size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1">{navigation}</div>
            <div className="px-3 pb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMobileNavOpen(false);
                  setResetOpen(true);
                }}
                className="w-full !text-muted-dark hover:!text-white-surface hover:!bg-white/[0.04]"
              >
                Reset demo
              </Button>
            </div>
            {sidebarFooter}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- content */}
      <div className="lg:pl-[13.5rem] pt-14">
        <DemoBanner companyName={state.settings.companyName} />
        <main id="workspace-main" className="px-3 sm:px-4 lg:px-6 py-4 lg:py-6">
          {children}
        </main>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onCancel={() => setResetOpen(false)}
        onConfirm={confirmReset}
        title="Reset the demo workspace?"
        confirmLabel="Reset demo"
        tone="danger"
        description={
          <>
            <p>
              Every change you have made in this demo — purchase orders, receipts, sales orders,
              shipments, invoices, payments, transfers and stock adjustments — will be discarded
              and the workspace restored to its original sample data.
            </p>
            <p className="mt-2 text-muted">This cannot be undone.</p>
          </>
        }
      />
    </div>
  );
}

/**
 * Standing notice that the workspace is fictional. Small and out of the way,
 * but present on every screen so nobody can mistake the data for a real client.
 */
function DemoBanner({ companyName }: { companyName: string }) {
  return (
    <div
      data-print="hide"
      className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-app-border bg-copper/[0.06] px-3 sm:px-4 lg:px-6 py-1.5"
    >
      <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-copper">
        <span aria-hidden="true" className="w-1.5 h-1.5 bg-copper" />
        Demo workspace
      </span>
      <span className="text-[0.75rem] text-muted">
        {companyName} is a fictional distributor. All company, supplier, customer and transaction
        data shown here is fictional.
      </span>
    </div>
  );
}
