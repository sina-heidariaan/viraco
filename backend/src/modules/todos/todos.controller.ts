import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UuidParam } from '../../common/decorators/uuid-param.decorator';
import { AuthUser } from '../auth/auth-user';
import { CreateTodoDto } from './dto/create-todo.dto';
import { ListTodosQueryDto } from './dto/list-todos.query';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { TodoResponse } from './todo.response';
import { TodosService } from './todos.service';

/** Any authenticated user. Row-level rules live in TodosService + todo-access.policy. */
@Controller('todos')
export class TodosController {
  constructor(private readonly todos: TodosService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListTodosQueryDto): Promise<TodoResponse[]> {
    return this.todos.list(user, query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTodoDto): Promise<TodoResponse> {
    return this.todos.create(user, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @UuidParam('id') id: string): Promise<TodoResponse> {
    return this.todos.findOne(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @UuidParam('id') id: string,
    @Body() dto: UpdateTodoDto,
  ): Promise<TodoResponse> {
    return this.todos.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @UuidParam('id') id: string): Promise<void> {
    return this.todos.remove(user, id);
  }
}
