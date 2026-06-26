import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ParseUUIDPipe } from '@/common/pipes/parse-uuid.pipe';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@ApiTags('Bookings')
@ApiBearerAuth('JWT')
@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingController {
  constructor(private bookingService: BookingService) {}

  @Post()
  create(
    @Body() dto: CreateBookingDto,
    @CurrentUser('id', ParseUUIDPipe) userId: string,
  ) {
    return this.bookingService.create(dto, userId);
  }

  @Get('my')
  findMyBookings(
    @CurrentUser('id', ParseUUIDPipe) userId: string,
    @Query() query: PaginationDto,
  ) {
    return this.bookingService.findMyBookings(userId, query.page, query.limit);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.USER)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id', ParseUUIDPipe) userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    return this.bookingService.findOne(id, userId, userRole);
  }

  @Patch(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id', ParseUUIDPipe) userId: string,
  ) {
    return this.bookingService.cancel(id, userId);
  }

  // Admin only
  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  findAll(@Query() query: PaginationDto) {
    return this.bookingService.findAll(query.page, query.limit);
  }
}
