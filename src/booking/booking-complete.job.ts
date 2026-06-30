import { AdminService } from '@/admin/admin.service';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class BookingCompleteJob {
  private readonly logger = new Logger(BookingCompleteJob.name);
  constructor(
    private prisma: PrismaService,
    private adminService: AdminService,
  ) {}
}
