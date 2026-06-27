import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import 'multer';

@Injectable()
export class UploadService {
  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  // upload image to cloudinary
  async uploadTurfImages(
    file: Express.Multer.File,
    turfId: string,
  ): Promise<string> {
    // file size check - 5MB max
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Image size must be less than 5MB');
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG and WEBP images are allowed',
      );
    }

    // buffer to cloudinary uplaod
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: `turfbook/turfs/${turfId}`,
            transformation: [
              { width: 1200, height: 800, crop: 'fill' },
              { quality: 'auto' },
              { fetch_format: 'auto' },
            ],
          },

          (error, result) => {
            if (error) {
              return reject(
                new Error(error.message || 'Cloudinary upload error'),
              );
            }
            if (!result || !result.secure_url) {
              return reject(
                new BadRequestException(
                  'Upload failed: no secure URL returned from Cloudinary',
                ),
              );
            }
            resolve(result.secure_url);
          },
        )
        .end(file.buffer);
    });
  }
}
