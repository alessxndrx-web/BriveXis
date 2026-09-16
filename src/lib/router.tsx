import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

/**
 * Minimal History API router.
 *
 * The site is a handful of real pages (home, privacy, and the demo pages that
 * come next), so it needs path routing but not a routing framework. Navigation
 * is captured with one delegated click listener, which means every existing
 * `<a href="/#solutions">` keeps working as written — no Link component to
 * thread through the component tree.
 */

interface RouteState {
  pathname: string;
  hash: string;
}

interface RouterValue extends RouteState {
  navigate: (to: string, options?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouterValue | null>(null);

function readLocation(): RouteState {
  return {
    // Trailing slashes are collapsed so '/privacy/' and '/privacy' are one route.
    pathname: window.location.pathname.replace(/(.)\/+$/, '$1'),
    hash: window.location.hash,
  };
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Scrolls an anchor target into view, or the top of the document if there is none. */
function scrollToTarget(hash: string) {
  const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';

  if (!hash || hash === '#') {
    window.scrollTo({ top: 0, behavior });
    return;
  }

  const target = document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!target) {
    window.scrollTo({ top: 0, behavior });
    return;
  }

  target.scrollIntoView({ behavior, block: 'start' });

  // Anchor navigation has to move focus too, or keyboard users keep tabbing
  // from wherever they were. tabindex="-1" is removed again on blur so the
  // element never becomes a permanent tab stop.
  if (!target.hasAttribute('tabindex')) {
    target.setAttribute('tabindex', '-1');
    target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
  }
  target.focus({ preventScroll: true });
}

export function Router({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<RouteState>(readLocation);

  const navigate = useCallback(
    (to: string, options?: { replace?: boolean }) => {
      const url = new URL(to, window.location.origin);
      const samePage = url.pathname.replace(/(.)\/+$/, '$1') === route.pathname;

      if (samePage && url.hash) {
        // Anchor move inside the current page: update the URL without
        // remounting the page, then scroll.
        window.history.pushState({}, '', url.pathname + url.search + url.hash);
        setRoute(readLocation());
        scrollToTarget(url.hash);
        return;
      }

      window.history[options?.replace ? 'replaceState' : 'pushState'](
        {},
        '',
        url.pathname + url.search + url.hash,
      );
      setRoute(readLocation());
    },
    [route.pathname],
  );

  // Delegated navigation: intercept same-origin left-clicks on plain links.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return; // in-page anchors: leave to the browser
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;

      event.preventDefault();
      navigate(url.pathname + url.search + url.hash);
    };

    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [navigate]);

  useEffect(() => {
    const onPopState = () => setRoute(readLocation());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return (
    <RouterContext.Provider value={{ ...route, navigate }}>{children}</RouterContext.Provider>
  );
}

export function useRouter(): RouterValue {
  const value = useContext(RouterContext);
  if (!value) throw new Error('useRouter must be used inside <Router>.');
  return value;
}

/**
 * Restores the expected browsing behaviour after a page swap: a route with a
 * hash scrolls to that section, a route without one starts at the top.
 */
export function useRouteTransition(pathname: string, hash: string) {
  useEffect(() => {
    if (hash) {
      // The freshly mounted page needs one frame before its anchors exist.
      const frame = requestAnimationFrame(() => scrollToTarget(hash));
      return () => cancelAnimationFrame(frame);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname, hash]);
}
