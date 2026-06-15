import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class LinkSongwriterDto {
  @ApiProperty({ example: 'songwriter@example.com', description: 'Email of the user to link' })
  @IsEmail()
  email: string;
}
