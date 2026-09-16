import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useWorkspace } from '../ContractorProvider';
import { searchWorkspace, type SearchResult } from '../contractor.selectors';
import { CONTRACTOR_BASE } from '../contractor.routes';
import { useRouter } from '../../../lib/router';

/**
 * Global search across leads, customers, estimates, jobs and invoices.
 *
 * Built on the combobox pattern: the input owns focus while arrow keys move a
 * virtual cursor through the listbox, so a keyboard user never has to tab into
 * the results to pick one. Ctrl/Cmd+K focuses it from anywhere in the app.
 */

const KIND_LABELS: Record<SearchResult['kind'], string> = {
  lead: 'Lead',
  customer: 'Customer',
  estimate: 'Estimate',
  job: 'Job',
  invoice: 'Invoice',
};

export function GlobalSearch({ className = '' }: { className?: string }) {
  const state = useWorkspace();
  const { navigate } = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => searchWorkspace(state, query, CONTRACTOR_BASE),
    [state, query],
  );

  useEffect(() => setCursor(0), [query]);

  // Ctrl/Cmd+K is the shortcut people already expect for search.
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

  // Clicking anywhere else dismisses the list without clearing the query.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const go = (result: SearchResult) => {
    navigate(result.href);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const showList = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <label htmlFor="workspace-search" className="sr-only">
        Search leads, customers, estimates, jobs and invoices
      </label>
      <div className="relative">
        <Search
          size={14}
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          ref={inputRef}
          id="workspace-search"
          type="search"
          role="combobox"
          autoComplete="off"
          aria-expanded={showList}
          aria-controls="workspace-search-results"
          aria-activedescendant={
            showList && results[cursor] ? `search-result-${results[cursor].id}` : undefined
          }
          placeholder="Search records…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              return;
            }
            if (!showList || results.length === 0) return;

            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setCursor((current) => (current + 1) % results.length);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setCursor((current) => (current - 1 + results.length) % results.length);
            } else if (event.key === 'Enter') {
              event.preventDefault();
              go(results[cursor]);
            }
          }}
          className="h-8 w-full bg-dark-surface border border-dark-border rounded-[2px] pl-8 pr-3 text-[0.8125rem] text-white-surface placeholder:text-muted-dark/70 transition-colors focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper [&::-webkit-search-cancel-button]:appearance-none"
        />
      </div>

      {showList && (
        <div
          id="workspace-search-results"
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 sm:right-auto sm:min-w-[24rem] top-full mt-1 z-40 max-h-[24rem] overflow-y-auto bg-app-panel border border-app-border-strong rounded-[3px] shadow-xl"
        >
          {results.length === 0 ? (
            <p className="px-3 py-3 text-[0.8125rem] text-muted">
              No records match &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            results.map((result, index) => (
              <div
                key={`${result.kind}-${result.id}`}
                id={`search-result-${result.id}`}
                role="option"
                aria-selected={index === cursor}
                onMouseEnter={() => setCursor(index)}
                onMouseDown={(event) => {
                  // Fires before the input's blur, so the click is not lost.
                  event.preventDefault();
                  go(result);
                }}
                className={`flex items-baseline gap-2.5 px-3 py-2 cursor-pointer border-b border-app-border/60 last:border-b-0 ${
                  index === cursor ? 'bg-app-hover' : ''
                }`}
              >
                <span className="w-16 shrink-0 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                  {KIND_LABELS[result.kind]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.875rem] text-charcoal truncate">
                    {result.title}
                  </span>
                  <span className="block text-[0.75rem] text-muted truncate">
                    {result.subtitle}
                  </span>
                </span>
                <span className="shrink-0 text-[0.75rem] tabular-nums text-muted">
                  {result.code}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
