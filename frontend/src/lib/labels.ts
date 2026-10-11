import type { Role } from '@/types/api';

// The only place enum values get Persian labels (plan §8.1).

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'مالک',
  manager: 'مدیر',
  member: 'عضو',
};
