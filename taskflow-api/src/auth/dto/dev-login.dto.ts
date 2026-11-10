import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class DevLoginDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;
}
