import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { TiptapDoc } from './tiptap/tiptap.types';

export enum TodoStatus {
  Todo = 'todo',
  InProgress = 'in_progress',
  Done = 'done',
}

export enum TodoPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

@Entity('todos')
@Check('CHK_todos_title_not_blank', `char_length(btrim("title")) > 0`)
export class Todo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  /** TipTap JSON document — the source of truth. HTML is never stored. */
  @Column({ type: 'jsonb', default: () => `'{"type":"doc","content":[]}'::jsonb` })
  description: TiptapDoc;

  @Index('IDX_todos_status')
  @Column({ type: 'enum', enum: TodoStatus, enumName: 'todo_status', default: TodoStatus.Todo })
  status: TodoStatus;

  @Column({
    type: 'enum',
    enum: TodoPriority,
    enumName: 'todo_priority',
    default: TodoPriority.Medium,
  })
  priority: TodoPriority;

  /** Calendar date without time (ISO yyyy-mm-dd). */
  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string | null;

  @Index('IDX_todos_assignee_id')
  @Column({ name: 'assignee_id', type: 'uuid', nullable: true })
  assigneeId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assignee_id' })
  assignee: User | null;

  @Index('IDX_todos_created_by_id')
  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
