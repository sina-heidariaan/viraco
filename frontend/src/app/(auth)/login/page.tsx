import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'ورود' };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium text-accent-700">تخته کارها</p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">ورود به حساب</h1>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          {/* useSearchParams (for ?next=) needs a Suspense boundary. */}
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-sm text-neutral-600">حساب کاربری را مالک تیم می‌سازد.</p>
      </div>
    </main>
  );
}
