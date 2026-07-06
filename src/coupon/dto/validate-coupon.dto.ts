import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min } from 'class-validator';

export class ValidateCouponDto {
  @ApiProperty({
    description: 'Unique coupon code to validate',
    example: 'SUMMER50',
  })
  @IsString()
  code: string;

  @ApiProperty({
    description: 'The booking amount before applying the discount',
    example: 100,
  })
  @IsNumber()
  @Min(0)
  bookingAmount: number;
}
