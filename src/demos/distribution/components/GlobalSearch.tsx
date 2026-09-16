import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useWorkspace } from '../DistributionProvider';
import { searchWorkspace, type SearchResult } from '../distribution.reports';
import { paths } from '../distribution.routes';
import { useRouter } from '../../../lib/router';

/**
 * Global search across products, partners and every document number.
 *
 * Built on the combobox pattern: the input keeps focus while the arrow keys
 * move a virtual cursor through the listbox, so a keyboard user never has to
 * tab into the results to choose one. Ctrl/Cmd+K focuses it from anywhere.
 */

const HREFS = {
  product: paths.product,
  supplier: paths.supplier,
  customer: paths.customer,
  purchaseOrder: paths.purchaseOrder,
  order: paths.order,
  shipment: paths.shipment,
  invoice: paths.invoice,
};

export function GlobalSearch({ className = '' }: { className?: string }) {
  const state = useWorkspace();
  const { navigate } = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => searchWorkspace(state, query, HREFS), [state, query]);

  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const choose = (result: SearchResult) => {
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    navigate(result.href);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (results.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setCursor((current) => (current + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setCursor((current) => (current - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = results[cursor];
      if (target) choose(target);
    }
  };

  const listboxId = 'workspace-search-results';
  const activeId = results[cursor] ? `search-option-${results[cursor].id}` : undefined;
  const showList = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <label htmlFor="workspace-search" className="sr-only">
        Search products, partners, orders and documents
      </label>
      <div className="relative">
        <Search
          size={14}
          aria-hidden="true"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-dark pointer-events-none"
        />
        <input
          id="workspace-search"
          ref={inputRef}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? activeId : undefined}
          placeholder="Search SKU, partner, document…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full h-8 bg-dark-surface border border-dark-border rounded-[2px] pl-8 pr-2.5 text-[0.8125rem] text-white-surface placeholder:text-muted-dark/70 focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper"
        />
      </div>

      {showList && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Search results"
          className="absolute z-50 mt-1 w-full max-h-80 overflow-y-auto border border-app-border bg-app-panel rounded-[3px] shadow-lg"
        >
          {results.length === 0 ? (
            <p className="px-3 py-3 text-[0.8125rem] text-muted">
              Nothing matches &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            results.map((result, index) => (
              <button
                key={`${result.group}-${result.id}`}
                id={`search-option-${result.id}`}
                type="button"
                role="option"
                aria-selected={index === cursor}
                onMouseEnter={() => setCursor(index)}
                onClick={() => choose(result)}
                className={`flex w-full items-baseline gap-2 px-3 py-2 text-left border-b border-app-border last:border-b-0 transition-colors ${
                  index === cursor ? 'bg-app-bg' : ''
                }`}
              >
                <span className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-copper w-[5.5rem] shrink-0">
                  {result.group}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.875rem] text-charcoal truncate">{result.label}</span>
                  <span className="block text-[0.75rem] text-muted truncate">{result.meta}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
