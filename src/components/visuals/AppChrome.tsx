import { ReactNode } from 'react';

export interface AppModule {
  label: string;
  active?: boolean;
}

interface AppChromeProps {
  /** Name shown in the application title bar. */
  appName: string;
  modules: AppModule[];
  tone?: 'dark' | 'light';
  children: ReactNode;
  /** Optional status bar content rendered at the bottom of the frame. */
  status?: ReactNode;
  className?: string;
}

const toneStyles = {
  dark: {
    frame: 'border-dark-border bg-[#0D1015]',
    bar: 'bg-dark-surface border-dark-border',
    barText: 'text-muted-dark',
    sidebar: 'border-dark-border bg-[#0A0D12]',
    module: 'text-muted-dark',
    moduleActive: 'text-white-surface bg-white/[0.05]',
    chip: 'border-dark-border',
    status: 'border-dark-border text-muted-dark',
  },
  light: {
    frame: 'border-light-border bg-white-surface',
    bar: 'bg-ivory border-light-border',
    barText: 'text-muted',
    sidebar: 'border-light-border bg-ivory',
    module: 'text-muted',
    moduleActive: 'text-charcoal bg-white-surface',
    chip: 'border-light-border',
    status: 'border-light-border text-muted',
  },
} as const;

/**
 * Application shell used by the product visuals: title bar, module navigation
 * and a content slot. Structural only — it never renders business data.
 */
export function AppChrome({
  appName,
  modules,
  tone = 'dark',
  children,
  status,
  className = '',
}: AppChromeProps) {
  const s = toneStyles[tone];

  return (
    <div
      aria-hidden="true"
      className={`rounded-[10px] border overflow-hidden transition-colors duration-300 ${s.frame} ${className}`}
    >
      {/* Title bar */}
      <div className={`flex items-center gap-3 border-b px-4 py-3 ${s.bar}`}>
        <span className="flex gap-[3px]" aria-hidden="true">
          <span className="w-[10px] h-[3px] rounded-[1px] bg-copper" />
          <span className={`w-[10px] h-[3px] rounded-[1px] ${tone === 'dark' ? 'bg-dark-border' : 'bg-light-border'}`} />
          <span className={`w-[10px] h-[3px] rounded-[1px] ${tone === 'dark' ? 'bg-dark-border' : 'bg-light-border'}`} />
        </span>
        <span className={`text-ui font-medium tracking-wide ${s.barText}`}>{appName}</span>
        <span
          className={`ml-auto flex items-center h-5 w-16 rounded-[2px] border px-1.5 ${s.chip}`}
        >
          <span
            className={`h-[3px] w-7 rounded-[1px] ${
              tone === 'dark' ? 'bg-dark-border' : 'bg-light-border'
            }`}
          />
        </span>
      </div>

      {/* Mobile module rail */}
      <div className={`sm:hidden flex gap-2 overflow-hidden border-b px-4 py-2.5 ${s.bar}`}>
        {modules.slice(0, 3).map((module) => (
          <span
            key={module.label}
            className={`text-ui whitespace-nowrap rounded-[2px] px-2 py-1 transition-colors duration-300 ${
              module.active ? s.moduleActive : s.module
            }`}
          >
            {module.label}
          </span>
        ))}
      </div>

      <div className="flex">
        {/* Module navigation */}
        <div className={`hidden sm:block w-[8.5rem] lg:w-[9.5rem] shrink-0 border-r py-3 ${s.sidebar}`}>
          {modules.map((module) => (
            <div
              key={module.label}
              className={`relative flex items-center px-4 py-[0.4375rem] text-ui transition-colors duration-300 ${
                module.active ? s.moduleActive : s.module
              }`}
            >
              <span
                className={`absolute left-0 top-1 bottom-1 w-[2px] bg-copper transition-opacity duration-300 ${
                  module.active ? 'opacity-100' : 'opacity-0'
                }`}
              />
              {module.label}
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1">{children}</div>
      </div>

      {status && (
        <div className={`border-t px-4 py-2.5 text-ui ${s.status}`}>{status}</div>
      )}
    </div>
  );
}
