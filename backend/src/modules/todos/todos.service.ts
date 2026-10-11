import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AuthUser } from '../auth/auth-user';
import { User } from '../users/user.entity';
import { CreateTodoDto } from './dto/create-todo.dto';
import { ListTodosQueryDto, UNASSIGNED } from './dto/list-todos.query';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { EMPTY_TIPTAP_DOC } from './tiptap/tiptap.types';
import { Todo } from './todo.entity';
import { canAssignTo, canChangeAssignee, canDeleteTodo, scopeTodosToUser } from './todo-access.policy';
import { toTodoResponse, TodoResponse } from './todo.response';

const NOT_FOUND = 'Task not found';

/** TypeORM's partial-entity type cannot express a jsonb object; the validator already checked it. */
type JsonbValue = QueryDeepPartialEntity<Todo>['description'];

@Injectable()
export class TodosService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(user: AuthUser, query: ListTodosQueryDto): Promise<TodoResponse[]> {
    const qb = this.withPeople(user);
    if (query.status) qb.andWhere('todo.status = :status', { status: query.status });
    if (query.assigneeId === UNASSIGNED) qb.andWhere('todo.assigneeId IS NULL');
    else if (query.assigneeId) qb.andWhere('todo.assigneeId = :assigneeId', { assigneeId: query.assigneeId });
    const todos = await qb.orderBy('todo.createdAt', 'DESC').getMany();
    return todos.map(toTodoResponse);
  }

  /** A task the user may not see is reported as missing (404), not forbidden (AS5). */
  async findOne(user: AuthUser, id: string): Promise<TodoResponse> {
    const todo = await this.withPeople(user).andWhere('todo.id = :id', { id }).getOne();
    if (!todo) throw new NotFoundException(NOT_FOUND);
    return toTodoResponse(todo);
  }

  async create(user: AuthUser, dto: CreateTodoDto): Promise<TodoResponse> {
    const assigneeId = dto.assigneeId ?? null;
    if (!canAssignTo(user, assigneeId)) {
      throw new ForbiddenException('Members can only assign tasks to themselves');
    }
    const id = await this.dataSource.transaction(async (m) => {
      await this.assertAssignable(m, assigneeId);
      const result = await m.insert(Todo, {
        title: dto.title,
        description: (dto.description ?? EMPTY_TIPTAP_DOC) as JsonbValue,
        status: dto.status,
        priority: dto.priority,
        dueDate: dto.dueDate ?? null,
        assigneeId,
        createdById: user.id,
      });
      return (result.identifiers[0] as { id: string }).id;
    });
    return this.findOne(user, id);
  }

  async update(user: AuthUser, id: string, dto: UpdateTodoDto): Promise<TodoResponse> {
    await this.dataSource.transaction(async (m) => {
      const todo = await this.lockVisible(m, user, id);
      const changes: QueryDeepPartialEntity<Todo> = {};

      if (dto.assigneeId !== undefined && dto.assigneeId !== todo.assigneeId) {
        if (!canChangeAssignee(user, todo, dto.assigneeId)) {
          throw new ForbiddenException(
            'Members can only change the assignee of tasks they created, to themselves or nobody',
          );
        }
        await this.assertAssignable(m, dto.assigneeId);
        changes.assigneeId = dto.assigneeId;
      }
      if (dto.title !== undefined) changes.title = dto.title;
      if (dto.description !== undefined) changes.description = dto.description as JsonbValue;
      if (dto.status !== undefined) changes.status = dto.status;
      if (dto.priority !== undefined) changes.priority = dto.priority;
      if (dto.dueDate !== undefined) changes.dueDate = dto.dueDate;

      if (Object.keys(changes).length > 0) await m.update(Todo, { id }, changes);
    });
    return this.findOne(user, id);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const todo = await this.lockVisible(m, user, id);
      if (!canDeleteTodo(user, todo)) {
        throw new ForbiddenException('Members can only delete tasks they created');
      }
      await m.delete(Todo, { id });
    });
  }

  /** Visible tasks with assignee and creator (id + name only). */
  private withPeople(user: AuthUser) {
    const qb = this.dataSource
      .getRepository(Todo)
      .createQueryBuilder('todo')
      .leftJoin('todo.assignee', 'assignee')
      .addSelect(['assignee.id', 'assignee.name'])
      .innerJoin('todo.createdBy', 'createdBy')
      .addSelect(['createdBy.id', 'createdBy.name']);
    return scopeTodosToUser(qb, user);
  }

  /** Loads and row-locks a task the user can see, or throws 404. No joins: FOR UPDATE cannot lock outer joins. */
  private async lockVisible(m: EntityManager, user: AuthUser, id: string): Promise<Todo> {
    const qb = m.getRepository(Todo).createQueryBuilder('todo').where('todo.id = :id', { id });
    const todo = await scopeTodosToUser(qb, user).setLock('pessimistic_write').getOne();
    if (!todo) throw new NotFoundException(NOT_FOUND);
    return todo;
  }

  /** New assignees must be active users. The share lock stops a parallel disable mid-transaction. */
  private async assertAssignable(m: EntityManager, assigneeId: string | null): Promise<void> {
    if (assigneeId === null) return;
    const assignee = await m.findOne(User, {
      where: { id: assigneeId },
      lock: { mode: 'pessimistic_read' },
    });
    if (!assignee?.isActive) {
      throw new BadRequestException({
        message: 'Validation failed',
        details: [{ field: 'assigneeId', message: 'Assignee must be an active user' }],
      });
    }
  }
}
