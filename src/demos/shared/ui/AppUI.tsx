import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useId,
} from 'react';

/**
 * Application UI primitives.
 *
 * Deliberately denser than the marketing site's components: 32px controls,
 * hairline borders, square corners, small type. This is software an operations
 * coordinator keeps open all day, so the priority is scanning and fitting
 * information on screen, not presentation.
 */

// ------------------------------------------------------------------ buttons

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const buttonBase =
  'inline-flex items-center justify-center gap-1.5 font-medium rounded-[2px] border ' +
  'transition-colors duration-150 whitespace-nowrap disabled:opacity-50 ' +
  'disabled:cursor-not-allowed disabled:pointer-events-none';

const buttonVariants: Record<Variant, string> = {
  primary: 'bg-charcoal text-white border-charcoal hover:bg-midnight hover:border-midnight',
  secondary:
    'bg-app-panel text-charcoal border-app-border-strong hover:bg-app-hover hover:border-muted/50',
  ghost: 'bg-transparent text-muted border-transparent hover:bg-app-hover hover:text-charcoal',
  danger: 'bg-app-panel text-danger border-danger/40 hover:bg-danger/[0.06] hover:border-danger',
};

const buttonSizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[0.8125rem]',
  md: 'h-9 px-3.5 text-[0.875rem]',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={rest.type ?? 'button'}
      className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

interface LinkButtonProps {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  'aria-label'?: string;
}

/** Navigation that looks like a button. Stays an anchor so it can be opened in a new tab. */
export function LinkButton({
  href,
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <a
      href={href}
      className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </a>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

/** Icon-only control. The label is required — it becomes the accessible name. */
export function IconButton({ label, className = '', children, ...rest }: IconButtonProps) {
  return (
    <button
      type={rest.type ?? 'button'}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-[2px] border border-transparent text-muted transition-colors hover:bg-app-hover hover:text-charcoal disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------------- panels

interface PanelProps {
  children: ReactNode;
  className?: string;
}

export function Panel({ children, className = '' }: PanelProps) {
  return (
    <section className={`bg-app-panel border border-app-border rounded-[3px] ${className}`}>
      {children}
    </section>
  );
}

interface PanelHeaderProps {
  title: ReactNode;
  /** Rendered small and muted next to the title. */
  meta?: ReactNode;
  actions?: ReactNode;
  /** Heading level, so panels inside a page keep the document outline correct. */
  as?: 'h2' | 'h3';
  id?: string;
}

export function PanelHeader({ title, meta, actions, as: Tag = 'h2', id }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-app-border px-4 py-2.5">
      <div className="flex items-baseline gap-2.5 min-w-0">
        <Tag id={id} className="font-heading font-semibold text-[0.9375rem] text-charcoal truncate">
          {title}
        </Tag>
        {meta && <span className="text-[0.75rem] text-muted whitespace-nowrap">{meta}</span>}
      </div>
      {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
    </div>
  );
}

/** Small uppercase label used above dense groups of information. */
export function FieldLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`block text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted ${className}`}
    >
      {children}
    </span>
  );
}

interface DetailProps {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Label-over-value pair, the workhorse of every detail screen. */
export function Detail({ label, children, className = '' }: DetailProps) {
  return (
    <div className={className}>
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-1 text-[0.875rem] text-charcoal break-words">{children}</div>
    </div>
  );
}

// ------------------------------------------------------------------ badges

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'active';

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'border-app-border-strong bg-app-hover text-muted',
  info: 'border-info/35 bg-info/[0.08] text-info',
  success: 'border-success/35 bg-success/[0.08] text-success',
  warning: 'border-warning/35 bg-warning/[0.08] text-warning',
  danger: 'border-danger/35 bg-danger/[0.07] text-danger',
  active: 'border-copper/40 bg-copper/[0.08] text-copper',
};

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

/**
 * Status pill. Tone is a reinforcement, never the message — the label always
 * spells the status out, so the badge still reads correctly in monochrome or
 * to anyone who cannot distinguish the hues.
 */
export function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border rounded-[2px] px-1.5 py-0.5 text-[0.75rem] font-medium leading-5 whitespace-nowrap ${badgeTones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

// ------------------------------------------------------------------- forms

const controlBase =
  'w-full bg-app-panel border rounded-[2px] text-[0.875rem] text-charcoal ' +
  'placeholder:text-muted/50 transition-colors focus:outline-none focus:ring-1 ' +
  'disabled:bg-app-hover disabled:text-muted';

const controlState = (invalid?: boolean) =>
  invalid
    ? 'border-danger focus:border-danger focus:ring-danger'
    : 'border-app-border-strong focus:border-copper focus:ring-copper';

interface FormFieldProps {
  label: ReactNode;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  optional,
  children,
  className = '',
}: FormFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block mb-1">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted">
          {label}
        </span>
        {optional && (
          <span className="ml-1.5 text-[0.6875rem] text-muted/70 normal-case tracking-normal">
            optional
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[0.75rem] text-muted">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1 text-[0.75rem] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  invalid?: boolean;
};

export function TextInput({ id, invalid, className = '', ...rest }: TextInputProps) {
  return (
    <input
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-error` : undefined}
      className={`${controlBase} ${controlState(invalid)} h-9 px-2.5 ${className}`}
      {...rest}
    />
  );
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  invalid?: boolean;
};

export function TextArea({ id, invalid, className = '', ...rest }: TextAreaProps) {
  return (
    <textarea
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-error` : undefined}
      className={`${controlBase} ${controlState(invalid)} px-2.5 py-2 resize-y ${className}`}
      {...rest}
    />
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  invalid?: boolean;
  children: ReactNode;
};

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5 6 6.5 11 1.5' fill='none' stroke='%236D6A66' stroke-width='1.5'/%3E%3C/svg%3E\")";

export function Select({ id, invalid, className = '', children, ...rest }: SelectProps) {
  return (
    <select
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-error` : undefined}
      className={`${controlBase} ${controlState(invalid)} h-9 pl-2.5 pr-8 appearance-none bg-[length:0.6rem] bg-[right_0.65rem_center] bg-no-repeat ${className}`}
      style={{ backgroundImage: CHEVRON }}
      {...rest}
    >
      {children}
    </select>
  );
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
}

export function Checkbox({ label, className = '', ...rest }: CheckboxProps) {
  const generated = useId();
  const id = rest.id ?? generated;
  return (
    <label htmlFor={id} className={`flex items-start gap-2.5 cursor-pointer ${className}`}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 w-4 h-4 shrink-0 accent-[#B96E3B] cursor-pointer"
        {...rest}
      />
      <span className="text-[0.875rem] text-charcoal leading-5">{label}</span>
    </label>
  );
}

// ------------------------------------------------------------- empty state

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`px-4 py-12 text-center ${className}`}>
      <p className="font-heading font-semibold text-[0.9375rem] text-charcoal">{title}</p>
      {description && (
        <p className="mt-1.5 text-[0.875rem] text-muted max-w-[44ch] mx-auto">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

// ----------------------------------------------------------------- metrics

interface MetricProps {
  label: string;
  value: ReactNode;
  /** Secondary line, e.g. a related money figure. */
  meta?: ReactNode;
  href?: string;
  /** Draws attention without inventing a trend claim. */
  tone?: 'default' | 'warning' | 'danger';
}

const metricTone = {
  default: 'text-charcoal',
  warning: 'text-warning',
  danger: 'text-danger',
};

export function Metric({ label, value, meta, href, tone = 'default' }: MetricProps) {
  const body = (
    <>
      <FieldLabel>{label}</FieldLabel>
      <p
        className={`mt-2 font-heading font-semibold text-[1.625rem] leading-none tabular-nums ${metricTone[tone]}`}
      >
        {value}
      </p>
      {meta && <p className="mt-1.5 text-[0.75rem] text-muted">{meta}</p>}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className="block bg-app-panel border border-app-border rounded-[3px] p-3.5 transition-colors hover:border-app-border-strong hover:bg-app-hover"
      >
        {body}
      </a>
    );
  }

  return <div className="bg-app-panel border border-app-border rounded-[3px] p-3.5">{body}</div>;
}

// ---------------------------------------------------------------- progress

interface ProgressBarProps {
  /** 0-100. Values above 100 are clamped but still reported in the label. */
  value: number;
  label?: string;
  tone?: 'copper' | 'success' | 'warning' | 'danger';
}

const progressTone = {
  copper: 'bg-copper',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export function ProgressBar({ value, label, tone = 'copper' }: ProgressBarProps) {
  const width = Math.min(100, Math.max(0, value));
  return (
    <div
      role="meter"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-1.5 w-full bg-app-border rounded-[1px] overflow-hidden"
    >
      <div
        className={`h-full ${progressTone[tone]} transition-[width] duration-300`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

// -------------------------------------------------------------------- tabs

export interface TabDefinition {
  id: string;
  label: string;
  /** Optional count shown after the label. */
  count?: number;
}

interface TabsProps {
  tabs: TabDefinition[];
  active: string;
  onChange: (id: string) => void;
  label: string;
}

/**
 * Tab list with roving focus, per the WAI-ARIA tabs pattern: arrows move
 * between tabs, Home and End jump to the ends, and only the active tab is a
 * tab stop.
 */
export function Tabs({ tabs, active, onChange, label }: TabsProps) {
  const move = (delta: number) => {
    const index = tabs.findIndex((tab) => tab.id === active);
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    onChange(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className="flex items-center gap-0.5 overflow-x-auto">
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
              if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
              if (event.key === 'Home') { event.preventDefault(); onChange(tabs[0].id); }
              if (event.key === 'End') { event.preventDefault(); onChange(tabs[tabs.length - 1].id); }
            }}
            className={`relative shrink-0 px-3 py-2 text-[0.875rem] font-medium transition-colors ${
              selected ? 'text-charcoal' : 'text-muted hover:text-charcoal'
            }`}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span className="ml-1.5 text-[0.75rem] text-muted tabular-nums">{tab.count}</span>
            )}
            <span
              aria-hidden="true"
              className={`absolute inset-x-1 -bottom-px h-[2px] ${selected ? 'bg-copper' : 'bg-transparent'}`}
            />
          </button>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------- toolbar

/** Filter/search row above a table. Wraps on narrow screens instead of scrolling. */
export function Toolbar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 border-b border-app-border px-3 py-2.5 ${className}`}
    >
      {children}
    </div>
  );
}

/** Compact labelled control for the toolbar, where a stacked label wastes height. */
export function InlineField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={htmlFor} className="text-[0.75rem] text-muted whitespace-nowrap">
        {label}
      </label>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ layout

/** Standard page heading with optional breadcrumb and actions. */
interface PageHeaderProps {
  title: ReactNode;
  /** Small line above the title, usually a record code or parent link. */
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-x-6 gap-y-3 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[0.75rem] text-muted">{eyebrow}</div>}
        <h1 className="font-heading font-semibold text-[1.25rem] sm:text-[1.375rem] text-charcoal tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-[0.875rem] text-muted max-w-[70ch]">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Horizontal rule used between dense blocks. */
export function Divider({ className = '' }: { className?: string }) {
  return <hr className={`border-0 border-t border-app-border ${className}`} />;
}
