import { useCallback, useEffect, useState } from 'react';
import type { Address } from '../types';
import { FormField, TextInput } from './AppUI';

/**
 * Shared form plumbing.
 *
 * Validation runs on submit rather than on every keystroke: a field that turns
 * red while someone is still typing into it is noise. Errors clear as soon as
 * the offending field changes, so a correction is acknowledged immediately.
 */

export type Errors<T> = Partial<Record<keyof T, string>>;

export interface FormController<T> {
  values: T;
  errors: Errors<T>;
  /** True once any field has changed — used for unsaved-changes prompts. */
  dirty: boolean;
  set: <K extends keyof T>(key: K, value: T[K]) => void;
  patch: (values: Partial<T>) => void;
  reset: (values: T) => void;
  /** Runs the validator; returns true and clears errors when the form is valid. */
  validate: (validator: (values: T) => Errors<T>) => boolean;
  setErrors: (errors: Errors<T>) => void;
}

export function useForm<T extends object>(initial: T): FormController<T> {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Errors<T>>({});
  const [dirty, setDirty] = useState(false);

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setDirty(true);
  }, []);

  const patch = useCallback((next: Partial<T>) => {
    setValues((current) => ({ ...current, ...next }));
    setDirty(true);
  }, []);

  const reset = useCallback((next: T) => {
    setValues(next);
    setErrors({});
    setDirty(false);
  }, []);

  const validate = useCallback(
    (validator: (input: T) => Errors<T>) => {
      const found = validator(values);
      setErrors(found);
      const keys = Object.keys(found).filter(
        (key) => found[key as keyof T] !== undefined,
      );
      if (keys.length > 0) {
        // Put the visitor on the first problem rather than making them hunt.
        document.getElementById(String(keys[0]))?.focus();
        return false;
      }
      return true;
    },
    [values],
  );

  return { values, errors, dirty, set, patch, reset, validate, setErrors };
}

// ----------------------------------------------------------------- checks

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Ten digits, however the visitor chooses to punctuate them. */
const PHONE = /^\D*(\d\D*){10}$/;
const ZIP = /^\d{5}(-\d{4})?$/;

export const required = (value: string, label: string) =>
  value.trim() ? undefined : `${label} is required.`;

export const validEmail = (value: string) =>
  !value.trim() ? undefined : EMAIL.test(value.trim()) ? undefined : 'Enter a valid email address.';

export const validPhone = (value: string) =>
  !value.trim() ? undefined : PHONE.test(value.trim()) ? undefined : 'Enter a 10-digit phone number.';

export const validZip = (value: string) =>
  !value.trim() ? undefined : ZIP.test(value.trim()) ? undefined : 'Enter a 5-digit ZIP code.';

/** Rejects blanks, non-numbers and negatives in one place. */
export function validAmount(value: string, label = 'Amount'): string | undefined {
  if (!value.trim()) return `${label} is required.`;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `${label} must be a number.`;
  if (numeric < 0) return `${label} cannot be negative.`;
  return undefined;
}

export function validPositiveAmount(value: string, label = 'Amount'): string | undefined {
  const base = validAmount(value, label);
  if (base) return base;
  if (Number(value) <= 0) return `${label} must be greater than zero.`;
  return undefined;
}

/** Blank address. Demos that operate in one state pass it to `emptyAddressIn`. */
export const emptyAddress: Address = { line1: '', line2: '', city: '', state: '', zip: '' };

export const emptyAddressIn = (state: string): Address => ({ ...emptyAddress, state });

export function validateAddress(address: Address, prefix: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!address.line1.trim()) errors[`${prefix}-line1`] = 'Street address is required.';
  if (!address.city.trim()) errors[`${prefix}-city`] = 'City is required.';
  if (!address.state.trim()) errors[`${prefix}-state`] = 'State is required.';
  const zip = validZip(address.zip);
  if (!address.zip.trim()) errors[`${prefix}-zip`] = 'ZIP code is required.';
  else if (zip) errors[`${prefix}-zip`] = zip;
  return errors;
}

// ------------------------------------------------------------ address form

interface AddressFieldsProps {
  /** Prefix for the generated control ids, so several addresses can coexist. */
  prefix: string;
  legend: string;
  value: Address;
  onChange: (address: Address) => void;
  errors?: Record<string, string | undefined>;
}

/** U.S. address block: street, optional second line, city, state and ZIP. */
export function AddressFields({ prefix, legend, value, onChange, errors = {} }: AddressFieldsProps) {
  const update = (patch: Partial<Address>) => onChange({ ...value, ...patch });

  return (
    <fieldset className="space-y-3">
      <legend className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted mb-2">
        {legend}
      </legend>

      <FormField label="Street address" htmlFor={`${prefix}-line1`} error={errors[`${prefix}-line1`]}>
        <TextInput
          id={`${prefix}-line1`}
          value={value.line1}
          invalid={Boolean(errors[`${prefix}-line1`])}
          autoComplete="address-line1"
          onChange={(event) => update({ line1: event.target.value })}
        />
      </FormField>

      <FormField label="Suite / unit" htmlFor={`${prefix}-line2`} optional>
        <TextInput
          id={`${prefix}-line2`}
          value={value.line2 ?? ''}
          autoComplete="address-line2"
          onChange={(event) => update({ line2: event.target.value })}
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_5rem_7rem] gap-3">
        <FormField label="City" htmlFor={`${prefix}-city`} error={errors[`${prefix}-city`]}>
          <TextInput
            id={`${prefix}-city`}
            value={value.city}
            invalid={Boolean(errors[`${prefix}-city`])}
            autoComplete="address-level2"
            onChange={(event) => update({ city: event.target.value })}
          />
        </FormField>

        <FormField label="State" htmlFor={`${prefix}-state`} error={errors[`${prefix}-state`]}>
          <TextInput
            id={`${prefix}-state`}
            value={value.state}
            maxLength={2}
            invalid={Boolean(errors[`${prefix}-state`])}
            autoComplete="address-level1"
            onChange={(event) => update({ state: event.target.value.toUpperCase() })}
          />
        </FormField>

        <FormField label="ZIP" htmlFor={`${prefix}-zip`} error={errors[`${prefix}-zip`]}>
          <TextInput
            id={`${prefix}-zip`}
            value={value.zip}
            inputMode="numeric"
            maxLength={10}
            invalid={Boolean(errors[`${prefix}-zip`])}
            autoComplete="postal-code"
            onChange={(event) => update({ zip: event.target.value })}
          />
        </FormField>
      </div>
    </fieldset>
  );
}

/**
 * Numeric text that keeps what the visitor is typing.
 *
 * The parent stores a normalized number, so a naive controlled input rewrites
 * the field on every keystroke: typing "250" into a money field becomes
 * "2.00" -> "2.01", and typing "8.81" into a rate field loses the decimal
 * point the moment it is entered. This holds the raw keystrokes while the
 * field has focus and only snaps to the canonical form on blur.
 */
function useNumericDraft(value: string) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  return {
    draft,
    focused,
    onChange: (next: string) => setDraft(next),
    onFocus: () => setFocused(true),
    onBlur: () => {
      setFocused(false);
      setDraft(value);
    },
  };
}

/** Money input in dollars. The caller converts to cents on submit. */
export function MoneyInput({
  id,
  value,
  onChange,
  invalid,
  placeholder = '0.00',
  className = '',
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const field = useNumericDraft(value);

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[0.875rem] text-muted"
      >
        $
      </span>
      <TextInput
        id={id}
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        placeholder={placeholder}
        value={field.draft}
        invalid={invalid}
        onFocus={field.onFocus}
        onBlur={field.onBlur}
        onChange={(event) => {
          field.onChange(event.target.value);
          onChange(event.target.value);
        }}
        className={`pl-6 text-right tabular-nums ${className}`}
      />
    </div>
  );
}

/** Plain number input with the same keep-what-was-typed behaviour. */
export function NumberInput({
  id,
  value,
  onChange,
  min = '0',
  step = '1',
  max,
  label,
  className = '',
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  step?: string;
  max?: string;
  label?: string;
  className?: string;
}) {
  const field = useNumericDraft(value);

  return (
    <TextInput
      id={id}
      type="number"
      min={min}
      max={max}
      step={step}
      inputMode="decimal"
      aria-label={label}
      value={field.draft}
      onFocus={field.onFocus}
      onBlur={field.onBlur}
      onChange={(event) => {
        field.onChange(event.target.value);
        onChange(event.target.value);
      }}
      className={`text-right tabular-nums ${className}`}
    />
  );
}
