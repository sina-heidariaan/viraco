'use client';

import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { EllipsisVerticalIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';
import type { ComponentType, SVGProps } from 'react';

export type MenuAction = {
  label: string;
  onSelect: () => void;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  danger?: boolean;
};

/**
 * Row actions (edit, delete, disable) as a Headless UI Menu: arrow keys, Escape and
 * focus return work out of the box. `label` names the button for screen readers and
 * should name the row ("Actions for <task title>"). Renders nothing without actions.
 */
export function ActionMenu({ label, actions }: { label: string; actions: MenuAction[] }) {
  if (actions.length === 0) return null;
  return (
    <Menu>
      <MenuButton
        aria-label={label}
        className={clsx(
          'inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-neutral-600 transition-colors duration-150',
          'data-hover:bg-neutral-100 data-active:bg-neutral-200 data-open:bg-neutral-100',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600',
        )}
      >
        <EllipsisVerticalIcon aria-hidden="true" className="size-5" />
      </MenuButton>
      <MenuItems
        anchor={{ to: 'bottom end', gap: 4 }}
        transition
        className={clsx(
          'z-40 min-w-44 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg',
          'focus:outline-none transition duration-150 ease-out data-closed:opacity-0 data-leave:duration-100',
        )}
      >
        {actions.map(({ label: text, onSelect, icon: Icon, danger }) => (
          <MenuItem key={text}>
            <button
              type="button"
              onClick={onSelect}
              className={clsx(
                'flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-start text-sm',
                danger ? 'text-danger-700 data-focus:bg-danger-50' : 'text-neutral-800 data-focus:bg-neutral-100',
              )}
            >
              {Icon && <Icon aria-hidden="true" className={clsx('size-4 shrink-0', !danger && 'text-neutral-500')} />}
              {text}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}
