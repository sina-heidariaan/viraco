import { SelectQueryBuilder } from 'typeorm';
import { AuthUser } from '../auth/auth-user';
import { Role } from '../users/role.enum';
import { Todo } from './todo.entity';
import { canAssignTo, canChangeAssignee, canDeleteTodo, scopeTodosToUser } from './todo-access.policy';

const user = (role: Role, id = `${role}-id`): AuthUser => ({ id, email: `${role}@x`, name: role, role });
const member = user(Role.Member, 'me');
const OTHER = 'someone-else';

describe('todo-access.policy', () => {
  describe('scopeTodosToUser', () => {
    const fakeQb = () => {
      const andWhere = jest.fn();
      const qb = { andWhere } as unknown as SelectQueryBuilder<Todo>;
      andWhere.mockReturnValue(qb);
      return { qb, andWhere };
    };

    it('limits a member to tasks they created or are assigned to, inside the query', () => {
      const { qb, andWhere } = fakeQb();
      scopeTodosToUser(qb, member);
      expect(andWhere).toHaveBeenCalledWith('(todo.createdById = :viewerId OR todo.assigneeId = :viewerId)', {
        viewerId: 'me',
      });
    });

    it.each([Role.Owner, Role.Manager])('adds no filter for %s', (role) => {
      const { qb, andWhere } = fakeQb();
      scopeTodosToUser(qb, user(role));
      expect(andWhere).not.toHaveBeenCalled();
    });
  });

  describe('canAssignTo (new task)', () => {
    it('member: only self or nobody', () => {
      expect(canAssignTo(member, 'me')).toBe(true);
      expect(canAssignTo(member, null)).toBe(true);
      expect(canAssignTo(member, OTHER)).toBe(false);
    });

    it.each([Role.Owner, Role.Manager])('%s: anyone', (role) => {
      expect(canAssignTo(user(role), OTHER)).toBe(true);
    });
  });

  describe('canChangeAssignee (existing task)', () => {
    const created = { createdById: 'me' };
    const notCreated = { createdById: OTHER };

    it('member, task they created: to self or nobody only', () => {
      expect(canChangeAssignee(member, created, null)).toBe(true);
      expect(canChangeAssignee(member, created, 'me')).toBe(true);
      expect(canChangeAssignee(member, created, OTHER)).toBe(false);
    });

    it('member, task only assigned to them: never', () => {
      expect(canChangeAssignee(member, notCreated, null)).toBe(false);
      expect(canChangeAssignee(member, notCreated, 'me')).toBe(false);
    });

    it.each([Role.Owner, Role.Manager])('%s: any task, anyone', (role) => {
      expect(canChangeAssignee(user(role), notCreated, OTHER)).toBe(true);
    });
  });

  describe('canDeleteTodo', () => {
    it('member: only tasks they created', () => {
      expect(canDeleteTodo(member, { createdById: 'me' })).toBe(true);
      expect(canDeleteTodo(member, { createdById: OTHER })).toBe(false);
    });

    it.each([Role.Owner, Role.Manager])('%s: any task', (role) => {
      expect(canDeleteTodo(user(role), { createdById: OTHER })).toBe(true);
    });
  });
});
