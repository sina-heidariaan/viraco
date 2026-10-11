'use client';

import { Description, DialogBackdrop, DialogPanel, DialogTitle, Dialog as HeadlessDialog } from '@headlessui/react';
import clsx from 'clsx';
import type { ReactNode } from 'react';

type DialogProps = {
  open: boolean;
  /** Escape, backdrop click and the close controls call this. */
  onClose: () => void;
  title: string;
  description?: ReactNode;
  size?: 'sm' | 'lg';
  children: ReactNode;
};

/**
 * Headless UI Dialog: focus is trapped inside and returns to the trigger on close.
 * Enter/leave transitions stay under 200 ms; globals.css turns them off under
 * prefers-reduced-motion.
 */
export function Dialog({ open, onClose, title, description, size = 'sm', children }: DialogProps) {
  return (
    <HeadlessDialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-neutral-950/40 transition-opacity duration-200 ease-out data-closed:opacity-0 data-leave:duration-150"
      />
      <div className="fixed inset-0 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 sm:items-center">
          <DialogPanel
            transition
            className={clsx(
              'w-full rounded-xl bg-white p-5 shadow-xl ring-1 ring-neutral-200 transition duration-200 ease-out sm:p-6',
              'data-closed:translate-y-2 data-closed:opacity-0 data-leave:duration-150',
              size === 'lg' ? 'max-w-2xl' : 'max-w-md',
            )}
          >
            <DialogTitle className="text-lg font-semibold text-neutral-900">{title}</DialogTitle>
            {description && <Description className="mt-2 text-sm text-neutral-700">{description}</Description>}
            <div className="mt-5">{children}</div>
          </DialogPanel>
        </div>
      </div>
    </HeadlessDialog>
  );
}

/** Button row at the bottom of a dialog. The primary action comes first (the start side). */
export function DialogActions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-wrap items-center gap-3">{children}</div>;
}
