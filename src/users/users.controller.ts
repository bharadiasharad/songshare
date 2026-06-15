import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { toUserResponse, UserResponse } from './users.mapper';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current authenticated user profile' })
  async me(@CurrentUser() user: AuthUser): Promise<UserResponse> {
    return toUserResponse(await this.usersService.getById(user.id));
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the current user profile (name, role)' })
  async updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateUserDto): Promise<UserResponse> {
    return toUserResponse(await this.usersService.updateProfile(user.id, dto));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user profile by id' })
  async getById(@Param('id') id: string): Promise<UserResponse> {
    return toUserResponse(await this.usersService.getById(id));
  }
}
