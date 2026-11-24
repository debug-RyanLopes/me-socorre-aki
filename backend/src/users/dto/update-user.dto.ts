import { OmitType, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['temporaryPassword'] as const)) {}

export class ResetPasswordDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  temporaryPassword?: string;
}
