import type { Metadata } from 'next';
import { TaskDetail } from '@/components/tasks/task-detail';

export const metadata: Metadata = { title: 'جزئیات کار' };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TaskDetail id={id} />;
}
