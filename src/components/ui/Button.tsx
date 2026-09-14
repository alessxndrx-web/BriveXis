import { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'dark-outline';
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export function Button({ children, variant = 'primary', className = '', onClick, type = 'button' }: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center font-medium transition-colors duration-200 text-sm tracking-wide";
  
  const variants = {
    primary: "bg-copper text-white hover:bg-copper-highlight px-7 py-3.5",
    secondary: "bg-white-surface text-charcoal hover:bg-ivory border border-light-border px-7 py-3.5",
    'dark-outline': "border border-dark-border text-white hover:bg-dark-surface px-7 py-3.5",
    outline: "border border-light-border text-charcoal hover:bg-white-surface px-7 py-3.5",
    ghost: "text-muted hover:text-charcoal px-4 py-2",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
