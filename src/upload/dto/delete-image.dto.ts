import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUrl } from 'class-validator';

export class DeleteImageDto {
  @ApiProperty({
    example: 'https://res.cloudinary.com/...',
    description: 'The URL of the image to delete',
  })
  @IsUrl()
  @IsNotEmpty()
  imageUrl!: string;
}
