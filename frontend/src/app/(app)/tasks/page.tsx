import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'کارها' };

// The board, filters and dialogs arrive in M6 (S6).
export default function TasksPage() {
  return (
    <section>
      <h1 className="text-xl font-semibold text-neutral-900">کارها</h1>
      <p className="mt-2 text-sm text-neutral-600">فهرست کارها به‌زودی اینجا نمایش داده می‌شود.</p>
    </section>
  );
}
