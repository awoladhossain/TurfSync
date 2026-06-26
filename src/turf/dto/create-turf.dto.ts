import { ApiProperty } from '@nestjs/swagger';
import { SportType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTurfDto {
  @ApiProperty({
    example: 'Old Trafford Arena',
    description: 'Name of the turf',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    example: 'Premium 7-a-side artificial turf with modern amenities.',
    description: 'Description of the turf (minimum 10 characters)',
  })
  @IsString()
  @MinLength(10, { message: 'Description must be at least 10 characters long' })
  @IsNotEmpty()
  description!: string;

  @ApiProperty({
    example: 'Road 11, Banani',
    description: 'Detailed address of the turf',
  })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty({
    example: 'Dhaka',
    description: 'City where the turf is located',
  })
  @IsString()
  @IsNotEmpty()
  city!: string;

  @ApiProperty({
    enum: SportType,
    description: 'Type of sport played on this turf',
  })
  @IsEnum(SportType)
  sportType!: SportType;

  @ApiProperty({
    example: 1500,
    description: 'Rental price per hour in BDT',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  pricePerHour!: number;

  @ApiProperty({
    example: '06:00',
    description: 'Opening time in HH:mm 24-hour format',
  })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'openTime must be in HH:mm format (24-hour)',
  })
  openTime!: string;

  @ApiProperty({
    example: '23:00',
    description: 'Closing time in HH:mm 24-hour format',
  })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'closeTime must be in HH:mm format (24-hour)',
  })
  closeTime!: string;

  @ApiProperty({
    type: [String],
    example: ['https://example.com/turf1.jpg'],
    description: 'List of turf image URLs',
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];
}
