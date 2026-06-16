import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { ErrorResponse } from '../common/dto/error-response.dto';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { toUserResponse, UserResponse } from './users.mapper';

@ApiTags('users')
@ApiAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current authenticated user profile' })
  @ApiOkResponse({ description: 'The current user', type: UserResponse })
  async me(@CurrentUser() user: AuthUser): Promise<UserResponse> {
    return toUserResponse(await this.usersService.getById(user.id));
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the current user profile (name, role)' })
  @ApiOkResponse({ description: 'The updated user', type: UserResponse })
  @ApiBadRequestResponse({ description: 'Validation failed', type: ErrorResponse })
  async updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateUserDto): Promise<UserResponse> {
    return toUserResponse(await this.usersService.updateProfile(user.id, dto));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user profile by id' })
  @ApiParam({ name: 'id', description: 'User id' })
  @ApiOkResponse({ description: 'The requested user', type: UserResponse })
  @ApiNotFoundResponse({ description: 'User not found', type: ErrorResponse })
  async getById(@Param('id') id: string): Promise<UserResponse> {
    return toUserResponse(await this.usersService.getById(id));
  }
}
