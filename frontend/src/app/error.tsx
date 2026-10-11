'use client';

import { Button } from '@/components/ui/button';
import { StatePanel } from '@/components/ui/state-panel';

/**
 * Shown when a page throws while rendering. Replaces Next.js's English error page.
 * Data screens handle API errors themselves; this is the last line for real bugs.
 */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <StatePanel
          role="alert"
          tone="danger"
          title="این صفحه نمایش داده نشد."
          action={<Button onClick={reset}>تلاش دوباره</Button>}
        >
          مشکلی پیش آمد. دوباره تلاش کنید یا صفحه را دوباره بارگذاری کنید.
        </StatePanel>
      </div>
    </main>
  );
}
