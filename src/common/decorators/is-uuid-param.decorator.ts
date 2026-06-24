import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export function IsUUIDField(description?: string) {
  return applyDecorators(
    IsUUID('4', { message: `${description || 'ID'} must be a valid UUID` }),
    IsNotEmpty(),
    ApiProperty({
      example: '550e8400-e29b-41d4-a716-446655440000',
      description: description || 'UUID v4',
    }),
  );
}
