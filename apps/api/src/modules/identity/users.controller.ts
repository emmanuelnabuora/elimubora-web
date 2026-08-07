import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query
} from '@nestjs/common';
import { CurrentUser, Roles } from './auth.decorators';
import type { AuthenticatedUser } from './identity.types';
import {
  createInvitationSchema,
  listUsersQuerySchema,
  updateFullNameSchema,
  updateMembershipSchema,
  type CreateInvitationDto,
  type ListUsersQueryDto,
  type UpdateFullNameDto,
  type UpdateMembershipDto
} from './users.dto';
import { UsersService } from './users.service';
import { ZodValidationPipe } from './zod-validation.pipe';

/** Tenant administration. Restricted to administrative roles. */
@Roles('school_admin', 'principal', 'platform_admin')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listUsersQuerySchema)) query: ListUsersQueryDto) {
    return this.users.listTenantUsers(query.limit, query.offset);
  }

  @Post('invitations')
  invite(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createInvitationSchema)) dto: CreateInvitationDto
  ) {
    return this.users.createInvitation({ ...dto, invitedBy: user.userId });
  }

  @Get('invitations')
  listInvitations() {
    return this.users.listInvitations();
  }

  @Delete('invitations/:id')
  @HttpCode(204)
  async revokeInvitation(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.users.revokeInvitation(id);
  }

  @Patch(':userId/membership')
  @HttpCode(204)
  async updateMembership(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(updateMembershipSchema)) dto: UpdateMembershipDto
  ): Promise<void> {
    await this.users.updateMembership(user.userId, userId, dto);
  }

  @Patch(':userId/name')
  @HttpCode(204)
  async updateFullName(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(updateFullNameSchema)) dto: UpdateFullNameDto
  ): Promise<void> {
    await this.users.updateFullName(userId, dto.fullName);
  }

  @Delete(':userId/membership')
  @HttpCode(204)
  async removeMembership(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string
  ): Promise<void> {
    await this.users.removeMembership(user.userId, userId);
  }
}
