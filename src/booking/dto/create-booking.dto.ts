import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  turfId!: string;

  @IsString()
  @IsNotEmpty()
  slotId!: string;

  @IsDateString()
  date!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
