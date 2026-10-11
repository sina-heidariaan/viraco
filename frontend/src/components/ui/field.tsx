'use client';

import { Description, Field, Input, Label, type InputProps } from '@headlessui/react';
import clsx from 'clsx';
import type { Ref } from 'react';

type TextFieldProps = Omit<InputProps, 'className' | 'invalid'> & {
  label: string;
  /** Shown under the input and linked to it with aria-describedby. */
  error?: string;
  ref?: Ref<HTMLInputElement>;
};

/** Visible label + input + error, wired together by Headless UI's Field. */
export function TextField({ label, error, ref, ...input }: TextFieldProps) {
  return (
    <Field className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium text-neutral-800">{label}</Label>
      <Input
        ref={ref}
        invalid={Boolean(error)}
        className={clsx(
          'block min-h-10 w-full rounded-lg border bg-white px-3 text-base text-neutral-900 transition-colors duration-150',
          'placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1',
          error ? 'border-danger-600' : 'border-neutral-300 data-hover:border-neutral-400',
        )}
        {...input}
      />
      {error && <Description className="text-sm text-danger-700">{error}</Description>}
    </Field>
  );
}
