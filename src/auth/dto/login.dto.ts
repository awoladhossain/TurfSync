import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email!: string;
  @ApiProperty({ example: 'Test1234!' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
