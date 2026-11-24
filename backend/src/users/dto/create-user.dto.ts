import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsEmail()
  @MaxLength(200)
  email: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9._-]{3,50}$/, { message: 'login deve ter de 3 a 50 caracteres (letras, números, ponto, hífen ou sublinhado).' })
  login: string;

  @IsEnum(Role)
  role: Role;

  @Type(() => Number)
  @IsInt()
  sectorId: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  temporaryPassword?: string;
}
