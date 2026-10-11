import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TaskBoard } from '@/components/tasks/task-board';

export const metadata: Metadata = { title: 'کارها' };

// The board reads its filters from the URL (useSearchParams), which needs a Suspense boundary.
export default function TasksPage() {
  return (
    <Suspense>
      <TaskBoard />
    </Suspense>
  );
}
