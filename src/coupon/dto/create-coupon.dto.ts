import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCouponDto {
  @ApiProperty({
    description: 'Unique coupon code',
    example: 'SUMMER50',
  })
  @IsString()
  code: string;

  @ApiPropertyOptional({
    description: 'Optional description of the coupon',
    example: 'Get 50% discount on summer bookings',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Type of discount (PERCENTAGE or FIXED)',
    enum: DiscountType,
    example: DiscountType.PERCENTAGE,
  })
  @IsEnum(DiscountType)
  discountType: DiscountType;

  @ApiProperty({
    description:
      'Discount value (percentage percentage value or fixed currency value)',
    example: 10,
  })
  @IsNumber()
  @Min(0)
  discountValue: number;

  @ApiProperty({
    description: 'Minimum order amount required to apply the coupon',
    example: 100,
  })
  @IsNumber()
  @Min(0)
  minOrderAmount: number;

  @ApiProperty({
    description:
      'Maximum discount amount cap (for PERCENTAGE type, set to 0 for no limit)',
    example: 50,
  })
  @IsNumber()
  @Min(0)
  maxDiscountAmount: number;

  @ApiPropertyOptional({
    description:
      'Maximum usage limit for the coupon across all users (null for unlimited)',
    example: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional({
    description: 'Usage limit for a single user (defaults to 1)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  userUsageLimit?: number;

  @ApiProperty({
    description: 'Date and time from when the coupon becomes active',
    example: '2026-07-06T00:00:00.000Z',
  })
  @Type(() => Date)
  validFrom: Date;

  @ApiProperty({
    description: 'Date and time until when the coupon is valid',
    example: '2026-08-06T23:59:59.000Z',
  })
  @Type(() => Date)
  validUntil: Date;

  @ApiPropertyOptional({
    description: 'Active status of the coupon (defaults to true)',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
