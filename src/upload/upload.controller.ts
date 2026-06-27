import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ParseUUIDPipe } from '@/common/pipes/parse-uuid.pipe';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  NotFoundException,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { memoryStorage } from 'multer';
import { UploadService } from './upload.service';
import { DeleteImageDto } from './dto/delete-image.dto';

@ApiTags('Admin')
@Controller('admin/upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth('JWT')
export class UploadController {
  constructor(
    private uploadService: UploadService,
    private prisma: PrismaService,
  ) {}

  @Post('turf/:turfId/image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload turf image' })
  async uploadTurfImage(
    @Param('turfId', ParseUUIDPipe)
    turfId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const imageUrl = await this.uploadService.uploadTurfImages(file, turfId);
    // db save
    await this.prisma.turf.update({
      where: { id: turfId },
      data: {
        images: { push: imageUrl },
      },
    });
    return { imageUrl };
  }

  @Delete('turf/:turfId/image')
  @ApiOperation({ summary: 'Delete turf image' })
  @ApiBody({ type: DeleteImageDto })
  async deleteTurfImage(
    @Param('turfId', ParseUUIDPipe)
    turfId: string,
    @Body() dto: DeleteImageDto,
  ) {
    const { imageUrl } = dto;

    const turf = await this.prisma.turf.findUnique({
      where: { id: turfId },
      select: { images: true },
    });

    if (!turf) {
      throw new NotFoundException('Turf not found');
    }

    if (!turf.images.includes(imageUrl)) {
      throw new BadRequestException('Image not found on this turf');
    }

    // Delete from Cloudinary
    await this.uploadService.deleteImage(imageUrl);

    // Remove from turf.images array in db
    await this.prisma.turf.update({
      where: { id: turfId },
      data: {
        images: turf.images.filter((img) => img !== imageUrl),
      },
    });

    return { success: true };
  }
}
