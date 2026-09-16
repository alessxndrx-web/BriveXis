import { ReactNode } from 'react';
import { Stagger, StaggerItem } from './Reveal';

interface SectionHeaderProps {
  /** Copper section number, e.g. "03". */
  index?: string;
  /** Small uppercase label above the title. */
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  /** Element id applied to the heading so sections can be labelled by it. */
  titleId?: string;
  size?: 'lg' | 'md';
  /** Overrides the default heading measure, e.g. for longer statements. */
  titleClassName?: string;
  dark?: boolean;
  className?: string;
}

/**
 * Section heading. Reveals as three logical blocks — label, statement, lead —
 * so it never needs an extra wrapper, and never animates word by word.
 */
export function SectionHeader({
  index,
  eyebrow,
  title,
  lead,
  titleId,
  size = 'lg',
  titleClassName = 'max-w-[22ch]',
  dark = false,
  className = '',
}: SectionHeaderProps) {
  return (
    <Stagger step={0.07} className={className}>
      {(index || eyebrow) && (
        <StaggerItem className="flex items-center gap-3 mb-6">
          {index && (
            <span className="text-eyebrow uppercase text-copper tabular-nums">{index}</span>
          )}
          <span
            aria-hidden="true"
            className={`h-px w-8 ${dark ? 'bg-dark-border' : 'bg-light-border'}`}
          />
          {eyebrow && (
            <span
              className={`text-eyebrow uppercase ${dark ? 'text-muted-dark' : 'text-muted'}`}
            >
              {eyebrow}
            </span>
          )}
        </StaggerItem>
      )}

      <StaggerItem>
        <h2
          id={titleId}
          className={`${size === 'lg' ? 'text-section' : 'text-section-sm'} font-semibold ${
            dark ? 'text-white-surface' : 'text-charcoal'
          } ${titleClassName}`}
        >
          {title}
        </h2>
      </StaggerItem>

      {lead && (
        <StaggerItem>
          <p className={`mt-6 text-lead max-w-[54ch] ${dark ? 'text-muted-dark' : 'text-muted'}`}>
            {lead}
          </p>
        </StaggerItem>
      )}
    </Stagger>
  );
}
