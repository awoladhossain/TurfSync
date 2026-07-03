import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class GetAllBookingsDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: BookingStatus,
    description: 'Filter bookings by booking status',
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Filter bookings by turf ID',
  })
  @IsOptional()
  @IsUUID()
  turfId?: string;

  @ApiPropertyOptional({
    example: '2026-07-01',
    description:
      'Filter bookings created starting from this date (Format: YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({
    example: '2026-07-03',
    description: 'Filter bookings created up to this date (Format: YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  dateTo?: string;
}
