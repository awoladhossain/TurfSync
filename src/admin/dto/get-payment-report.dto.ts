import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetPaymentReportDto {
  @ApiPropertyOptional({
    example: '2026-07-01',
    description: 'Filter payments starting from this date (Format: YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({
    example: '2026-07-03',
    description: 'Filter payments up to this date (Format: YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  dateTo?: string;
}
