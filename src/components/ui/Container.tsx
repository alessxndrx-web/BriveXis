import { ReactNode } from 'react';

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

/** Editorial grid container: 1360px max, generous but never overflowing gutters. */
export function Container({ children, className = '' }: ContainerProps) {
  return (
    <div className={`w-full max-w-[85rem] mx-auto px-5 sm:px-8 lg:px-12 ${className}`}>
      {children}
    </div>
  );
}
