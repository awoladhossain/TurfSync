import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetAllUsersDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'John',
    description: 'Search string to filter users by name, email, or phone number',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
