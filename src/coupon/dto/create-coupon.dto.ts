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
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(DiscountType)
  discountType: DiscountType;

  @IsNumber()
  @Min(0)
  discountValue: number;

  @IsNumber()
  @Min(0)
  minOrderAmount: number;

  @IsNumber()
  @Min(0)
  maxDiscountAmount: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  userUsageLimit?: number;

  @Type(() => Date)
  validFrom: Date;

  @Type(() => Date)
  validUntil: Date;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
