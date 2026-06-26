import { BadRequestException } from '@nestjs/common';
import { ParseUUIDPipe } from './parse-uuid.pipe';
import { ArgumentMetadata } from '@nestjs/common';

describe('ParseUUIDPipe', () => {
  let pipe: ParseUUIDPipe;
  const mockMetadata: ArgumentMetadata = { type: 'param', data: 'id' };

  beforeEach(() => {
    pipe = new ParseUUIDPipe();
  });

  it('should return value if it is a valid UUID v4', () => {
    const validUUID = 'f302f2a5-e425-4731-8ac0-397d0a1d9ee1';
    expect(pipe.transform(validUUID, mockMetadata)).toBe(validUUID);
  });

  it('should throw BadRequestException if value is not a valid UUID v4', () => {
    const invalidUUID = 'not-a-uuid';
    expect(() => pipe.transform(invalidUUID, mockMetadata)).toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException with custom parameter name in message', () => {
    const invalidUUID = 'not-a-uuid';
    const metadata: ArgumentMetadata = { type: 'param', data: 'customId' };
    expect(() => pipe.transform(invalidUUID, metadata)).toThrow(
      'customId must be a valid UUID',
    );
  });
});
