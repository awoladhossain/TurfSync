import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SportType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class QueryTurfDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'Dhaka',
    description: 'Filter turfs by city name',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    enum: SportType,
    description: 'Filter turfs by sport type',
  })
  @IsOptional()
  @IsEnum(SportType)
  sportType?: SportType;

  @ApiPropertyOptional({
    example: 'Manchester',
    description: 'Search string to search in turf names or descriptions',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ example: 3000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @IsString()
  availableDate?: string;
}
