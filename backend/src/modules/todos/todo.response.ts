import { TiptapDoc } from './tiptap/tiptap.types';
import { Todo, TodoPriority, TodoStatus } from './todo.entity';

export interface UserRef {
  id: string;
  name: string;
}

export interface TodoResponse {
  id: string;
  title: string;
  description: TiptapDoc;
  status: TodoStatus;
  priority: TodoPriority;
  dueDate: string | null;
  assignee: UserRef | null;
  createdBy: UserRef;
  createdAt: Date;
  updatedAt: Date;
}

/** Expects `assignee` and `createdBy` to be joined (id + name only). */
export function toTodoResponse(todo: Todo): TodoResponse {
  return {
    id: todo.id,
    title: todo.title,
    description: todo.description,
    status: todo.status,
    priority: todo.priority,
    dueDate: todo.dueDate,
    assignee: todo.assignee ? { id: todo.assignee.id, name: todo.assignee.name } : null,
    createdBy: { id: todo.createdBy.id, name: todo.createdBy.name },
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
  };
}
