'use client';

import { Button as HeadlessButton, type ButtonProps as HeadlessButtonProps } from '@headlessui/react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent-600 text-white data-hover:bg-accent-700 data-active:bg-accent-800',
  secondary: 'border border-neutral-300 bg-white text-neutral-800 data-hover:bg-neutral-100 data-active:bg-neutral-200',
};

export type ButtonProps = Omit<HeadlessButtonProps, 'className'> & {
  variant?: Variant;
  className?: string;
};

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <HeadlessButton
      className={clsx(
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2',
        'data-disabled:cursor-not-allowed data-disabled:opacity-60',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
