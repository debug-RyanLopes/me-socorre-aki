import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQuery } from './dto/list-users.query';
import { ResetPasswordDto, UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: ListUsersQuery) {
    return this.users.list(query);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.users.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  deactivate(@CurrentUser() actor: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.users.deactivate(actor, id);
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  reactivate(@Param('id', ParseIntPipe) id: number) {
    return this.users.reactivate(id);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  resetPassword(@Param('id', ParseIntPipe) id: number, @Body() dto: ResetPasswordDto) {
    return this.users.resetPassword(id, dto.temporaryPassword);
  }
}
