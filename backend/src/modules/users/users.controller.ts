import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from './role.enum';
import { UserOption, UserResponse } from './user.response';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles(Role.Owner)
  list(): Promise<UserResponse[]> {
    return this.users.list();
  }

  @Get('options')
  @Roles(Role.Owner, Role.Manager)
  options(): Promise<UserOption[]> {
    return this.users.options();
  }

  @Post()
  @Roles(Role.Owner)
  create(@Body() dto: CreateUserDto): Promise<UserResponse> {
    return this.users.create(dto);
  }

  @Patch(':id')
  @Roles(Role.Owner)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto): Promise<UserResponse> {
    return this.users.update(id, dto);
  }
}
