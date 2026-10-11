import { Role } from './role.enum';
import { User } from './user.entity';

/**
 * True when applying `change` to `target` would leave no active owner.
 * `activeOwnerIds` must be read under a lock (see UsersService.update).
 */
export function removesLastActiveOwner(
  target: Pick<User, 'id' | 'role' | 'isActive'>,
  change: { role?: Role; isActive?: boolean },
  activeOwnerIds: string[],
): boolean {
  const isActiveOwner = target.role === Role.Owner && target.isActive;
  if (!isActiveOwner) return false;
  const staysActiveOwner =
    (change.role ?? target.role) === Role.Owner && (change.isActive ?? target.isActive);
  if (staysActiveOwner) return false;
  return activeOwnerIds.every((id) => id === target.id);
}
