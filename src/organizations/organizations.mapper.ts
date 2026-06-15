import { ApiProperty } from '@nestjs/swagger';
import { Member, Organization, User } from '@prisma/client';

export class OrganizationResponse {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) slug: string | null;
  @ApiProperty() createdAt: Date;
}

export class MemberResponse {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() role: string;
  @ApiProperty({ nullable: true }) name: string | null;
  @ApiProperty({ nullable: true }) email: string | null;
}

export function toOrganizationResponse(org: Organization): OrganizationResponse {
  return { id: org.id, name: org.name, slug: org.slug, createdAt: org.createdAt };
}

export function toMemberResponse(member: Member & { user?: User | null }): MemberResponse {
  return {
    id: member.id,
    userId: member.userId,
    role: member.role,
    name: member.user?.name ?? null,
    email: member.user?.email ?? null,
  };
}
