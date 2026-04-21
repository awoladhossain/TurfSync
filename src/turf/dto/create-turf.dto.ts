import { SportType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class CreateTurfDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsEnum(SportType)
  sportType!: SportType;

  @Type(() => Number)
  @IsNumber()
  @Min(100)
  pricePerHour!: number;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'openTime must be in HH:mm format (24-hour)',
  })
  openTime!: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'closeTime must be in HH:mm format (24-hour)',
  })
  closeTime!: string;

  @IsArray()
  @IsOptional()
  images?: string[];
}
