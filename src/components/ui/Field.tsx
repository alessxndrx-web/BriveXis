import {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

const labelStyles =
  'block text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-muted mb-2';

const controlStyles =
  'w-full bg-white-surface border rounded-[2px] px-3.5 py-3 text-[0.9375rem] text-charcoal ' +
  'placeholder:text-muted/55 transition-colors focus:outline-none focus:ring-1';

const stateStyles = (hasError: boolean) =>
  hasError
    ? 'border-danger focus:border-danger focus:ring-danger'
    : 'border-light-border focus:border-copper focus:ring-copper';

interface ShellProps {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}

function FieldShell({ id, label, optional, error, children, className = '' }: ShellProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className={labelStyles}>
        {label}
        {optional && <span className="ml-1.5 normal-case tracking-normal font-normal">(optional)</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-[0.8125rem] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  wrapperClassName?: string;
};

export function TextField({
  id,
  label,
  optional,
  error,
  wrapperClassName,
  ...inputProps
}: TextFieldProps) {
  return (
    <FieldShell id={id} label={label} optional={optional} error={error} className={wrapperClassName}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${controlStyles} ${stateStyles(Boolean(error))}`}
        {...inputProps}
      />
    </FieldShell>
  );
}

type TextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  wrapperClassName?: string;
};

export function TextAreaField({
  id,
  label,
  optional,
  error,
  wrapperClassName,
  ...textareaProps
}: TextAreaFieldProps) {
  return (
    <FieldShell id={id} label={label} optional={optional} error={error} className={wrapperClassName}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${controlStyles} ${stateStyles(Boolean(error))} resize-y min-h-[7rem]`}
        {...textareaProps}
      />
    </FieldShell>
  );
}

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  id: string;
  label: string;
  options: readonly string[];
  placeholder?: string;
  optional?: boolean;
  error?: string;
  wrapperClassName?: string;
};

export function SelectField({
  id,
  label,
  options,
  placeholder = 'Select an option',
  optional,
  error,
  wrapperClassName,
  ...selectProps
}: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} optional={optional} error={error} className={wrapperClassName}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${controlStyles} ${stateStyles(Boolean(error))} appearance-none bg-[length:0.7rem] bg-[right_1rem_center] bg-no-repeat pr-10`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5 6 6.5 11 1.5' fill='none' stroke='%236D6A66' stroke-width='1.5'/%3E%3C/svg%3E\")",
        }}
        {...selectProps}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
