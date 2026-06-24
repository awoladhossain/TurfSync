import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'John Doe', description: 'User name' })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name!: string;

  @ApiProperty({ example: 'john.doe@example.com', description: 'User email' })
  @IsEmail({}, { message: 'Give a valid email' })
  email!: string;

  @ApiProperty({ example: '01712345678', description: 'User phone number' })
  @Matches(/^(\+8801|8801|01)[3-9]\d{8}$/, {
    message: 'Give a valid Bangladeshi phone number',
  })
  phone!: string;

  @ApiProperty({ example: 'Test1234!', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password!: string;
}
