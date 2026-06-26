import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440002',
    description: 'The booking ID for which the payment is created',
  })
  @IsUUID()
  @IsNotEmpty()
  bookingId: string;
}
