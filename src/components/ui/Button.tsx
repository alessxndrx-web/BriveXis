import { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant =
  /** Light sections: near-black surface, light text. */
  | 'solid'
  /** Dark sections: ivory surface, dark text. */
  | 'solid-invert'
  /** Light sections: hairline outline. */
  | 'outline'
  /** Dark sections: hairline outline. */
  | 'outline-invert'
  /** Brand accent. Used sparingly, never as the default action. */
  | 'copper';

interface BaseProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
}

type ButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type LinkProps = BaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

const base =
  'inline-flex items-center justify-center gap-2 font-sans font-semibold rounded-[2px] ' +
  'whitespace-nowrap transition-[background-color,border-color,color,transform] duration-200 ' +
  // A single pixel of lift on hover: enough to feel responsive, never showy.
  'motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0';

const sizes = {
  sm: 'text-[0.8125rem] px-4 py-2.5',
  md: 'text-[0.9375rem] px-6 py-3.5',
};

const variants: Record<ButtonVariant, string> = {
  solid: 'bg-charcoal text-white-surface hover:bg-midnight',
  'solid-invert': 'bg-ivory text-midnight hover:bg-white-surface',
  outline:
    'border border-light-border text-charcoal hover:border-charcoal/45 hover:bg-white-surface',
  'outline-invert':
    'border border-muted-dark/35 text-white-surface hover:border-muted-dark/70 hover:bg-white/[0.05]',
  copper: 'bg-copper text-white hover:bg-copper-highlight',
};

function classes({ variant = 'solid', size = 'md', fullWidth, className = '' }: BaseProps) {
  return `${base} ${sizes[size]} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`;
}

export function Button(props: ButtonProps | LinkProps) {
  const { children, variant, size, fullWidth, className, ...rest } = props;
  const styles = classes({ children, variant, size, fullWidth, className });

  if (typeof props.href === 'string') {
    const { href, ...anchorRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & {
      href: string;
    };
    return (
      <a href={href} className={styles} {...anchorRest}>
        {children}
      </a>
    );
  }

  const buttonRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type={buttonRest.type ?? 'button'} className={styles} {...buttonRest}>
      {children}
    </button>
  );
}
