import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ example: 'John Doe', description: 'User name' })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name!: string;

  @ApiProperty({ example: '01712345678', description: 'User phone number' })
  @Matches(/^(\+8801|8801|01)[3-9]\d{8}$/, {
    message: 'Give a valid Bangladeshi phone number',
  })
  phone!: string;
}
