import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID of the Turf to book',
  })
  @IsString()
  @IsNotEmpty()
  turfId!: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'ID of the Slot to book',
  })
  @IsString()
  @IsNotEmpty()
  slotId!: string;

  @ApiProperty({
    example: '2026-06-27',
    description: 'Date of the booking (YYYY-MM-DD)',
  })
  @IsDateString()
  date!: string;

  @ApiProperty({
    example: 'Please prepare the turf.',
    description: 'Optional additional notes for the booking',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    example: 'AF7567',
    description: 'Coupon code for the booking',
    required: false,
  })
  @IsString()
  @IsOptional()
  couponCode?: string;
}
