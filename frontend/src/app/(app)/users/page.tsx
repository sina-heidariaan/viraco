import type { Metadata } from 'next';
import { UsersScreen } from '@/components/users/users-screen';

export const metadata: Metadata = { title: 'کاربران' };

export default function UsersPage() {
  return <UsersScreen />;
}
