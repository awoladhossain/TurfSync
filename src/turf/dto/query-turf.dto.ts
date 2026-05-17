import { PaginationDto } from '@/common/dto/pagination.dto';
import { SportType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryTurfDto extends PaginationDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsEnum(SportType)
  sportType?: SportType;

  @IsOptional()
  @IsString()
  search?: string;
}
