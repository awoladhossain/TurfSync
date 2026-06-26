import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SportType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

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
}
