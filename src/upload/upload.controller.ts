import { PrismaService } from '@/prisma/prisma.service';
import { Controller } from '@nestjs/common';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(
    private uploadService: UploadService,
    private prisma: PrismaService,
  ) {}

  // @Post('turf/:turfId/image')
  // @UseInterceptors(FileInterceptor('image', {
  //   storage: memoryStorage(),
  //   limits: { fileSize: 5 * 1024 * 1024 }
  // }))
}
