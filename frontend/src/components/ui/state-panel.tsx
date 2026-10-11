import clsx from 'clsx';
import type { ReactNode } from 'react';

type StatePanelProps = {
  title: string;
  children?: ReactNode;
  /** Buttons or links under the text. */
  action?: ReactNode;
  /** `alert` for errors (announced at once); `status` for empty and forbidden states. */
  role?: 'alert' | 'status';
  tone?: 'neutral' | 'danger';
};

/** The empty, no-match, error and forbidden states of a data screen (plan §8.4). */
export function StatePanel({ title, children, action, role = 'status', tone = 'neutral' }: StatePanelProps) {
  return (
    <div
      role={role}
      className={clsx(
        'rounded-xl border border-dashed px-6 py-10 text-center',
        tone === 'danger' ? 'border-danger-200 bg-danger-50' : 'border-neutral-300 bg-white',
      )}
    >
      <p className={clsx('text-base font-medium', tone === 'danger' ? 'text-danger-800' : 'text-neutral-900')}>
        {title}
      </p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-neutral-700">{children}</div>}
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-3">{action}</div>}
    </div>
  );
}
