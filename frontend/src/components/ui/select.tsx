'use client';

import { Description, Field, Label, Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';

export type SelectOption<V extends string> = { value: V; label: string };

type SelectProps<V extends string> = {
  label: string;
  value: V;
  onChange: (value: V) => void;
  options: SelectOption<V>[];
  /** Shown under the control and linked to it with aria-describedby. */
  error?: string;
  /** Neutral help text under the control (e.g. why it is locked). */
  hint?: string;
  disabled?: boolean;
  className?: string;
};

/** Visible label + Headless UI Listbox. Labels are isolated, so Latin names stay readable. */
export function Select<V extends string>({
  label,
  value,
  onChange,
  options,
  error,
  hint,
  disabled,
  className,
}: SelectProps<V>) {
  const selected = options.find((option) => option.value === value);
  return (
    <Field disabled={disabled} className={clsx('flex flex-col gap-1.5', className)}>
      <Label className="text-sm font-medium text-neutral-800 data-disabled:text-neutral-600">{label}</Label>
      <Listbox value={value} onChange={onChange} invalid={Boolean(error)}>
        <ListboxButton
          className={clsx(
            'flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border bg-white ps-3 pe-2 text-start text-base text-neutral-900 transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1',
            'data-disabled:cursor-not-allowed data-disabled:bg-neutral-100 data-disabled:text-neutral-700',
            error ? 'border-danger-600' : 'border-neutral-300 data-hover:border-neutral-400',
          )}
        >
          <bdi dir="auto" className="truncate">
            {selected?.label ?? ''}
          </bdi>
          <ChevronUpDownIcon aria-hidden="true" className="size-5 shrink-0 text-neutral-500" />
        </ListboxButton>
        <ListboxOptions
          anchor={{ to: 'bottom start', gap: 4 }}
          transition
          className={clsx(
            'z-50 max-h-64 w-(--button-width) min-w-40 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-lg',
            'focus:outline-none transition duration-150 ease-out data-closed:opacity-0 data-leave:duration-100',
          )}
        >
          {options.map((option) => (
            <ListboxOption
              key={option.value}
              value={option.value}
              className="group flex min-h-10 cursor-default items-center gap-2 rounded-md px-2 text-sm text-neutral-900 select-none data-focus:bg-accent-50"
            >
              <CheckIcon aria-hidden="true" className="invisible size-4 shrink-0 text-accent-700 group-data-selected:visible" />
              <bdi dir="auto" className="truncate group-data-selected:font-medium">
                {option.label}
              </bdi>
            </ListboxOption>
          ))}
        </ListboxOptions>
      </Listbox>
      {error ? (
        <Description className="text-sm text-danger-700">{error}</Description>
      ) : (
        hint && <Description className="text-sm text-neutral-600">{hint}</Description>
      )}
    </Field>
  );
}
