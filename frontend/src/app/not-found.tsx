import type { Metadata } from 'next';
import Link from 'next/link';
import { StatePanel } from '@/components/ui/state-panel';

export const metadata: Metadata = { title: 'صفحه پیدا نشد' };

/** Any URL that matches no page. Replaces Next.js's English 404 page. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <StatePanel
          title="این صفحه پیدا نشد."
          action={
            <Link
              href="/tasks"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-accent-600 px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
            >
              رفتن به تخته کارها
            </Link>
          }
        >
          نشانی را بررسی کنید. ممکن است این صفحه وجود نداشته باشد.
        </StatePanel>
      </div>
    </main>
  );
}
