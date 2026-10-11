import { IsEnum, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { TodoStatus } from '../todo.entity';

export const UNASSIGNED = 'unassigned';

export class ListTodosQueryDto {
  @IsOptional()
  @IsEnum(TodoStatus)
  status?: TodoStatus;

  /** A user id, or `unassigned` for tasks without an assignee. */
  @ValidateIf((_obj: object, value: unknown) => value !== undefined && value !== UNASSIGNED)
  @IsUUID()
  assigneeId?: string;
}
