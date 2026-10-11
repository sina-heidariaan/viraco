import { IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { TiptapDoc } from '../tiptap/tiptap.types';
import { IsTiptapDoc } from '../tiptap/tiptap.validator';
import { TodoPriority, TodoStatus } from '../todo.entity';
import { IfPresent, Trim } from '../../../common/decorators/validation.decorators';

export class CreateTodoDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  /** Omitted → empty document. */
  @IfPresent()
  @IsTiptapDoc()
  description?: TiptapDoc;

  @IfPresent()
  @IsEnum(TodoStatus)
  status?: TodoStatus;

  @IfPresent()
  @IsEnum(TodoPriority)
  priority?: TodoPriority;

  /** yyyy-mm-dd, or null for no due date. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dueDate must be yyyy-mm-dd' })
  @IsISO8601({ strict: true })
  dueDate?: string | null;

  /** null or omitted → unassigned. */
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;
}
