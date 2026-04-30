import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
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
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { RolesGuard } from '@/common/guards/roles.guard';

@Controller('booking')
@UseGuards(JwtAuthGuard)
export class BookingController {
  constructor(private bookingService: BookingService) {}

  @Post()
  create(@Body() dto: CreateBookingDto, @CurrentUser('id') userId: string) {
    return this.bookingService.create(dto, userId);
  }

  @Get('my')
  findMyBookings(@CurrentUser('id') userId: string) {
    return this.bookingService.findMyBookings(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.bookingService.findOne(id, userId);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.bookingService.cancel(id, userId);
  }

  // Admin only
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.bookingService.findAll(+page, +limit);
  }
}
