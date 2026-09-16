import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { Container } from './ui/Container';
import { Button } from './ui/Button';
import { BriveXisLogo } from './ui/BriveXisLogo';
import { DURATION, EASE } from '../lib/motion';
import { CONTACT_ANCHOR, primaryNav, routes } from '../config/site';
import { useRouter } from '../lib/router';
import { track } from '../lib/analytics';

/** Tailwind's `lg` breakpoint, where the mobile panel is replaced by the nav bar. */
const DESKTOP_QUERY = '(min-width: 1024px)';

const sectionId = (href: string) => href.split('#')[1] ?? '';

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const { pathname } = useRouter();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Active section: one observer for every nav target, no per-element scroll
  // handlers. Re-runs per route because the header outlives the page swap, and
  // the sections it observes only exist on the home page.
  useEffect(() => {
    const sections = primaryNav
      .map((link) => document.getElementById(sectionId(link.href)))
      .filter((section): section is HTMLElement => section !== null);

    if (sections.length === 0) {
      setActiveId(null);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length === 0) return;
        const topmost = visible.reduce((closest, entry) =>
          entry.boundingClientRect.top < closest.boundingClientRect.top ? entry : closest,
        );
        setActiveId(topmost.target.id);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      // Escape must hand focus back to the control that opened the panel,
      // otherwise keyboard users land on a detached document position.
      menuButtonRef.current?.focus();
    };

    // The panel overlays the page, so the page behind it must not scroll.
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Resizing up to the desktop layout hides the panel; leaving it "open"
    // would keep the page locked with no visible way to release it.
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const handleBreakpoint = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuOpen(false);
    };

    window.addEventListener('keydown', handleKey);
    desktop.addEventListener('change', handleBreakpoint);

    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', handleKey);
      desktop.removeEventListener('change', handleBreakpoint);
    };
  }, [menuOpen]);

  useEffect(() => setMenuOpen(false), [pathname]);

  const condensed = isScrolled || menuOpen;

  const panelMotion = reduceMotion
    ? { initial: false as const, animate: {}, exit: {} }
    : {
        initial: { opacity: 0, height: 0 },
        animate: { opacity: 1, height: 'auto' },
        exit: { opacity: 0, height: 0 },
      };

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 border-b transition-[background-color,border-color,padding,backdrop-filter] duration-300 ${
        condensed
          ? 'bg-midnight/85 backdrop-blur-md border-dark-border py-3.5'
          : 'bg-transparent border-transparent py-5'
      }`}
    >
      <Container>
        <div className="relative z-20 flex items-center justify-between gap-6">
          <a
            href={routes.home}
            className="rounded-[2px] transition-opacity duration-200 hover:opacity-85"
            aria-label="BriveXis — home"
          >
            <BriveXisLogo variant="full" theme="dark" size={21} />
          </a>

          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-7">
              {primaryNav.map((link) => {
                const isActive = activeId === sectionId(link.href);
                return (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      aria-current={isActive ? 'location' : undefined}
                      className={`group relative block py-1 text-[0.9375rem] font-medium transition-colors duration-200 ${
                        isActive ? 'text-white-surface' : 'text-muted-dark hover:text-white-surface'
                      }`}
                    >
                      {link.name}
                      <span
                        aria-hidden="true"
                        className={`absolute -bottom-0.5 inset-x-0 h-px bg-copper origin-left transition-transform duration-300 ${
                          isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                        }`}
                      />
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="hidden lg:block">
            <Button
              href={CONTACT_ANCHOR}
              variant="solid-invert"
              size="sm"
              onClick={() => track('cta_header_click')}
            >
              Discuss Your Project
            </Button>
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            className="lg:hidden -mr-2 p-2 text-white-surface rounded-[2px]"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={22} strokeWidth={1.75} /> : <Menu size={22} strokeWidth={1.75} />}
          </button>
        </div>
      </Container>

      <AnimatePresence initial={false}>
        {menuOpen && (
          <motion.button
            key="menu-scrim"
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setMenuOpen(false)}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? {} : { opacity: 0 }}
            transition={{ duration: DURATION.fast }}
            className="lg:hidden fixed inset-0 z-0 cursor-default bg-midnight/60"
          />
        )}
        {menuOpen && (
          <motion.div
            key="mobile-navigation"
            id="mobile-navigation"
            {...panelMotion}
            transition={{ duration: DURATION.medium, ease: EASE }}
            className="lg:hidden absolute inset-x-0 top-full z-20 overflow-hidden bg-dark-surface border-b border-dark-border"
          >
            <Container>
              <nav aria-label="Primary mobile">
                <ul className="py-2">
                  {primaryNav.map((link) => (
                    <li key={link.name}>
                      <a
                        href={link.href}
                        onClick={() => setMenuOpen(false)}
                        aria-current={activeId === sectionId(link.href) ? 'location' : undefined}
                        className="flex items-center gap-3 border-b border-dark-border/70 py-3.5 text-[0.9375rem] font-medium text-white-surface"
                      >
                        <span
                          aria-hidden="true"
                          className={`w-1 h-1 ${
                            activeId === sectionId(link.href) ? 'bg-copper' : 'bg-transparent'
                          }`}
                        />
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="py-4">
                <Button
                  href={CONTACT_ANCHOR}
                  variant="solid-invert"
                  fullWidth
                  onClick={() => {
                    track('cta_header_click');
                    setMenuOpen(false);
                  }}
                >
                  Discuss Your Project
                </Button>
              </div>
            </Container>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
